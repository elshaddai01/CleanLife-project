CREATE OR REPLACE FUNCTION cancel_pickup_request(p_request_id INTEGER, p_client_id INTEGER)
RETURNS TABLE (id INTEGER, routing_status routing_status_enum)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE pickup_requests
    SET routing_status = 'cancelled',
        admin_hold_expires_at = NULL
    WHERE pickup_requests.id = p_request_id
      AND pickup_requests.client_id = p_client_id
      AND pickup_requests.collector_id IS NULL
      AND pickup_requests.routing_status IN ('searching_corporate', 'admin_hold', 'broadcast_public')
    RETURNING pickup_requests.id, pickup_requests.routing_status;
$$;

GRANT EXECUTE ON FUNCTION cancel_pickup_request(INTEGER, INTEGER) TO app_user;