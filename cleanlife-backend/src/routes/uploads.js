const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// [UPLOAD-01] SIMULATED storage — writes to local disk under
// cleanlife-backend/uploads/ and serves it back via express.static
// (mounted in app.js). Swap for S3/Cloudinary/etc before production;
// this exists only so the mobile app's proof-of-work flow has a real
// URL to submit to proof-of-work verification (see paymentAndProof.js).
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const MAX_BYTES = 8 * 1024 * 1024; // 8MB raw image ceiling
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png' };

// Shared by /proof (requireAuth) and /public (optionalAuth, see [BIN-13]
// below) — same validation, same local-disk-stub storage, same URL shape.
// Returns { url } on success, or null after already sending an error response.
function storeUploadedImage(req, res) {
    const { base64, mime_type } = req.body;

    if (!base64 || typeof base64 !== 'string') {
        res.status(400).json({ error: 'base64 is required' });
        return null;
    }
    if (!MIME_EXT[mime_type]) {
        res.status(400).json({ error: 'mime_type must be image/jpeg or image/png' });
        return null;
    }

    let buffer;
    try {
        buffer = Buffer.from(base64, 'base64');
    } catch {
        res.status(400).json({ error: 'base64 could not be decoded' });
        return null;
    }
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
        res.status(400).json({ error: `image must be between 1 byte and ${MAX_BYTES} bytes` });
        return null;
    }

    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${MIME_EXT[mime_type]}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    try {
        fs.writeFileSync(filePath, buffer);
    } catch (err) {
        console.error('upload write failed:', err.message);
        res.status(500).json({ error: 'could not store the uploaded image' });
        return null;
    }

    // req.protocol respects the LAN/tunnel host the request actually came in on.
    return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

// POST /uploads/proof — collector-only, disposal snapshot upload.
// Body: { base64, mime_type }
router.post('/proof', requireAuth, (req, res) => {
    const url = storeUploadedImage(req, res);
    if (url === null) return; // error already sent
    return res.status(201).json({ url });
});

// [BIN-13] POST /uploads/public — same storage, but for the community
// bin-reporting flow (add bin / confirm / report full), which must work
// for fully anonymous, logged-out users. Deliberately no requireAuth and
// no optionalAuth either — nothing here is attributed to an uploader, the
// file itself carries no identity, so there's nothing to gate.
router.post('/public', (req, res) => {
    const url = storeUploadedImage(req, res);
    if (url === null) return; // error already sent
    return res.status(201).json({ url });
});

module.exports = router;
