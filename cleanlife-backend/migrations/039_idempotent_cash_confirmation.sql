-- Repeating the collector's cash-confirmation request should return the
-- existing confirmation instead of looking like an ownership/payment error.
-- This remains a handoff timestamp only; escrow release still requires proof.

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
      AND pickup_requests.collector_arrived_at IS NOT NULL
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
