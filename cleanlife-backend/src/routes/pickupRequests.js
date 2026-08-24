const express = require('express');
const { pool, withTenant } = require('../db/pool');
const { requireAuth, requireAdminKey, requireRole } = require('../middleware/auth');
const { positiveInteger, finiteNumber } = require('../utils/validation');
const { handleDbError } = require('../utils/dbErrors');
const { evaluateMobility } = require('../services/mobilityEvaluation');
const { scheduleAdminHoldExpiry, scheduleCascade, cancelPendingJobs } = require('../queues/dispatchQueue');
const { sendPushNotification } = require('../utils/pushService');

const router = express.Router();

const TIER_RANK = { Premium: 1, Gold: 2, Silver: 3 };
const VALID_WASTE_TYPES = ['Organic', 'Recyclable', 'Hazardous', 'Heavy Debris'];
const VALID_PAYMENT_METHODS = ['CASH', 'MOMO'];

// [DISP-01/03/04/05] Create a pickup request.
// Body: { client_id, bag_count, waste_type, latitude, longitude }
router.post('/', requireAuth, requireRole('client'), async (req, res) => {
    const { client_id, bag_count, waste_type, latitude, longitude, payment_method } = req.body;
    const clientId = positiveInteger(client_id);
    const bagCount = positiveInteger(bag_count);
    const latitudeValue = finiteNumber(latitude, { min: -90, max: 90 });
    const longitudeValue = finiteNumber(longitude, { min: -180, max: 180 });

    if (!clientId || !bagCount || !waste_type || latitudeValue === null || longitudeValue === null || !payment_method) {
        return res.status(400).json({ error: 'client_id, bag_count, waste_type, latitude, longitude, payment_method are required' });
    }
    if (clientId !== Number(req.collector.sub)) return res.status(403).json({ error: 'client_id must match the authenticated client' });
    if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
        return res.status(400).json({ error: `payment_method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}` });
    }
    if (!VALID_WASTE_TYPES.includes(waste_type)) {
        return res.status(400).json({ error: `waste_type must be one of: ${VALID_WASTE_TYPES.join(', ')}` });
    }

    try {
        const clientResult = await pool.query('SELECT * FROM find_client_by_id($1)', [clientId]);
        if (clientResult.rows.length === 0) {
            return res.status(400).json({ error: 'client_id does not exist' });
        }
        const client = clientResult.rows[0];
        const isCorporate = client.company_id !== null;

        const { mobilityTypeName, nearestDumpsterId, distanceMeters } =
            await evaluateMobility(bagCount, latitudeValue, longitudeValue);

        const mobilityResult = await pool.query('SELECT id FROM mobility_types WHERE name = $1', [mobilityTypeName]);
        const mobilityTypeId = mobilityResult.rows[0]?.id || null;

        const initialStatus = isCorporate ? 'searching_corporate' : 'broadcast_public';
        const adminHoldExpiresAt = isCorporate ? new Date(Date.now() + require('../queues/dispatchQueue').ADMIN_HOLD_MS) : null;
        const estimatedPriceFcfa = bagCount * 500;

        const created = await withTenant(client.company_id, async (dbClient) => {
            const result = await dbClient.query(
                `INSERT INTO pickup_requests
                    (client_id, bag_count, waste_type, mobility_type_id, routing_status,
                     admin_hold_expires_at, client_latitude, client_longitude, current_stage_rank, payment_method, estimated_price_fcfa)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10)
                 RETURNING id, client_id, bag_count, waste_type, mobility_type_id, routing_status,
                           admin_hold_expires_at, current_stage_rank, payment_method, payment_status, estimated_price_fcfa, created_at`,
                [clientId, bagCount, waste_type, mobilityTypeId, initialStatus, adminHoldExpiresAt, latitudeValue, longitudeValue, payment_method, estimatedPriceFcfa]
            );
            return result.rows[0];
        });

        if (isCorporate) {
            await scheduleAdminHoldExpiry(created.id);
        } else {
            await scheduleCascade(created.id);
        }

        return res.status(201).json({
            ...created,
            mobility_type: mobilityTypeName,
            nearest_dumpster_id: nearestDumpsterId,
            nearest_dumpster_distance_meters: distanceMeters,
        });
    } catch (err) {
        return handleDbError(err, res, 'pickup request creation');
    }
});

