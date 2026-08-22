ALTER TABLE pickup_requests
ADD COLUMN IF NOT EXISTS estimated_arrival_time INTEGER,
ADD COLUMN IF NOT EXISTS last_eta_update TIMESTAMP;

ALTER TABLE collectors
ADD COLUMN IF NOT EXISTS average_speed DECIMAL(5,2) DEFAULT 20;

CREATE TABLE IF NOT EXISTS eta_history (
    id SERIAL PRIMARY KEY,
    pickup_request_id INTEGER REFERENCES pickup_requests(id) ON DELETE CASCADE,
    collector_id INTEGER REFERENCES collectors(id) ON DELETE CASCADE,
    eta_seconds INTEGER,
    distance_meters INTEGER,
    speed_kmh DECIMAL(5,2),
    calculated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eta_history_request ON eta_history(pickup_request_id);
CREATE INDEX IF NOT EXISTS idx_eta_history_collector ON eta_history(collector_id);