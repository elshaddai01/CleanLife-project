const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { positiveInteger, nonEmptyString } = require('../utils/validation');
const { handleDbError } = require('../utils/dbErrors');

const router = express.Router();

// POST /ratings/client
// Client rates the collector after a completed pickup.
// Body: { pickup_request_id, rating, comment? }
router.post('/client', requireAuth, requireRole('client'), async (req, res) => {
    const pickupRequestId = positiveInteger(req.body.pickup_request_id);
    const rating = Number(req.body.rating);
    const comment = req.body.comment
        ? nonEmptyString(req.body.comment)
        : null;

    if (!pickupRequestId) {
        return res.status(400).json({
            error: 'pickup_request_id is required'
        });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({
            error: 'rating must be an integer between 1 and 5'
        });
    }

    try {
        const clientId = Number(req.collector.sub);

        const pickupResult = await pool.query(
            `SELECT id, client_id, collector_id, routing_status
             FROM pickup_requests
             WHERE id = $1`,
            [pickupRequestId]
        );

        if (pickupResult.rows.length === 0) {
            return res.status(404).json({
                error: 'pickup request not found'
            });
        }

        const pickup = pickupResult.rows[0];

        if (pickup.routing_status !== 'completed') {
            return res.status(400).json({
                error: 'ratings can only be submitted for completed pickups'
            });
        }

        if (Number(pickup.client_id) !== clientId) {
            return res.status(403).json({
                error: 'only the client who participated in this pickup can rate the collector'
            });
        }

        if (!pickup.collector_id) {
            return res.status(400).json({
                error: 'this pickup has no assigned collector'
            });
        }

        const result = await pool.query(
            `INSERT INTO ratings
                (pickup_request_id, client_id, collector_id, rated_by_role, rating, comment)
             VALUES ($1, $2, $3, 'client', $4, $5)
             RETURNING id, pickup_request_id, client_id, collector_id,
                       rated_by_role, rating, comment, created_at`,
            [
                pickupRequestId,
                clientId,
                pickup.collector_id,
                rating,
                comment
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'client rating submission');
    }
});
// POST /ratings/collector
// Collector rates the client after a completed pickup.
// Body: { pickup_request_id, rating, comment? }
router.post('/collector', requireAuth, requireRole('collector'), async (req, res) => {
    const pickupRequestId = positiveInteger(req.body.pickup_request_id);
    const rating = Number(req.body.rating);
    const comment = req.body.comment
        ? nonEmptyString(req.body.comment)
        : null;

    if (!pickupRequestId) {
        return res.status(400).json({
            error: 'pickup_request_id is required'
        });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({
            error: 'rating must be an integer between 1 and 5'
        });
    }

    try {
        const collectorId = Number(req.collector.sub);

        const pickupResult = await pool.query(
            `SELECT id, client_id, collector_id, routing_status
             FROM pickup_requests
             WHERE id = $1`,
            [pickupRequestId]
        );

        if (pickupResult.rows.length === 0) {
            return res.status(404).json({
                error: 'pickup request not found'
            });
        }

        const pickup = pickupResult.rows[0];

        if (pickup.routing_status !== 'completed') {
            return res.status(400).json({
                error: 'ratings can only be submitted for completed pickups'
            });
        }

        if (Number(pickup.collector_id) !== collectorId) {
            return res.status(403).json({
                error: 'only the collector who participated in this pickup can rate the client'
            });
        }

        if (!pickup.client_id) {
            return res.status(400).json({
                error: 'this pickup has no assigned client'
            });
        }

        const result = await pool.query(
            `INSERT INTO ratings
                (pickup_request_id, client_id, collector_id, rated_by_role, rating, comment)
             VALUES ($1, $2, $3, 'collector', $4, $5)
             RETURNING id, pickup_request_id, client_id, collector_id,
                       rated_by_role, rating, comment, created_at`,
            [
                pickupRequestId,
                pickup.client_id,
                collectorId,
                rating,
                comment
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'collector rating submission');
    }
});

module.exports = router;