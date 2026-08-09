// controllers/ratingController.js
const ratingModel = require('../models/ratingModel'); // adjust path if your models folder is elsewhere

async function submitRating(req, res) {
  try {
    const { pickupRequestId, clientId, stars, comment } = req.body;

    // 1. Basic validation
    if (!pickupRequestId || !clientId || stars === undefined) {
      return res.status(400).json({
        error: 'pickupRequestId, clientId, and stars are required.',
      });
    }

    const starsNum = Number(stars);
    if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
      return res.status(400).json({ error: 'stars must be an integer between 1 and 5.' });
    }

    // 2. Fetch the pickup request
    const pickup = await ratingModel.getPickupForRating(pickupRequestId);
    if (!pickup) {
      return res.status(404).json({ error: 'Pickup request not found.' });
    }

    // 3. Must be completed before it can be rated
    if (pickup.status !== 'completed') {
      return res.status(400).json({
        error: `Pickup must be completed before it can be rated. Current status: ${pickup.status}`,
      });
    }

    // 4. Only the client who owns this pickup can rate it
    if (pickup.client_id !== clientId) {
      return res.status(403).json({ error: 'You are not authorized to rate this pickup.' });
    }

    // 5. Prevent duplicate ratings
    const alreadyRated = await ratingModel.hasExistingRating(pickupRequestId);
    if (alreadyRated) {
      return res.status(409).json({ error: 'This pickup has already been rated.' });
    }

    // 6. Create the rating — collector_id comes from the pickup record, not the client
    const newRating = await ratingModel.createRating({
      pickupRequestId,
      clientId,
      collectorId: pickup.collector_id,
      stars: starsNum,
      comment,
    });

    return res.status(201).json({ message: 'Rating submitted successfully.', rating: newRating });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This pickup has already been rated.' });
    }
    console.error('submitRating error:', err);
    return res.status(500).json({ error: 'Something went wrong submitting the rating.' });
  }
}

async function getCollectorAverage(req, res) {
  try {
    const { collectorId } = req.params;
    const data = await ratingModel.getCollectorAverageRating(collectorId);
    return res.json(data);
  } catch (err) {
    console.error('getCollectorAverage error:', err);
    return res.status(500).json({ error: 'Something went wrong fetching the average rating.' });
  }
}

async function getCollectorRatings(req, res) {
  try {
    const { collectorId } = req.params;
    const ratings = await ratingModel.getRatingsForCollector(collectorId);
    return res.json(ratings);
  } catch (err) {
    console.error('getCollectorRatings error:', err);
    return res.status(500).json({ error: 'Something went wrong fetching ratings.' });
  }
}

async function getRatingForPickup(req, res) {
  try {
    const { pickupRequestId } = req.params;
    const rating = await ratingModel.getRatingByPickup(pickupRequestId);
    return res.json(rating);
  } catch (err) {
    console.error('getRatingForPickup error:', err);
    return res.status(500).json({ error: 'Something went wrong fetching the rating.' });
  }
}

module.exports = {
  submitRating,
  getCollectorAverage,
  getCollectorRatings,
  getRatingForPickup,
};