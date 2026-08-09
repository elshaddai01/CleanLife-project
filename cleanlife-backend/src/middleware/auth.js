// backend/src/middleware/auth.js
const { verifyTokenLegacy } = require('../utils/jwt');
const config = require('../config/env');

const tokenBlacklist = new Set();

async function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({
            error: 'missing or malformed Authorization header',
            code: 'MISSING_TOKEN'
        });
    }

    if (tokenBlacklist.has(token)) {
        return res.status(401).json({
            error: 'token has been revoked',
            code: 'TOKEN_REVOKED'
        });
    }

    try {
        const decoded = verifyTokenLegacy(token);
        req.user = decoded;
        req.collector = decoded;
        return next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'token expired',
                code: 'TOKEN_EXPIRED'
            });
        }
        return res.status(401).json({
            error: 'invalid or expired token',
            code: 'INVALID_TOKEN'
        });
    }
}

function requireAdminKey(req, res, next) {
    const key = req.headers['x-admin-key'];
    if (!key || key !== config.adminApiKey) {
        return res.status(401).json({ error: 'invalid admin key' });
    }
    return next();
}

function requireRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return (req, res, next) => {
        if (!req.user && !req.collector) {
            return res.status(401).json({ error: 'authentication required' });
        }

        const user = req.user || req.collector;
        if (!roles.includes(user.role)) {
            return res.status(403).json({
                error: `requires one of these roles: ${roles.join(', ')}`,
                your_role: user.role
            });
        }
        return next();
    };
}

// [ADMIN-IDENTITY-02] Same pattern as requireRole, kept as a separate name
// so it's obvious at a glance which routes are gated by real admin login
// (super_admin/company_admin) versus client/collector roles.
function requireAdminRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return (req, res, next) => {
        const user = req.user || req.collector;
        if (!user) {
            return res.status(401).json({ error: 'authentication required' });
        }
        if (!roles.includes(user.role)) {
            return res.status(403).json({
                error: `requires one of these admin roles: ${roles.join(', ')}`,
                your_role: user.role
            });
        }
        return next();
    };
}

function requireOwnership(req, res, next) {
    if (!req.user && !req.collector) {
        return res.status(401).json({ error: 'authentication required' });
    }

    const user = req.user || req.collector;

    if (user.role === 'admin') {
        return next();
    }

    const targetUserId = req.params.id || req.params.userId || req.params.collectorId ||
                         req.params.clientId || req.body.user_id || req.body.client_id;

    if (!targetUserId) {
        return res.status(400).json({ error: 'user ID required' });
    }

    if (parseInt(user.sub) !== parseInt(targetUserId)) {
        return res.status(403).json({
            error: 'you can only access your own resources',
            your_id: user.sub
        });
    }

    next();
}

function blacklistToken(token) {
    tokenBlacklist.add(token);
}

module.exports = {
    requireAuth,
    requireAdminKey,
    requireRole,
    requireAdminRole,
    requireOwnership,
    blacklistToken,
    tokenBlacklist,
};