// [DISP-04] Admin manual delegation within the 2-minute hold window.
router.post('/:id/assign', requireAdminKey, async (req, res) => {
    const requestId = positiveInteger(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'invalid pickup request id' });
    const { collector_id } = req.body;
    const collectorId = positiveInteger(collector_id);
    if (!collectorId) {
        return res.status(400).json({ error: 'collector_id is required' });
    }

    try {
        const lookup = await pool.query('SELECT * FROM find_pickup_request_company($1)', [requestId]);
        if (lookup.rows.length === 0) {
            return res.status(404).json({ error: 'pickup request not found' });
        }
        const { company_id } = lookup.rows[0];

        const updated = await withTenant(company_id, async (client) => {
            const result = await client.query(
                `UPDATE pickup_requests
                 SET routing_status = 'assigned', collector_id = $1
                 WHERE id = $2
                   AND routing_status = 'searching_corporate'
                   AND collector_id IS NULL
                   AND EXISTS (
                       SELECT 1 FROM collectors
                       WHERE collectors.id = $1
                         AND collectors.collector_type = 'corporate'
                         AND collectors.company_id = $3
                   )
                 RETURNING id, routing_status, collector_id`,
                [collectorId, requestId, company_id]
            );
            return result.rows[0];
        });

        if (!updated) {
            return res.status(409).json({ error: 'request is no longer available for manual assignment (already assigned or escalated)' });
        }

        await cancelPendingJobs(requestId);
        return res.json(updated);
    } catch (err) {
        return handleDbError(err, res, 'manual assignment');
    }
});

// [DISP-05/DISP-10] Collector claims a job. Independent collectors claim
// broadcast_public jobs via claim_pickup_request; corporate collectors
// claim their own company's still-open searching_corporate jobs via
// claim_corporate_pickup_request.
router.post('/:id/claim', requireAuth, requireRole('collector'), async (req, res) => {
    const requestId = positiveInteger(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'invalid pickup request id' });

    try {
        const fn = req.collector.collector_type === 'corporate'
            ? 'claim_corporate_pickup_request'
            : 'claim_pickup_request';
        const result = await pool.query(`SELECT * FROM ${fn}($1, $2)`, [requestId, req.collector.sub]);
        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'request already claimed, not available to you, or does not exist' });
        }
        await cancelPendingJobs(requestId);
        // [NOTIF-04] Real push — notify the client their request was claimed.
    // Fire-and-forget: a push failure must never break the claim itself.
    const clientLookup = await pool.query(
        'SELECT push_token FROM clients WHERE id = (SELECT client_id FROM pickup_requests WHERE id = $1)',
        [requestId]
    );
    if (clientLookup.rows[0]?.push_token) {
        void sendPushNotification(
            clientLookup.rows[0].push_token,
            'Collector on the way!',
            'A collector has accepted your pickup request.',
            { pickup_request_id: requestId }
        );
    }
        return res.json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'claim request');
    }
});

// [DISP-03/05] List requests currently visible/claimable to the logged-in collector.
router.get('/available', requireAuth, requireRole('collector'), async (req, res) => {
    const { collector_type, company_id, subscription_tier } = req.collector;
    const myRank = TIER_RANK[subscription_tier] || 3;

    try {
        const rows = await withTenant(company_id, async (client) => {
            if (collector_type === 'corporate') {
                const result = await client.query(
                    `SELECT id, client_id, bag_count, waste_type, mobility_type_id, routing_status, created_at
                     FROM pickup_requests
                     WHERE routing_status = 'searching_corporate' AND collector_id IS NULL
                     ORDER BY created_at ASC`
                );
                return result.rows;
            }
            const result = await client.query(
                `SELECT id, client_id, bag_count, waste_type, mobility_type_id, routing_status, current_stage_rank, created_at
                 FROM pickup_requests
                 WHERE routing_status = 'broadcast_public' AND collector_id IS NULL AND current_stage_rank >= $1
                 ORDER BY created_at ASC`,
                [myRank]
            );
            return result.rows;
        });

        return res.json(rows);
    } catch (err) {
        return handleDbError(err, res, 'list available requests');
    }
});

router.get('/mine', requireAuth, requireRole('client'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM list_client_pickup_requests($1)', [req.collector.sub]);
        return res.json(result.rows);
    } catch (err) {
        return handleDbError(err, res, 'client request listing');
    }
});

router.get('/active', requireAuth, requireRole('collector'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM list_collector_active_requests($1)', [req.collector.sub]);
        return res.json(result.rows);
    } catch (err) {
        return handleDbError(err, res, 'active job listing');
    }
});

// [TRACK-01] Read-only status check — used by the client to track a
// pickup request they just created. See migration 019.
router.get('/:id', requireAuth, async (req, res) => {
    const requestId = positiveInteger(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'invalid pickup request id' });
    try {
        const result = await pool.query('SELECT * FROM get_pickup_request_status_for_actor($1, $2, $3)', [requestId, req.collector.role, req.collector.sub]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'pickup request not found' });
        }
        return res.json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'pickup request status lookup');
    }
});

// [LOC-03] Client polls their assigned collector's last known coordinates.
// Only works while routing_status = 'assigned' — matches the window the
// collector app is actually sending updates in.
router.get('/:id/collector-location', requireAuth, requireRole('client'), async (req, res) => {
    const requestId = positiveInteger(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'invalid pickup request id' });
    try {
        const result = await pool.query(
            'SELECT * FROM get_collector_location_for_request($1, $2)',
            [requestId, req.collector.sub]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'no live location available for this request yet' });
        }
        return res.json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'collector location lookup');
    }
});

module.exports = router;