-- [LOC-01] Collector live location — foreground-only, throttled updates
-- while a job is actively in progress. NOT continuous background tracking
-- (violates SRS 5's battery/data budgets — see Heartbeat & Zones design in
-- migration 005). Only the currently assigned collector on a specific
-- pickup_request may write here, and only the client on that same request
-- may read it, enforced structurally below rather than left to app logic.

ALTER TABLE collectors
    ADD COLUMN last_latitude DECIMAL(9,6) NULL,
    ADD COLUMN last_longitude DECIMAL(9,6) NULL,
    ADD COLUMN last_location_at TIMESTAMPTZ NULL;

-- Collector updates their own coordinates. Scoped by "am I the assigned
-- collector on an active (assigned) request" — same reasoning as the
-- payment/proof-of-work functions in migrations 010/011: a narrow write
-- path rather than a raw UPDATE through RLS.
CREATE OR REPLACE FUNCTION update_collector_location(p_collector_id INTEGER, p_latitude DECIMAL, p_longitude DECIMAL)
RETURNS TABLE (id INTEGER, last_latitude DECIMAL, last_longitude DECIMAL, last_location_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE collectors
    SET last_latitude = p_latitude,
        last_longitude = p_longitude,
        last_location_at = now()
    WHERE collectors.id = p_collector_id
      AND EXISTS (
          SELECT 1 FROM pickup_requests
          WHERE pickup_requests.collector_id = p_collector_id
            AND pickup_requests.routing_status = 'assigned'
      )
    RETURNING collectors.id, collectors.last_latitude, collectors.last_longitude, collectors.last_location_at;
$$;

-- Client reads their assigned collector's last known coordinates, scoped
-- to a specific request they own — never a general collector lookup.
CREATE OR REPLACE FUNCTION get_collector_location_for_request(p_request_id INTEGER, p_client_id INTEGER)
RETURNS TABLE (collector_id INTEGER, last_latitude DECIMAL, last_longitude DECIMAL, last_location_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT c.id, c.last_latitude, c.last_longitude, c.last_location_at
    FROM pickup_requests pr
    JOIN collectors c ON c.id = pr.collector_id
    WHERE pr.id = p_request_id
      AND pr.client_id = p_client_id
      AND pr.routing_status = 'assigned';
$$;

REVOKE ALL ON FUNCTION update_collector_location(INTEGER, DECIMAL, DECIMAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_collector_location_for_request(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_collector_location(INTEGER, DECIMAL, DECIMAL) TO app_user;
GRANT EXECUTE ON FUNCTION get_collector_location_for_request(INTEGER, INTEGER) TO app_user;