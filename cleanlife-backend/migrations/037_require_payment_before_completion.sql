DROP FUNCTION IF EXISTS complete_pickup_request(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION complete_pickup_request(p_request_id INTEGER, p_collector_id INTEGER)
RETURNS TABLE (id INTEGER, routing_status routing_status_enum, payment_status payment_status_enum, estimated_price_fcfa DECIMAL)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE pickup_requests
    SET routing_status = 'completed', payment_status = 'COMPLETED'
    WHERE pickup_requests.id = p_request_id
      AND pickup_requests.collector_id = p_collector_id
      AND pickup_requests.routing_status = 'assigned'
      AND (
          (pickup_requests.payment_method = 'CASH' AND pickup_requests.cash_collected_at IS NOT NULL)
          OR (pickup_requests.payment_method = 'MOMO' AND pickup_requests.momo_confirmed_at IS NOT NULL)
      )
    RETURNING pickup_requests.id, pickup_requests.routing_status, pickup_requests.payment_status, pickup_requests.estimated_price_fcfa;
$$;

GRANT EXECUTE ON FUNCTION complete_pickup_request(INTEGER, INTEGER) TO app_user;