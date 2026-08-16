-- [ETA-03] Two gaps closed here:
--
-- 1. The client's tracking screen needs the assigned collector's name and
--    phone number, but get_pickup_request_status_for_actor (migration 020)
--    only returned routing/payment fields. Adding collector_full_name and
--    collector_phone_number to the same function — no new route needed,
--    pickupRequests.js already does `SELECT * FROM ...` so the extra
--    columns just show up. Postgres won't let CREATE OR REPLACE change a
--    function's return columns, so the old signature is dropped first.
--
-- 2. Real ETA calculation needs both the client's fixed pickup coordinates
--    (pickup_requests.client_latitude/longitude, migration 006) and the
--    collector's live position (collectors.last_latitude/longitude,
--    migration 031). Narrow SECURITY DEFINER lookup, scoped to the
--    request's own client or its assigned collector.
--
-- The actual write-back goes through record_eta() rather than a plain
-- UPDATE from the route, following the migration-012 lesson: a plain
-- query with no tenant context defaults to 'public' and silently no-ops
-- against a corporate-tenant row.

DROP FUNCTION IF EXISTS get_pickup_request_status_for_actor(INTEGER, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION get_pickup_request_status_for_actor(
    p_request_id INTEGER,
    p_actor_role TEXT,
    p_actor_id INTEGER
)
RETURNS TABLE (
    id INTEGER,
    routing_status routing_status_enum,
    collector_id INTEGER,
    payment_status payment_status_enum,
    collector_arrived_at TIMESTAMP,
    cash_collected_at TIMESTAMP,
    momo_confirmed_at TIMESTAMP,
    has_proof_of_work BOOLEAN,
    collector_full_name VARCHAR(255),
    collector_phone_number VARCHAR(20)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        pr.id,
        pr.routing_status,
        pr.collector_id,
        pr.payment_status,
        pr.collector_arrived_at,
        pr.cash_collected_at,
        pr.momo_confirmed_at,
        EXISTS (SELECT 1 FROM proof_of_works pow WHERE pow.pickup_request_id = pr.id),
        c.full_name,
        c.phone_number
    FROM pickup_requests pr
    LEFT JOIN collectors c ON c.id = pr.collector_id
    WHERE pr.id = p_request_id
      AND ((p_actor_role = 'client' AND pr.client_id = p_actor_id)
        OR (p_actor_role = 'collector' AND pr.collector_id = p_actor_id));
$$;

CREATE OR REPLACE FUNCTION get_eta_inputs_for_request(
    p_request_id INTEGER,
    p_actor_role TEXT,
    p_actor_id INTEGER
)
RETURNS TABLE (
    collector_id INTEGER,
    client_latitude DECIMAL,
    client_longitude DECIMAL,
    collector_latitude DECIMAL,
    collector_longitude DECIMAL,
    average_speed DECIMAL
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        pr.collector_id,
        pr.client_latitude,
        pr.client_longitude,
        c.last_latitude,
        c.last_longitude,
        c.average_speed
    FROM pickup_requests pr
    JOIN collectors c ON c.id = pr.collector_id
    WHERE pr.id = p_request_id
      AND pr.routing_status = 'assigned'
      AND ((p_actor_role = 'client' AND pr.client_id = p_actor_id)
        OR (p_actor_role = 'collector' AND pr.collector_id = p_actor_id));
$$;

CREATE OR REPLACE FUNCTION record_eta(
    p_request_id INTEGER,
    p_collector_id INTEGER,
    p_eta_seconds INTEGER,
    p_distance_meters INTEGER,
    p_speed_kmh DECIMAL
)
RETURNS TABLE (id INTEGER, estimated_arrival_time INTEGER, last_eta_update TIMESTAMP)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO eta_history (pickup_request_id, collector_id, eta_seconds, distance_meters, speed_kmh)
    VALUES (p_request_id, p_collector_id, p_eta_seconds, p_distance_meters, p_speed_kmh);

    RETURN QUERY
    UPDATE pickup_requests
    SET estimated_arrival_time = p_eta_seconds, last_eta_update = now()
    WHERE pickup_requests.id = p_request_id
    RETURNING pickup_requests.id, pickup_requests.estimated_arrival_time, pickup_requests.last_eta_update;
END;
$$;

REVOKE ALL ON FUNCTION get_eta_inputs_for_request(INTEGER, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_eta(INTEGER, INTEGER, INTEGER, INTEGER, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_eta_inputs_for_request(INTEGER, TEXT, INTEGER) TO app_user;
GRANT EXECUTE ON FUNCTION record_eta(INTEGER, INTEGER, INTEGER, INTEGER, DECIMAL) TO app_user;