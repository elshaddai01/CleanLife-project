const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// [UPLOAD-01] SIMULATED storage — real system would upload to S3/GCS/Cloudinary
// and return a public URL. For now, return the base64 as a data URL so the
// rest of the proof-of-work flow (EXIF check, dumpster geofence) has a
// working photo_storage_url to store, matching the SIMULATED pattern used
// for MoMo payments elsewhere in this backend.
router.post('/proof', requireAuth, async (req, res) => {
    const { base64, mime_type } = req.body;
    if (!base64 || !mime_type) {
        return res.status(400).json({ error: 'base64 and mime_type are required' });
    }
    if (!['image/jpeg', 'image/png'].includes(mime_type)) {
        return res.status(400).json({ error: 'mime_type must be image/jpeg or image/png' });
    }
    const url = `data:${mime_type};base64,${base64}`;
    return res.status(201).json({ url });
});

module.exports = router;