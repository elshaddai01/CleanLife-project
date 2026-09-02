const express = require('express');
const { pool, withTenant } = require('../db/pool');
const { requireAuth, requireAdminKey, requireRole } = require('../middleware/auth');
const { positiveInteger, finiteNumber } = require('../utils/validation');
const { handleDbError } = require('../utils/dbErrors');
const { evaluateMobility } = require('../services/mobilityEvaluation');
const { scheduleAdminHoldExpiry, scheduleCascade, cancelPendingJobs } = require('../queues/dispatchQueue');
const { sendPushNotification } = require('../utils/pushService');
const pawapay = require('../services/pawapay');

const router = express.Router();

const TIER_RANK = { Premium: 1, Gold: 2, Silver: 3 };
const VALID_WASTE_TYPES = ['Organic', 'Recyclable', 'Hazardous', 'Heavy Debris'];
const VALID_PAYMENT_METHODS = ['MOMO', 'OM'];

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

            // [NOTIF-08] Notify every corporate collector at this client's
            // company the instant the job is created — previously the job
            // sat silently in the private queue with no alert at all.
            // Fire-and-forget per collector; a push failure for one
            // collector must never block the others or the request itself.
            const companyCollectors = await pool.query(
                `SELECT push_token FROM collectors
                 WHERE company_id = $1 AND collector_type = 'corporate' AND push_token IS NOT NULL`,
                [client.company_id]
            );
            for (const row of companyCollectors.rows) {
                void sendPushNotification(
                    row.push_token,
                    'New job for your company',
                    `${bagCount} bag${bagCount > 1 ? 's' : ''} of ${waste_type.toLowerCase()} waste — tap to accept.`,
                    { pickup_request_id: created.id }
                );
            }
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

// [DISP-05/10] Unified claim endpoint — tries the public-broadcast path
// first (claim_pickup_request), then the corporate self-claim path
// (claim_corporate_pickup_request, migration 030) if the first finds
// nothing. This lets the mobile app use ONE claim button/call regardless
// of whether the job is a public broadcast_public row or the collector's
// own company's private searching_corporate row — the collector doesn't
// need to know which type it is.
router.post('/:id/claim', requireAuth, requireRole('collector'), async (req, res) => {
    const requestId = positiveInteger(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'invalid pickup request id' });

    try {
        let result = await pool.query('SELECT * FROM claim_pickup_request($1, $2)', [requestId, req.collector.sub]);

        if (result.rows.length === 0) {
            result = await pool.query('SELECT * FROM claim_corporate_pickup_request($1, $2)', [requestId, req.collector.sub]);
        }

        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'request already claimed, not available to you, or does not exist' });
        }
        await cancelPendingJobs(requestId);

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

// [MOMO-10] This used to trust the client's tap alone (client_confirm_momo_payment
// called directly, no check against pawaPay) — a "demo" gate per migration 035's
// own comment, never upgraded once real pawaPay integration landed. Migration 041
// added momo_deposit_id storage + get_momo_deposit_id_for_request specifically so
// this route could look up the real pawaPay transaction and verify it before
// confirming — that lookup existed but was never wired in until now. Real pawaPay
// status now gates the confirmation: only a genuine COMPLETED deposit lets the
// collector proceed to proof-of-work.
router.post('/:id/confirm-payment', requireAuth, requireRole('client'), async (req, res) => {
    const requestId = positiveInteger(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'invalid pickup request id' });

    try {
        const depositLookup = await pool.query(
            'SELECT * FROM get_momo_deposit_id_for_request($1, $2)',
            [requestId, req.collector.sub]
        );
        const depositRow = depositLookup.rows[0];
        if (!depositRow || !depositRow.momo_deposit_id) {
            return res.status(409).json({ error: 'no MoMo payment has been initiated for this request yet' });
        }

        let paymentStatus;
        try {
            paymentStatus = await pawapay.getPaymentStatus(depositRow.momo_deposit_id);
        } catch (pawapayError) {
            console.error(`[momo] Status check failed for request ${requestId}:`, pawapayError.message);
            return res.status(502).json({ error: 'could not reach pawaPay to verify payment status — please try again shortly' });
        }

        if (paymentStatus.status === 'FAILED') {
            return res.status(422).json({ error: 'the MoMo payment was not completed', pawapay_status: paymentStatus.status });
        }
        if (paymentStatus.status !== 'COMPLETED') {
            return res.status(202).json({ error: 'payment is still processing — please wait and try again', pawapay_status: paymentStatus.status });
        }

        const result = await pool.query(
            'SELECT * FROM client_confirm_momo_payment($1, $2)',
            [requestId, req.collector.sub]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'payment already confirmed, not a MoMo request, or collector has not arrived yet' });
        }
        const row = result.rows[0];

        if (row.collector_id) {
            const collectorLookup = await pool.query('SELECT push_token FROM collectors WHERE id = $1', [row.collector_id]);
            if (collectorLookup.rows[0]?.push_token) {
                void sendPushNotification(
                    collectorLookup.rows[0].push_token,
                    'Payment confirmed!',
                    'The client has confirmed payment. You can proceed with disposal.',
                    { pickup_request_id: requestId }
                );
            }
        }

        return res.json({ status: 'completed', id: row.id, momo_confirmed_at: row.momo_confirmed_at });
    } catch (err) {
        return handleDbError(err, res, 'payment confirmation');
    }
});

router.get('/available', requireAuth, requireRole('collector'), async (req, res) => {
    const { collector_type, company_id, subscription_tier } = req.collector;
    const myRank = TIER_RANK[subscription_tier] || 3;

    try {
        const rows = await withTenant(company_id, async (client) => {
            if (collector_type === 'corporate') {
                const result = await client.query(
                    `SELECT id, client_id, bag_count, waste_type, mobility_type_id, routing_status, current_stage_rank, created_at
                     FROM pickup_requests
                     WHERE (routing_status = 'searching_corporate' AND collector_id IS NULL)
                        OR (routing_status = 'broadcast_public' AND collector_id IS NULL AND current_stage_rank >= $1)
                     ORDER BY created_at ASC`,
                    [myRank]
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

module.exports = router;