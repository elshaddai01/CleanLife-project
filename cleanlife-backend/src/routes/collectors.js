const express = require('express');
const { pool, withTenant } = require('../db/pool');
const { hashPassword } = require('../utils/password');
const { requireAdminKey, requireAuth, requireAdminRole } = require('../middleware/auth');
const { handleDbError } = require('../utils/dbErrors');
const { positiveInteger, nonEmptyString } = require('../utils/validation');

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
    if (req.collector.role !== 'collector') return res.status(403).json({ error: 'collector account required' });
    try {
        const result = await pool.query('SELECT * FROM get_collector_profile($1)', [req.collector.sub]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'collector not found' });
        return res.json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'collector profile lookup');
    }
});

// [PROFILE-02] Self-service profile update — collector edits their own
// contact fields (added in migration 024).
router.put('/me/profile', requireAuth, async (req, res) => {
    if (req.collector.role !== 'collector') return res.status(403).json({ error: 'collector account required' });

    const full_name = nonEmptyString(req.body.name);
    const email = nonEmptyString(req.body.email);
    const phone_number = nonEmptyString(req.body.phone_number)?.replace(/\s+/g, '') || null;

    if (!full_name && !email && !phone_number) {
        return res.status(400).json({ error: 'at least one of name, email, phone_number is required' });
    }

    try {
        const updated = await withTenant(req.collector.company_id, async (client) => {
            const result = await client.query(
                `UPDATE collectors
                 SET full_name = COALESCE($1, full_name),
                     email = COALESCE($2, email),
                     phone_number = COALESCE($3, phone_number)
                 WHERE id = $4
                 RETURNING id, username, full_name, email, phone_number, collector_type, subscription_tier`,
                [full_name, email, phone_number, req.collector.sub]
            );
            return result.rows[0];
        });
        if (!updated) return res.status(404).json({ error: 'collector not found' });
        return res.json(updated);
    } catch (err) {
        return handleDbError(err, res, 'profile update');
    }
});

// [ONBOARD-03a] Independent self-registration — public endpoint. This is
// the ONLY collector self-registration path. Corporate collectors are
// created below by their company's own admin instead.
// Body: { username, password, name?, email?, phone_number?, subscription_tier? }
router.post('/register', async (req, res) => {
    const username = nonEmptyString(req.body.username);
    const password = nonEmptyString(req.body.password);
    const full_name = nonEmptyString(req.body.name);
    const email = nonEmptyString(req.body.email);
    const phone_number = nonEmptyString(req.body.phone_number)?.replace(/\s+/g, '') || null;
    const { subscription_tier } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'password must be at least 8 characters' });
    }

    const tier = subscription_tier || 'Silver';
    if (!['Premium', 'Gold', 'Silver'].includes(tier)) {
        return res.status(400).json({ error: 'subscription_tier must be Premium, Gold, or Silver' });
    }

    try {
        const password_hash = await hashPassword(password);

        const created = await withTenant(null, async (client) => {
            const result = await client.query(
                `INSERT INTO collectors (username, password_hash, collector_type, company_id, subscription_tier, full_name, email, phone_number)
                 VALUES ($1, $2, 'independent', NULL, $3, $4, $5, $6)
                 RETURNING id, username, collector_type, company_id, subscription_tier, full_name, email, phone_number, created_at`,
                [username, password_hash, tier, full_name, email, phone_number]
            );
            return result.rows[0];
        });

        return res.status(201).json(created);
    } catch (err) {
        return handleDbError(err, res, 'collector registration');
    }
});

// [ONBOARD-03b] Corporate collector creation — done by the COMPANY'S OWN
// ADMIN via their portal login (company_admin role), NOT self-registered by
// the collector, and NOT gated by the old shared static key. company_admin
// creates strictly under their own company (company_id from their JWT,
// any company_code in the body is ignored). super_admin may create under
// any company by passing company_code, for support/setup purposes.
// The collector's subscription_tier is FORCED to inherit the company's
// tier, per SRS 4.3.
// Body: { username, password, company_code? (super_admin only) }
router.post('/admin-create', requireAuth, requireAdminRole(['company_admin', 'super_admin']), async (req, res) => {
    const username = nonEmptyString(req.body.username);
    const password = nonEmptyString(req.body.password);
    const company_code = nonEmptyString(req.body.company_code);

    if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'password must be at least 8 characters' });
    }

    try {
        let company;

        if (req.collector.role === 'company_admin') {
            const lookup = await pool.query(
                'SELECT id, company_name, subscription_tier FROM companies WHERE id = $1',
                [req.collector.company_id]
            );
            if (lookup.rows.length === 0) {
                return res.status(400).json({ error: 'your admin account is not linked to a valid company' });
            }
            company = lookup.rows[0];
        } else {
            if (!company_code) {
                return res.status(400).json({ error: 'company_code is required for super_admin' });
            }
            const lookup = await pool.query(
                'SELECT id, company_name, subscription_tier FROM companies WHERE lower(company_code) = $1',
                [String(company_code).trim().toLowerCase()]
            );
            if (lookup.rows.length === 0) {
                return res.status(400).json({ error: 'invalid company_code' });
            }
            company = lookup.rows[0];
        }

        const password_hash = await hashPassword(password);

        const created = await withTenant(company.id, async (client) => {
            const result = await client.query(
                `INSERT INTO collectors (username, password_hash, collector_type, company_id, subscription_tier)
                 VALUES ($1, $2, 'corporate', $3, $4)
                 RETURNING id, username, collector_type, company_id, subscription_tier, created_at`,
                [username, password_hash, company.id, company.subscription_tier]
            );
            return result.rows[0];
        });

        return res.status(201).json({ ...created, company_name: company.company_name });
    } catch (err) {
        return handleDbError(err, res, 'corporate collector creation');
    }
});

// [KYC-02] Collector submits their own KYC document — self-service, own tenant.
// Body: { document_url, document_name? }
router.post('/:id/kyc', requireAuth, async (req, res) => {
    const collectorId = positiveInteger(req.params.id);
    if (!collectorId) return res.status(400).json({ error: 'invalid collector id' });
    if (req.collector.sub !== collectorId) {
        return res.status(403).json({ error: 'you can only submit KYC for your own account' });
    }
    const { document_url, document_name } = req.body;
    if (!document_url) {
        return res.status(400).json({ error: 'document_url is required' });
    }

    try {
        const updated = await withTenant(req.collector.company_id, async (client) => {
            const result = await client.query(
                `UPDATE collectors
                 SET kyc_status = 'pending', kyc_document_url = $1, kyc_document_name = $2, kyc_submitted_at = now()
                 WHERE id = $3
                 RETURNING id, kyc_status, kyc_submitted_at`,
                [document_url, document_name || null, collectorId]
            );
            return result.rows[0];
        });
        return res.json(updated);
    } catch (err) {
        return handleDbError(err, res, 'KYC submission');
    }
});

// [KYC-03] Admin review — still gated by the legacy static key. Out of
// scope for this admin-identity change; could later move to
// requireAdminRole(['company_admin','super_admin']) if desired.
router.post('/:id/kyc/review', requireAdminKey, async (req, res) => {
    const collectorId = positiveInteger(req.params.id);
    if (!collectorId) return res.status(400).json({ error: 'invalid collector id' });
    const { status } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'status must be verified or rejected' });
    }

    try {
        const result = await pool.query('SELECT * FROM review_kyc($1, $2)', [collectorId, status]);
        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'collector not found or KYC not currently pending' });
        }
        return res.json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'KYC review');
    }
});

module.exports = router;