// models/ratingModel.js
const pool = require('../db'); // adjust this path if your db.js lives somewhere else

async function hasExistingRating(pickupRequestId) {
  const result = await pool.query(
    'SELECT id FROM ratings WHERE pickup_request_id = $1',
    [pickupRequestId]
  );
  return result.rows.length > 0;
}

async function getPickupForRating(pickupRequestId) {
  const result = await pool.query(
    `SELECT id, status, client_id, collector_id
     FROM pickup_requests
     WHERE id = $1`,
    [pickupRequestId]
  );
  return result.rows[0] || null;
}

async function createRating({ pickupRequestId, clientId, collectorId, stars, comment }) {
  const result = await pool.query(
    `INSERT INTO ratings (pickup_request_id, client_id, collector_id, stars, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, pickup_request_id, client_id, collector_id, stars, comment, created_at`,
    [pickupRequestId, clientId, collectorId, stars, comment || null]
  );
  return result.rows[0];
}

async function getCollectorAverageRating(collectorId) {
  const result = await pool.query(
    `SELECT
       ROUND(AVG(stars)::numeric, 2) AS average_rating,
       COUNT(*)::int AS total_ratings
     FROM ratings
     WHERE collector_id = $1`,
    [collectorId]
  );
  const row = result.rows[0];
  return {
    averageRating: row.average_rating ? parseFloat(row.average_rating) : 0,
    totalRatings: row.total_ratings,
  };
}

async function getRatingsForCollector(collectorId) {
  const result = await pool.query(
    `SELECT id, stars, comment, client_id, pickup_request_id, created_at
     FROM ratings
     WHERE collector_id = $1
     ORDER BY created_at DESC`,
    [collectorId]
  );
  return result.rows;
}

async function getRatingByPickup(pickupRequestId) {
  const result = await pool.query(
    'SELECT * FROM ratings WHERE pickup_request_id = $1',
    [pickupRequestId]
  );
  return result.rows[0] || null;
}

module.exports = {
  hasExistingRating,
  getPickupForRating,
  createRating,
  getCollectorAverageRating,
  getRatingsForCollector,
  getRatingByPickup,
};