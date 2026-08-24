// src/utils/jwt.js
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const SECRET = config.jwtSecret;
const EXPIRES_IN = config.jwtExpiresIn || '8h';
const REFRESH_EXPIRES_IN = config.jwtRefreshExpiresIn || '7d';

/**
 * UNIFIED TOKEN SIGNING - Works for ALL roles
 * This is the primary function that should be used for all new code
 */
function signToken(user) {
    const payload = {
        sub: user.id,
        role: user.role || 'client',
        username: user.username || user.phone_number || user.email,
        company_id: user.company_id || null,
        // Collector-specific fields
        collector_type: user.collector_type || null,
        subscription_tier: user.subscription_tier || null,
        // Client-specific fields
        name: user.name || user.full_name || null,
        phone_number: user.phone_number || null,
    };
    
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

/**
 * Generate REFRESH token (longer expiry)
 */
function signRefreshToken(user) {
    const payload = {
        sub: user.id,
        role: user.role,
        company_id: user.company_id,
    };
    
    return jwt.sign(payload, SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

/**
 * Unified TOKEN VERIFICATION with proper error handling
 * Returns { valid, expired, decoded, error }
 */
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, SECRET);
        return {
            valid: true,
            expired: false,
            decoded,
            error: null,
        };
    } catch (error) {
        return {
            valid: false,
            expired: error.name === 'TokenExpiredError',
            decoded: null,
            error: error.message,
        };
    }
}

/**
 * Legacy verifyToken that THROWS on error (for backward compatibility)
 * Keep this for existing code that expects throw behavior
 */
function verifyTokenLegacy(token) {
    return jwt.verify(token, SECRET);
}

// ============ BACKWARD COMPATIBILITY ============
// These functions are kept for existing code that uses signCollectorToken/signClientToken
// They now delegate to the unified signToken

function signCollectorToken(collector) {
    return signToken({
        id: collector.id,
        role: 'collector',
        username: collector.username,
        company_id: collector.company_id,
        collector_type: collector.collector_type,
        subscription_tier: collector.subscription_tier,
        name: collector.username,
    });
}

function signClientToken(client) {
    return signToken({
        id: client.id,
        role: 'client',
        username: client.phone_number,
        company_id: client.company_id,
        name: client.name,
        phone_number: client.phone_number,
    });
}

module.exports = {
    // Primary unified functions (USE THESE FOR NEW CODE)
    signToken,
    signRefreshToken,
    verifyToken,
    verifyTokenLegacy,
    
    // Backward compatibility (keep for existing code)
    signCollectorToken,
    signClientToken,
    
    // Expose constants for other modules
    SECRET,
    EXPIRES_IN,
    REFRESH_EXPIRES_IN,
};