// [BIN-12] Community bin-status reporting — public, no-auth-required
// routes. Every POST here uses optionalAuth (never requireAuth): a logged-in
// client/collector gets silently attributed via their JWT, everyone else is
// recorded as anonymous. There is no visible choice for the caller either
// way — reporter_role/reporter_id are never read from the request body,
// only derived server-side from optionalAuth's req.collector, so a caller
// can't spoof an attribution.
const express = require('express');
const { pool } = require('../db/pool');
const { optionalAuth } = require('../middleware/auth');
const { positiveInteger, finiteNumber, nonEmptyString } = require('../utils/validation');
const { handleDbError } = require('../utils/dbErrors');

const router = express.Router();

const REPORTER_ROLES = ['client', 'collector'];

function deriveReporter(req) {
    const user = req.user || req.collector;
    if (user && REPORTER_ROLES.includes(user.role)) {
        return { reporterRole: user.role, reporterId: Number(user.sub) };
    }
    return { reporterRole: 'anonymous', reporterId: null };
}

// POST /bins — add a new bin, or surface an existing one within ~25m so the
// app can offer "confirm this one instead" rather than creating a duplicate.
// Body: { latitude, longitude, photo_url }
router.post('/', optionalAuth, async (req, res) => {
    const latitude = finiteNumber(req.body.latitude, { min: -90, max: 90 });
    const longitude = finiteNumber(req.body.longitude, { min: -180, max: 180 });
    const photoUrl = nonEmptyString(req.body.photo_url);

    if (latitude === null || longitude === null || !photoUrl) {
        return res.status(400).json({ error: 'latitude, longitude, and photo_url are required' });
    }

    const { reporterRole, reporterId } = deriveReporter(req);

    try {
        const result = await pool.query(
            'SELECT * FROM create_or_find_nearby_bin($1, $2, $3, $4, $5)',
            [latitude, longitude, photoUrl, reporterRole, reporterId]
        );
        const row = result.rows[0];
        return res.status(row.was_created ? 201 : 200).json({
            created: row.was_created,
            bin: { id: row.id, latitude: row.latitude, longitude: row.longitude, bin_code: row.bin_code, status: row.status },
            message: row.was_created
                ? 'New bin added.'
                : 'A bin already exists near this location — confirm it instead.',
        });
    } catch (err) {
        return handleDbError(err, res, 'bin creation');
    }
});

// POST /bins/:id/confirm — confirms an existing bin is really there.
// Body: { latitude, longitude, photo_url }
router.post('/:id/confirm', optionalAuth, async (req, res) => {
    const dumpsterId = positiveInteger(req.params.id);
    const latitude = finiteNumber(req.body.latitude, { min: -90, max: 90 });
    const longitude = finiteNumber(req.body.longitude, { min: -180, max: 180 });
    const photoUrl = nonEmptyString(req.body.photo_url);

    if (!dumpsterId) return res.status(400).json({ error: 'invalid bin id' });
    if (latitude === null || longitude === null || !photoUrl) {
        return res.status(400).json({ error: 'latitude, longitude, and photo_url are required' });
    }

    const { reporterRole, reporterId } = deriveReporter(req);

    try {
        const result = await pool.query(
            'SELECT * FROM confirm_bin($1, $2, $3, $4, $5, $6)',
            [dumpsterId, latitude, longitude, photoUrl, reporterRole, reporterId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'bin not found' });
        }
        return res.status(201).json({ id: result.rows[0].id, message: 'Bin confirmed.' });
    } catch (err) {
        return handleDbError(err, res, 'bin confirmation');
    }
});

// POST /bins/:id/report-full — Body: { latitude, longitude, photo_url }
router.post('/:id/report-full', optionalAuth, async (req, res) => {
    const dumpsterId = positiveInteger(req.params.id);
    const latitude = finiteNumber(req.body.latitude, { min: -90, max: 90 });
    const longitude = finiteNumber(req.body.longitude, { min: -180, max: 180 });
    const photoUrl = nonEmptyString(req.body.photo_url);

    if (!dumpsterId) return res.status(400).json({ error: 'invalid bin id' });
    if (latitude === null || longitude === null || !photoUrl) {
        return res.status(400).json({ error: 'latitude, longitude, and photo_url are required' });
    }

    const { reporterRole, reporterId } = deriveReporter(req);

    try {
        const result = await pool.query(
            'SELECT * FROM report_bin_full($1, $2, $3, $4, $5, $6)',
            [dumpsterId, latitude, longitude, photoUrl, reporterRole, reporterId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'bin not found' });
        }
        return res.json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'full-bin report');
    }
});

// GET /bins/nearby?lat=&lng=&radius_m= — for the "pick or suggest nearest"
// flow when reporting a full bin. No auth at all — a plain read, same
// no-RLS posture as every other dumpster read in this codebase.
router.get('/nearby', async (req, res) => {
    const latitude = finiteNumber(req.query.lat, { min: -90, max: 90 });
    const longitude = finiteNumber(req.query.lng, { min: -180, max: 180 });
    const radiusMeters = finiteNumber(req.query.radius_m, { min: 1, max: 50000 }) || 2000;

    if (latitude === null || longitude === null) {
        return res.status(400).json({ error: 'lat and lng query params are required' });
    }

    try {
        const result = await pool.query(
            `SELECT id, latitude, longitude, bin_code, status,
                    6371000 * 2 * asin(sqrt(
                        power(sin(radians(latitude - $1) / 2), 2) +
                        cos(radians($1)) * cos(radians(latitude)) *
                        power(sin(radians(longitude - $2) / 2), 2)
                    )) AS distance_meters
             FROM dumpsters
             WHERE merged_into_dumpster_id IS NULL
               AND 6371000 * 2 * asin(sqrt(
                        power(sin(radians(latitude - $1) / 2), 2) +
                        cos(radians($1)) * cos(radians(latitude)) *
                        power(sin(radians(longitude - $2) / 2), 2)
                    )) <= $3
             ORDER BY distance_meters
             LIMIT 25`,
            [latitude, longitude, radiusMeters]
        );
        return res.json(result.rows);
    } catch (err) {
        return handleDbError(err, res, 'nearby bins lookup');
    }
});

module.exports = router;
