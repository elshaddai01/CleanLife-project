-- backend/migrations/add_eta_fields.sql

-- Add ETA fields to pickup_requests
ALTER TABLE pickup_requests 
ADD COLUMN IF NOT EXISTS estimated_arrival_time INTEGER,
ADD COLUMN IF NOT EXISTS last_eta_update TIMESTAMP;

-- Add location fields to collectors
ALTER TABLE collectors 
ADD COLUMN IF NOT EXISTS current_latitude DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS current_longitude DECIMAL(11,8),
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP,
ADD COLUMN IF NOT EXISTS average_speed DECIMAL(5,2) DEFAULT 20;

-- Create ETA history table
CREATE TABLE IF NOT EXISTS eta_history (
    id SERIAL PRIMARY KEY,
    pickup_request_id INTEGER REFERENCES pickup_requests(id) ON DELETE CASCADE,
    collector_id INTEGER REFERENCES collectors(id) ON DELETE CASCADE,
    eta_seconds INTEGER,
    distance_meters INTEGER,
    speed_kmh DECIMAL(5,2),
    calculated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_eta_history_request ON eta_history(pickup_request_id);
CREATE INDEX IF NOT EXISTS idx_eta_history_collector ON eta_history(collector_id);
CREATE INDEX IF NOT EXISTS idx_eta_history_calculated ON eta_history(calculated_at);
CREATE INDEX IF NOT EXISTS idx_pickup_requests_eta ON pickup_requests(estimated_arrival_time) 
WHERE estimated_arrival_time IS NOT NULL;