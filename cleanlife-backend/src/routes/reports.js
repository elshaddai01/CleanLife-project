const express = require('express');
const { pool, withTenant } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { finiteNumber, nonEmptyString } = require('../utils/validation');
const { handleDbError } = require('../utils/dbErrors');

const router = express.Router();

router.post('/illegal-dumping', requireAuth, requireRole('client'), async (req, res) => {
    const description = nonEmptyString(req.body.description);
    const latitude = finiteNumber(req.body.latitude, { min: -90, max: 90 });
    const longitude = finiteNumber(req.body.longitude, { min: -180, max: 180 });

    if (!description || latitude === null || longitude === null) {
        return res.status(400).json({ error: 'description, latitude, and longitude are required' });
    }

    try {
        const report = await withTenant(req.collector.company_id, async (client) => {
            const result = await client.query(
                `INSERT INTO illegal_dumping_reports (client_id, company_id, description, latitude, longitude)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, description, latitude, longitude, status, created_at`,
                [req.collector.sub, req.collector.company_id || null, description, latitude, longitude]
            );
            return result.rows[0];
        });
        return res.status(201).json(report);
    } catch (err) {
        return handleDbError(err, res, 'illegal dumping report');
    }
});

router.get('/mine', requireAuth, requireRole('client'), async (req, res) => {
    try {
        const reports = await withTenant(req.collector.company_id, async (client) => {
            const result = await client.query(
                `SELECT id, description, latitude, longitude, status, created_at
                 FROM illegal_dumping_reports
                 WHERE client_id = $1
                 ORDER BY created_at DESC`,
                [req.collector.sub]
            );
            return result.rows;
        });
        return res.json(reports);
    } catch (err) {
        return handleDbError(err, res, 'illegal dumping report listing');
    }
});

module.exports = router;
