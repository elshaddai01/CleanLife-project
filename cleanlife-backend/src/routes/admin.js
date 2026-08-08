const express = require('express');
const { pool } = require('../db/pool');
const { requireAdminKey, requireAuth, requireAdminRole } = require('../middleware/auth');
const { finiteNumber, nonEmptyString, positiveInteger } = require('../utils/validation');
const { handleDbError } = require('../utils/dbErrors');
const { hashPassword } = require('../utils/password');

const router = express.Router();

// [ADMIN-02] Company management — super_admin only, real JWT auth via
// /admin-auth/login instead of the shared static key.
router.post('/companies', requireAuth, requireAdminRole(['super_admin']), async (req, res) => {
    const companyName = nonEmptyString(req.body.company_name);
    const companyCode = nonEmptyString(req.body.company_code);
    const subscriptionTier = req.body.subscription_tier;
    if (!companyName || !companyCode || !['Premium', 'Gold', 'Silver'].includes(subscriptionTier)) {
        return res.status(400).json({ error: 'company_name, company_code, and a valid subscription_tier are required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO companies (company_name, company_code, subscription_tier)
             VALUES ($1, lower($2), $3)
             RETURNING id, company_name, company_code, subscription_tier, created_at`,
            [companyName, companyCode, subscriptionTier]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDbError(error, res, 'company creation');
    }
});

router.get('/companies', requireAuth, requireAdminRole(['super_admin']), async (req, res) => {
    try {
        const result = await pool.query('SELECT id, company_name, company_code, subscription_tier, created_at FROM companies ORDER BY company_name');
        return res.json(result.rows);
    } catch (error) {
        return handleDbError(error, res, 'company listing');
    }
});

// [ADMIN-03] Create a company_admin account for a company — super_admin
// only. This is how a company gets access to their own portal, and it's
// how they can then create their own corporate collectors.
router.post('/companies/:id/admins', requireAuth, requireAdminRole(['super_admin']), async (req, res) => {
    const companyId = positiveInteger(req.params.id);
    if (!companyId) return res.status(400).json({ error: 'invalid company id' });
    const username = nonEmptyString(req.body.username);
    const password = nonEmptyString(req.body.password);
    if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

    try {
        const companyCheck = await pool.query('SELECT id FROM companies WHERE id = $1', [companyId]);
        if (companyCheck.rows.length === 0) return res.status(404).json({ error: 'company not found' });

        const password_hash = await hashPassword(password);
        const result = await pool.query(
            `INSERT INTO admins (username, password_hash, role, company_id)
             VALUES ($1, $2, 'company_admin', $3)
             RETURNING id, username, role, company_id, created_at`,
            [username, password_hash, companyId]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDbError(error, res, 'company admin creation');
    }
});

// [ADMIN-04] Platform overview — super_admin dashboard stats.
router.get('/overview', requireAuth, requireAdminRole(['super_admin']), async (req, res) => {
    try {
        const [companies, collectors, clients, pickups] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM companies'),
            pool.query('SELECT COUNT(*) FROM collectors'),
            pool.query('SELECT COUNT(*) FROM clients'),
            pool.query('SELECT COUNT(*) FROM pickup_requests'),
        ]);
        return res.json({
            companies: Number(companies.rows[0].count),
            collectors: Number(collectors.rows[0].count),
            clients: Number(clients.rows[0].count),
            pickup_requests: Number(pickups.rows[0].count),
        });
    } catch (error) {
        return handleDbError(error, res, 'overview stats');
    }
});

// [ADMIN-01] Company portal fleet view — company_admin sees only their own
// company's collectors (company_id taken from their JWT, not trusted from
// the request); super_admin must pass company_id explicitly.
router.get('/collectors', requireAuth, requireAdminRole(['company_admin', 'super_admin']), async (req, res) => {
    let companyId;
    if (req.collector.role === 'company_admin') {
        companyId = req.collector.company_id;
    } else {
        companyId = positiveInteger(req.query.company_id);
        if (!companyId) return res.status(400).json({ error: 'company_id query param is required for super_admin' });
    }
    try {
        const result = await pool.query('SELECT * FROM admin_list_collectors_by_company($1)', [companyId]);
        return res.json(result.rows);
    } catch (error) {
        return handleDbError(error, res, 'collector listing');
    }
});

// Dumpsters remain gated by the legacy static admin key — unrelated to
// company/collector identity, out of scope for this change.
router.post('/dumpsters', requireAdminKey, async (req, res) => {
    const latitude = finiteNumber(req.body.latitude, { min: -90, max: 90 });
    const longitude = finiteNumber(req.body.longitude, { min: -180, max: 180 });
    const binCode = nonEmptyString(req.body.bin_code);
    if (latitude === null || longitude === null || !binCode) {
        return res.status(400).json({ error: 'valid latitude, longitude, and bin_code are required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO dumpsters (latitude, longitude, bin_code)
             VALUES ($1, $2, upper($3))
             RETURNING id, latitude, longitude, bin_code`,
            [latitude, longitude, binCode]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDbError(error, res, 'dumpster creation');
    }
});

router.get('/dumpsters', requireAdminKey, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, latitude, longitude, bin_code FROM dumpsters ORDER BY id');
        return res.json(result.rows);
    } catch (error) {
        return handleDbError(error, res, 'dumpster listing');
    }
});

module.exports = router;