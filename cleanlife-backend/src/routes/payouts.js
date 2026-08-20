const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { positiveInteger, finiteNumber, nonEmptyString } = require('../utils/validation');
const { handleDbError } = require('../utils/dbErrors');

const router = express.Router();

// [PAYOUT-05] Company admin releases funds from the company wallet to one
// of their own corporate collectors. Uses the newer per-admin JWT system
// (adminAuth.js — company_admin/super_admin roles) rather than admin.js's
// legacy shared X-Admin-Key, since this needs to know WHICH company the
// caller belongs to, not just "any admin." A super_admin may act on any
// company by passing company_id explicitly; a company_admin is always
// restricted to their own token's company_id, even if they send a
// different one in the body.
// Body: { collector_id, amount, description?, company_id? }
// (company_id only honored for super_admin — see below)
router.post('/', requireAuth, requireRole(['company_admin', 'super_admin']), async (req, res) => {
    const collectorId = positiveInteger(req.body.collector_id);
    const amount = finiteNumber(req.body.amount, { min: 0.01 });
    const description = nonEmptyString(req.body.description);

    if (!collectorId || amount === null) {
        return res.status(400).json({ error: 'collector_id and a positive amount are required' });
    }

    const companyId = req.collector.role === 'super_admin'
        ? positiveInteger(req.body.company_id)
        : req.collector.company_id;

    if (!companyId) {
        return res.status(400).json({ error: 'company_id is required' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM company_payout_to_collector($1, $2, $3, $4)',
            [companyId, collectorId, amount, description || null]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.message?.includes('does not belong')) {
            return res.status(403).json({ error: 'that collector does not belong to your company' });
        }
        if (error.message?.includes('insufficient balance')) {
            return res.status(422).json({ error: 'insufficient company balance' });
        }
        return handleDbError(error, res, 'payout');
    }
});

// GET /admin/payouts/company-balance — company_admin checks their own
// company's current wallet balance before deciding on a payout.
router.get('/company-balance', requireAuth, requireRole(['company_admin', 'super_admin']), async (req, res) => {
    const companyId = req.collector.role === 'super_admin'
        ? positiveInteger(req.query.company_id)
        : req.collector.company_id;

    if (!companyId) {
        return res.status(400).json({ error: 'company_id is required' });
    }

    try {
        const result = await pool.query('SELECT id, company_name, balance FROM companies WHERE id = $1', [companyId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'company not found' });
        return res.json(result.rows[0]);
    } catch (error) {
        return handleDbError(error, res, 'company balance lookup');
    }
});

module.exports = router;