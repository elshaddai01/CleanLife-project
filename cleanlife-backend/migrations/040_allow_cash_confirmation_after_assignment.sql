-- Cash confirmation is the collector's handoff confirmation. Do not require
-- a separate arrival timestamp: the assigned collector is already the actor
-- at the pickup, and escrow remains locked until verified disposal proof.

CREATE OR REPLACE FUNCTION confirm_cash_collected(p_request_id INTEGER, p_collector_id INTEGER)
RETURNS TABLE (id INTEGER, cash_collected_at TIMESTAMP)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE pickup_requests
    SET cash_collected_at = now()
    WHERE pickup_requests.id = p_request_id
      AND pickup_requests.collector_id = p_collector_id
      AND pickup_requests.routing_status = 'assigned'
      AND pickup_requests.payment_method = 'CASH'
      AND pickup_requests.cash_collected_at IS NULL;

    RETURN QUERY
    SELECT pickup_requests.id, pickup_requests.cash_collected_at
    FROM pickup_requests
    WHERE pickup_requests.id = p_request_id
      AND pickup_requests.collector_id = p_collector_id
      AND pickup_requests.payment_method = 'CASH'
      AND pickup_requests.cash_collected_at IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_cash_collected(INTEGER, INTEGER) TO app_user;
