-- 043_restore_payment_method_in_status_for_actor.sql
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
    payment_method payment_method_enum,
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
        pr.payment_method,
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

GRANT EXECUTE ON FUNCTION get_pickup_request_status_for_actor(INTEGER, TEXT, INTEGER) TO app_user;