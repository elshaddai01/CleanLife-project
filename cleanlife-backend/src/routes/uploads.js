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

// POST /uploads/proof — collector-only, disposal snapshot upload.
// Body: { base64, mime_type }
router.post('/proof', requireAuth, (req, res) => {
    const { base64, mime_type } = req.body;

    if (!base64 || typeof base64 !== 'string') {
        return res.status(400).json({ error: 'base64 is required' });
    }
    if (!MIME_EXT[mime_type]) {
        return res.status(400).json({ error: 'mime_type must be image/jpeg or image/png' });
    }

    let buffer;
    try {
        buffer = Buffer.from(base64, 'base64');
    } catch {
        return res.status(400).json({ error: 'base64 could not be decoded' });
    }
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
        return res.status(400).json({ error: `image must be between 1 byte and ${MAX_BYTES} bytes` });
    }

    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${MIME_EXT[mime_type]}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    try {
        fs.writeFileSync(filePath, buffer);
    } catch (err) {
        console.error('proof upload write failed:', err.message);
        return res.status(500).json({ error: 'could not store the uploaded image' });
    }

    // req.protocol respects the LAN/tunnel host the request actually came in on.
    const url = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    return res.status(201).json({ url });
});

module.exports = router;
