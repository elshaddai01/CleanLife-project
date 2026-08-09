// routes/ratingRoutes.js
const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController'); // adjust path if needed

// Submit a new rating for a completed pickup
router.post('/ratings', ratingController.submitRating);

// Get a collector's average rating + total count
router.get('/collectors/:collectorId/rating', ratingController.getCollectorAverage);

// Get all ratings/comments for a collector
router.get('/collectors/:collectorId/ratings', ratingController.getCollectorRatings);

// Check whether a specific pickup has been rated yet
router.get('/pickups/:pickupRequestId/rating', ratingController.getRatingForPickup);

module.exports = router;