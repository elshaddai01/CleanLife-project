// backend/src/routes/auth.js
const express = require('express');
const { pool } = require('../db/pool');
const { comparePassword } = require('../utils/password');
const { signToken, signRefreshToken, verifyToken } = require('../utils/jwt');
const { requireAuth, blacklistToken } = require('../middleware/auth');
const { nonEmptyString } = require('../utils/validation');

const router = express.Router();

// UNIFIED LOGIN - Works for collectors AND clients
router.post('/login', async (req, res) => {
    const identifier = nonEmptyString(req.body.username) ||
                       nonEmptyString(req.body.phone_number)?.replace(/\s+/g, '');
    const password = nonEmptyString(req.body.password);

    if (!identifier || !password) {
        return res.status(400).json({ error: 'username/phone and password are required' });
    }

    try {
        let user = null;
        let userType = null;

        // Try collector
        const collectorResult = await pool.query(
            'SELECT * FROM find_collector_by_username($1)',
            [identifier]
        );

        if (collectorResult.rows.length > 0) {
            const collector = collectorResult.rows[0];
            const passwordOk = await comparePassword(password, collector.password_hash);
            if (passwordOk) {
                user = {
                    id: collector.id,
                    username: collector.username,
                    role: 'collector',
                    company_id: collector.company_id,
                    collector_type: collector.collector_type,
                    subscription_tier: collector.subscription_tier,
                    name: collector.username,
                };
                userType = 'collector';
            }
        }

        // Try client
        if (!user) {
            const clientResult = await pool.query(
                'SELECT * FROM find_client_by_phone($1)',
                [identifier]
            );

            if (clientResult.rows.length > 0) {
                const client = clientResult.rows[0];

                if (!client.password_hash) {
                    return res.status(401).json({
                        error: 'this account has no password set',
                        code: 'NO_PASSWORD_SET'
                    });
                }

                const passwordOk = await comparePassword(password, client.password_hash);
                if (passwordOk) {
                    user = {
                        id: client.id,
                        username: client.phone_number,
                        role: 'client',
                        company_id: client.company_id,
                        name: client.name,
                        phone_number: client.phone_number,
                    };
                    userType = 'client';
                }
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'invalid credentials' });
        }

        // Generate tokens
        const accessToken = signToken(user);
        const refreshToken = signRefreshToken(user);

        // Update last login
        if (userType === 'collector') {
            await pool.query('UPDATE collectors SET last_login = NOW() WHERE id = $1', [user.id]);
        } else if (userType === 'client') {
            await pool.query('UPDATE clients SET last_login = NOW() WHERE id = $1', [user.id]);
        }

        const dashboardUrls = {
            'collector': '/collector/dashboard',
            'client': '/client/dashboard',
            'admin': '/admin/dashboard',
        };

        return res.json({
            message: 'login successful',
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                company_id: user.company_id,
                name: user.name || user.username,
                collector_type: user.collector_type || null,
                subscription_tier: user.subscription_tier || null,
                phone_number: user.phone_number || null,
            },
            tokens: {
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_in: process.env.JWT_EXPIRES_IN || '8h',
            },
            redirect_to: dashboardUrls[user.role] || '/',
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'login failed' });
    }
});

// REFRESH TOKEN
router.post('/refresh', async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({ error: 'refresh token is required' });
    }

    try {
        const verification = verifyToken(refresh_token);

        if (!verification.valid) {
            return res.status(401).json({
                error: verification.expired ? 'refresh token expired' : 'invalid refresh token'
            });
        }

        const { decoded } = verification;

        // Check if user exists
        let user = null;
        const collectorResult = await pool.query(
            'SELECT id, username, collector_type, company_id, subscription_tier FROM collectors WHERE id = $1',
            [decoded.sub]
        );

        if (collectorResult.rows.length > 0) {
            const collector = collectorResult.rows[0];
            user = {
                id: collector.id,
                username: collector.username,
                role: 'collector',
                company_id: collector.company_id,
                collector_type: collector.collector_type,
                subscription_tier: collector.subscription_tier,
            };
        } else {
            const clientResult = await pool.query(
                'SELECT id, name, phone_number, company_id FROM clients WHERE id = $1',
                [decoded.sub]
            );
            if (clientResult.rows.length > 0) {
                const client = clientResult.rows[0];
                user = {
                    id: client.id,
                    username: client.phone_number,
                    role: 'client',
                    company_id: client.company_id,
                    name: client.name,
                    phone_number: client.phone_number,
                };
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'user not found' });
        }

        const newAccessToken = signToken(user);

        return res.json({
            access_token: newAccessToken,
            expires_in: process.env.JWT_EXPIRES_IN || '8h',
        });

    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({ error: 'failed to refresh token' });
    }
});

// LOGOUT
router.post('/logout', requireAuth, async (req, res) => {
    try {
        const header = req.headers.authorization || '';
        const [, token] = header.split(' ');
        if (token) blacklistToken(token);
        return res.json({ message: 'logged out successfully' });
    } catch (error) {
        return res.status(500).json({ error: 'logout failed' });
    }
});

// GET CURRENT USER
router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = req.collector || req.user;
        if (user.role === 'collector') {
            const result = await pool.query(
                'SELECT id, username, collector_type, company_id, subscription_tier, kyc_status FROM collectors WHERE id = $1',
                [user.sub]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'collector not found' });
            return res.json({ user: { ...result.rows[0], role: 'collector' } });
        } else if (user.role === 'client') {
            const result = await pool.query(
                'SELECT id, name, phone_number, company_id, balance FROM clients WHERE id = $1',
                [user.sub]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'client not found' });
            return res.json({ user: { ...result.rows[0], role: 'client' } });
        }
        return res.json({ user });
    } catch (error) {
        return res.status(500).json({ error: 'user lookup failed' });
    }
});

module.exports = router;