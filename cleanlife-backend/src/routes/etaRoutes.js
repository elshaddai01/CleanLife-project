// backend/src/routes/etaRoutes.js
const express = require('express');
const etaService = require('../services/etaService');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * @route POST /eta/:id/update-location
 * @desc Update collector's location and recalculate ETA
 * Body: { latitude, longitude }
 */
router.post('/:id/update-location', 
    requireAuth, 
    requireRole('collector'), 
    async (req, res) => {
        const pickupRequestId = parseInt(req.params.id);
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ 
                error: 'latitude and longitude are required' 
            });
        }

        if (latitude < -90 || latitude > 90) {
            return res.status(400).json({ error: 'Invalid latitude' });
        }
        if (longitude < -180 || longitude > 180) {
            return res.status(400).json({ error: 'Invalid longitude' });
        }

        try {
            const collector = await etaService.updateCollectorLocation(
                req.collector.sub, 
                latitude, 
                longitude
            );

            const etaResult = await etaService.calculateAndUpdateETA(pickupRequestId);

            return res.json({
                success: true,
                collector_location: {
                    latitude: collector.current_latitude,
                    longitude: collector.current_longitude,
                    updated_at: collector.last_location_update,
                },
                eta: {
                    seconds: etaResult.eta_seconds,
                    formatted: etaResult.formatted_eta,
                    distance_km: etaResult.distance_km,
                },
            });

        } catch (error) {
            console.error('Location update error:', error);
            return res.status(500).json({ 
                error: error.message || 'Failed to update location' 
            });
        }
    }
);

/**
 * @route GET /eta/:id
 * @desc Get current ETA for a pickup request
 */
router.get('/:id', requireAuth, async (req, res) => {
    const pickupRequestId = parseInt(req.params.id);

    try {
        const eta = await etaService.getCurrentETA(pickupRequestId);
        
        if (!eta) {
            return res.status(404).json({ error: 'ETA not found' });
        }

        return res.json(eta);
    } catch (error) {
        console.error('Get ETA error:', error);
        return res.status(500).json({ 
            error: 'Failed to get ETA' 
        });
    }
});

/**
 * @route GET /eta/:id/history
 * @desc Get ETA history for analytics
 */
router.get('/:id/history', 
    requireAuth, 
    requireRole('collector'), 
    async (req, res) => {
        const pickupRequestId = parseInt(req.params.id);
        const limit = parseInt(req.query.limit) || 50;

        try {
            const history = await etaService.getETAHistory(pickupRequestId, limit);
            return res.json({ history });
        } catch (error) {
            console.error('Get ETA history error:', error);
            return res.status(500).json({ 
                error: 'Failed to get ETA history' 
            });
        }
    }
);

module.exports = router;