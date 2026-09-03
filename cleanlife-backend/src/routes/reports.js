// [BIN-33] Super-admin bin-reports management: filterable listing, mark
// resolved/reopen, tag neighborhood, merge duplicate dumpsters, and CSV
// export — the "Reports" section of the super-admin portal reads all of
// this. Every route here is super_admin only.
const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { positiveInteger, nonEmptyString } = require('../utils/validation');
const { handleDbError } = require('../utils/dbErrors');

const router = express.Router();

const VALID_REVIEW_STATUSES = ['open', 'resolved'];

function parseFilters(req) {
    const neighborhood = nonEmptyString(req.query.neighborhood);
    const statusRaw = nonEmptyString(req.query.status);
    const status = statusRaw && VALID_REVIEW_STATUSES.includes(statusRaw) ? statusRaw : null;
    const dateFrom = nonEmptyString(req.query.date_from);
    const dateTo = nonEmptyString(req.query.date_to);
    return [neighborhood, status, dateFrom, dateTo];
}

function toCsv(rows) {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const escape = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push(headers.map((h) => escape(row[h])).join(','));
    }
    return lines.join('\n');
}

// GET /admin/reports/attributed?neighborhood=&status=&date_from=&date_to=
router.get('/attributed', requireAuth, requireRole('super_admin'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM admin_get_attributed_bin_reports($1, $2, $3, $4)', parseFilters(req));
        return res.json(result.rows);
    } catch (err) {
        return handleDbError(err, res, 'attributed bin reports lookup');
    }
});

// GET /admin/reports/anonymous?neighborhood=&status=&date_from=&date_to=
router.get('/anonymous', requireAuth, requireRole('super_admin'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM admin_get_anonymous_bin_reports($1, $2, $3, $4)', parseFilters(req));
        return res.json(result.rows);
    } catch (err) {
        return handleDbError(err, res, 'anonymous bin reports lookup');
    }
});

// GET /admin/reports/attributed/export — same filters, CSV download.
router.get('/attributed/export', requireAuth, requireRole('super_admin'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM admin_get_attributed_bin_reports($1, $2, $3, $4)', parseFilters(req));
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="attributed-bin-reports.csv"');
        return res.send(toCsv(result.rows));
    } catch (err) {
        return handleDbError(err, res, 'attributed bin reports export');
    }
});

// GET /admin/reports/anonymous/export — same filters, CSV download.
router.get('/anonymous/export', requireAuth, requireRole('super_admin'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM admin_get_anonymous_bin_reports($1, $2, $3, $4)', parseFilters(req));
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="anonymous-bin-reports.csv"');
        return res.send(toCsv(result.rows));
    } catch (err) {
        return handleDbError(err, res, 'anonymous bin reports export');
    }
});

// POST /admin/reports/:id/status — Body: { status: 'open' | 'resolved' }
router.post('/:id/status', requireAuth, requireRole('super_admin'), async (req, res) => {
    const reportId = positiveInteger(req.params.id);
    const status = nonEmptyString(req.body.status);
    if (!reportId) return res.status(400).json({ error: 'invalid report id' });
    if (!status || !VALID_REVIEW_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${VALID_REVIEW_STATUSES.join(', ')}` });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM admin_set_bin_report_status($1, $2, $3)',
            [reportId, status, req.collector.sub]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'report not found' });
        return res.json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'report status update');
    }
});

// POST /admin/reports/:id/neighborhood — Body: { neighborhood }
router.post('/:id/neighborhood', requireAuth, requireRole('super_admin'), async (req, res) => {
    const reportId = positiveInteger(req.params.id);
    const neighborhood = nonEmptyString(req.body.neighborhood);
    if (!reportId) return res.status(400).json({ error: 'invalid report id' });
    if (!neighborhood) return res.status(400).json({ error: 'neighborhood is required' });

    try {
        const result = await pool.query(
            'SELECT * FROM admin_set_bin_report_neighborhood($1, $2)',
            [reportId, neighborhood]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'report not found' });
        return res.json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'report neighborhood update');
    }
});

// POST /admin/bins/:duplicateId/merge — Body: { primary_dumpster_id }
router.post('/bins/:duplicateId/merge', requireAuth, requireRole('super_admin'), async (req, res) => {
    const duplicateId = positiveInteger(req.params.duplicateId);
    const primaryId = positiveInteger(req.body.primary_dumpster_id);
    if (!duplicateId) return res.status(400).json({ error: 'invalid duplicate bin id' });
    if (!primaryId) return res.status(400).json({ error: 'primary_dumpster_id is required' });

    try {
        const result = await pool.query('SELECT * FROM admin_merge_dumpsters($1, $2)', [duplicateId, primaryId]);
        return res.json(result.rows[0]);
    } catch (err) {
        if (err.message?.includes('cannot merge a dumpster into itself')) {
            return res.status(400).json({ error: 'cannot merge a bin into itself' });
        }
        if (err.message?.includes('primary dumpster does not exist')) {
            return res.status(404).json({ error: 'primary bin not found' });
        }
        if (err.message?.includes('primary dumpster is itself merged')) {
            return res.status(409).json({ error: 'primary bin is itself merged into another — merge into the live one instead' });
        }
        if (err.message?.includes('duplicate dumpster does not exist')) {
            return res.status(404).json({ error: 'duplicate bin not found' });
        }
        return handleDbError(err, res, 'bin merge');
    }
});

module.exports = router;
