-- [DISP-10] Corporate collectors had no self-service accept path — only
-- independent collectors could claim via claim_pickup_request (scoped to
-- broadcast_public rows), and the only route touching searching_corporate
-- rows was the admin-key-gated manual /assign. This closes that gap: a
-- corporate collector can claim their own company's still-open
-- searching_corporate request directly, same atomic-guard pattern as the
-- independent claim function.
CREATE OR REPLACE FUNCTION claim_corporate_pickup_request(p_request_id INTEGER, p_collector_id INTEGER)
RETURNS TABLE (id INTEGER, routing_status routing_status_enum, collector_id INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE pickup_requests AS pr
    SET routing_status = 'assigned', collector_id = p_collector_id
    FROM collectors AS c, clients AS cl
    WHERE pr.id = p_request_id
      AND pr.collector_id IS NULL
      AND pr.routing_status = 'searching_corporate'
      AND c.id = p_collector_id
      AND c.collector_type = 'corporate'
      AND cl.id = pr.client_id
      AND cl.company_id = c.company_id
    RETURNING pr.id, pr.routing_status, pr.collector_id;
$$;

REVOKE ALL ON FUNCTION claim_corporate_pickup_request(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_corporate_pickup_request(INTEGER, INTEGER) TO app_user;