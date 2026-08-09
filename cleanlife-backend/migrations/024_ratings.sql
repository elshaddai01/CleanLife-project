
-- [RATING-01] Client and Collector ratings for completed pickups

CREATE TABLE ratings (
    id SERIAL PRIMARY KEY,

    pickup_request_id INTEGER NOT NULL
        REFERENCES pickup_requests(id)
        ON DELETE CASCADE,

    client_id INTEGER NOT NULL
        REFERENCES clients(id),

    collector_id INTEGER NOT NULL
        REFERENCES collectors(id),

    rated_by_role VARCHAR(20) NOT NULL
        CHECK (rated_by_role IN ('client', 'collector')),

    rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),

    comment TEXT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Each participant can rate only once per pickup.
    CONSTRAINT unique_rating_per_participant
        UNIQUE (pickup_request_id, rated_by_role)
);

CREATE INDEX idx_ratings_pickup_request_id
    ON ratings(pickup_request_id);

CREATE INDEX idx_ratings_client_id
    ON ratings(client_id);

CREATE INDEX idx_ratings_collector_id
    ON ratings(collector_id);

