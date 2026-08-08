const express = require('express');
const { pool } = require('../db/pool');
const { comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { nonEmptyString } = require('../utils/validation');

const router = express.Router();

// [ADMIN-AUTH-01] Login for super_admin and company_admin accounts.
// Separate table, separate route from client/collector auth.js — role in
// the token is 'super_admin' or 'company_admin', checked by requireAdminRole.
router.post('/login', async (req, res) => {
    const username = nonEmptyString(req.body.username);
    const password = nonEmptyString(req.body.password);
    if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required' });
    }
    try {
        const result = await pool.query('SELECT * FROM find_admin_by_username($1)', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'invalid credentials' });
        }
        const admin = result.rows[0];
        const passwordOk = await comparePassword(password, admin.password_hash);
        if (!passwordOk) {
            return res.status(401).json({ error: 'invalid credentials' });
        }
        const token = signToken({
            id: admin.id,
            role: admin.role,
            username: admin.username,
            company_id: admin.company_id,
            name: admin.username,
        });
        return res.json({
            token,
            admin: { id: admin.id, username: admin.username, role: admin.role, company_id: admin.company_id },
        });
    } catch (err) {
        console.error('Admin login error:', err);
        return res.status(500).json({ error: 'login failed' });
    }
});

module.exports = router;