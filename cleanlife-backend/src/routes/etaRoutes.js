const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { positiveInteger } = require('../utils/validation');
const { handleDbError } = require('../utils/dbErrors');

const router = express.Router();

const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg) {
    return (deg * Math.PI) / 180;
}

// Haversine — same formula pattern already used in mobilityEvaluation.js
// and proofOfWorkVerification.js, done here in JS instead of SQL since the
// two points come from two separate SECURITY DEFINER lookups already
// merged in get_eta_inputs_for_request.
function haversineMeters(lat1, lng1, lat2, lng2) {
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.asin(Math.sqrt(a));
    return EARTH_RADIUS_METERS * c;
}

// [ETA-04] Real ETA calculation. Distance = haversine between the client's
// fixed pickup point and the collector's last reported GPS position;
// time = distance / average_speed (per-collector, defaults to 20 km/h,
// see migration 032 — ASSUMPTION FLAGGED: no real routing/traffic data,
// straight-line distance over an assumed flat speed, not turn-by-turn).
// GET /eta/:pickupRequestId
router.get('/:pickupRequestId', requireAuth, async (req, res) => {
    const requestId = positiveInteger(req.params.pickupRequestId);
    if (!requestId) return res.status(400).json({ error: 'invalid pickup request id' });

    const actorRole = req.collector.role;
    const actorId = req.collector.sub;

    try {
        const inputResult = await pool.query(
            'SELECT * FROM get_eta_inputs_for_request($1, $2, $3)',
            [requestId, actorRole, actorId]
        );

        if (inputResult.rows.length === 0) {
            return res.status(404).json({ error: 'request not found, not assigned yet, or you are not part of it' });
        }

        const row = inputResult.rows[0];
        if (row.client_latitude == null || row.client_longitude == null || row.collector_latitude == null || row.collector_longitude == null) {
            return res.status(404).json({ error: 'location data not available yet' });
        }

        const distanceMeters = haversineMeters(
            Number(row.client_latitude),
            Number(row.client_longitude),
            Number(row.collector_latitude),
            Number(row.collector_longitude)
        );
        const speedKmh = Number(row.average_speed) || 20;
        const speedMetersPerSecond = (speedKmh * 1000) / 3600;
        const etaSeconds = Math.round(distanceMeters / speedMetersPerSecond);

        const recorded = await pool.query(
            'SELECT * FROM record_eta($1, $2, $3, $4, $5)',
            [requestId, row.collector_id, etaSeconds, Math.round(distanceMeters), speedKmh]
        );

        return res.json({
            pickup_request_id: requestId,
            eta_seconds: etaSeconds,
            distance_meters: Math.round(distanceMeters),
            speed_kmh: speedKmh,
            last_eta_update: recorded.rows[0]?.last_eta_update || null,
        });
    } catch (err) {
        return handleDbError(err, res, 'ETA calculation');
    }
});

module.exports = router;
