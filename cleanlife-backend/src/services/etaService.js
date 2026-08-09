// backend/src/services/etaService.js
const { pool } = require('../db/pool');

// Constants
const AVERAGE_DRIVING_SPEED = 30; // km/h in urban areas

class ETAService {
    /**
     * Calculate distance between two coordinates using Haversine formula
     * @returns {number} Distance in meters
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const toRad = (deg) => deg * Math.PI / 180;

        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    }

    /**
     * Calculate ETA in seconds based on distance and speed
     */
    calculateETA(distanceMeters, speedKmh = AVERAGE_DRIVING_SPEED) {
        const speedMs = speedKmh / 3.6; // Convert km/h to m/s
        return Math.round(distanceMeters / speedMs);
    }

    /**
     * Format ETA as human-readable string
     */
    formatETA(seconds) {
        if (seconds < 0) return 'Calculating...';
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        }
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }

    /**
     * Get collector's current location
     */
    async getCollectorLocation(collectorId) {
        const result = await pool.query(
            `SELECT current_latitude, current_longitude, 
                    last_location_update, average_speed
             FROM collectors
             WHERE id = $1`,
            [collectorId]
        );
        return result.rows[0] || null;
    }

    /**
     * Get pickup request destination
     */
    async getPickupLocation(pickupRequestId) {
        const result = await pool.query(
            `SELECT id, client_latitude, client_longitude, 
                    collector_id, routing_status
             FROM pickup_requests
             WHERE id = $1`,
            [pickupRequestId]
        );
        return result.rows[0] || null;
    }

    /**
     * Update collector's location
     */
    async updateCollectorLocation(collectorId, latitude, longitude) {
        const result = await pool.query(
            `UPDATE collectors
             SET current_latitude = $2, 
                 current_longitude = $3,
                 last_location_update = NOW()
             WHERE id = $1
             RETURNING id, current_latitude, current_longitude,
                       last_location_update, average_speed`,
            [collectorId, latitude, longitude]
        );
        return result.rows[0];
    }

    /**
     * Calculate and update ETA for a pickup request
     * @returns {Object} { eta_seconds, distance_meters, speed_kmh, formatted_eta }
     */
    async calculateAndUpdateETA(pickupRequestId) {
        try {
            const pickup = await this.getPickupLocation(pickupRequestId);
            if (!pickup) {
                throw new Error('Pickup request not found');
            }

            if (!pickup.collector_id) {
                throw new Error('No collector assigned to this pickup');
            }

            const collector = await this.getCollectorLocation(pickup.collector_id);
            if (!collector || !collector.current_latitude || !collector.current_longitude) {
                throw new Error('Collector location not available');
            }

            const distanceMeters = this.calculateDistance(
                collector.current_latitude,
                collector.current_longitude,
                pickup.client_latitude,
                pickup.client_longitude
            );

            const speed = collector.average_speed || AVERAGE_DRIVING_SPEED;
            const etaSeconds = this.calculateETA(distanceMeters, speed);

            await pool.query(
                `UPDATE pickup_requests
                 SET estimated_arrival_time = $2,
                     last_eta_update = NOW()
                 WHERE id = $1`,
                [pickupRequestId, etaSeconds]
            );

            await pool.query(
                `INSERT INTO eta_history 
                 (pickup_request_id, collector_id, eta_seconds, distance_meters, speed_kmh)
                 VALUES ($1, $2, $3, $4, $5)`,
                [pickupRequestId, pickup.collector_id, etaSeconds, distanceMeters, speed]
            );

            return {
                pickup_request_id: pickupRequestId,
                eta_seconds: etaSeconds,
                formatted_eta: this.formatETA(etaSeconds),
                distance_meters: distanceMeters,
                distance_km: (distanceMeters / 1000).toFixed(2),
                speed_kmh: speed,
                collector_lat: collector.current_latitude,
                collector_lng: collector.current_longitude,
                client_lat: pickup.client_latitude,
                client_lng: pickup.client_longitude,
            };

        } catch (error) {
            console.error('ETA calculation error:', error);
            throw error;
        }
    }

    /**
     * Get current ETA for a pickup request
     */
    async getCurrentETA(pickupRequestId) {
        const result = await pool.query(
            `SELECT 
                id,
                estimated_arrival_time,
                last_eta_update,
                EXTRACT(EPOCH FROM (NOW() - last_eta_update)) AS eta_age_seconds
             FROM pickup_requests
             WHERE id = $1`,
            [pickupRequestId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const eta = result.rows[0];
        
        if (eta.eta_age_seconds > 60) {
            return this.calculateAndUpdateETA(pickupRequestId);
        }

        const etaSeconds = Math.max(0, eta.estimated_arrival_time - Math.round(eta.eta_age_seconds || 0));

        return {
            pickup_request_id: pickupRequestId,
            eta_seconds: etaSeconds,
            formatted_eta: this.formatETA(etaSeconds),
            last_updated: eta.last_eta_update,
        };
    }

    /**
     * Get ETA history for a pickup request
     */
    async getETAHistory(pickupRequestId, limit = 50) {
        const result = await pool.query(
            `SELECT *
             FROM eta_history
             WHERE pickup_request_id = $1
             ORDER BY calculated_at DESC
             LIMIT $2`,
            [pickupRequestId, limit]
        );
        return result.rows;
    }
}

module.exports = new ETAService();