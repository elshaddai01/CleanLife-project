const express = require('express');
const { pool, withTenant } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { handleDbError } = require('../utils/dbErrors');
const { nonEmptyString } = require('../utils/validation');

const router = express.Router();

// [NOTIF-03] Called once after login (see notifications.ts on mobile).
// Self-scoped write — a user can only set their own token.
// Body: { push_token }
router.post('/register-token', requireAuth, async (req, res) => {
    const pushToken = nonEmptyString(req.body.push_token);
    if (!pushToken) return res.status(400).json({ error: 'push_token is required' });

    const table = req.collector.role === 'client' ? 'clients' : 'collectors';

    try {
        const updated = await withTenant(req.collector.company_id, async (client) => {
            const result = await client.query(
                `UPDATE ${table} SET push_token = $1 WHERE id = $2 RETURNING id`,
                [pushToken, req.collector.sub]
            );
            return result.rows[0];
        });
        if (!updated) return res.status(404).json({ error: 'account not found' });
        return res.json({ registered: true });
    } catch (err) {
        return handleDbError(err, res, 'push token registration');
    }
});

module.exports = router;