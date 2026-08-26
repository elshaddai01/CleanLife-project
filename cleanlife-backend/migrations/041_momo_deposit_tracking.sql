-- [MOMO-01] Real pawaPay integration needs to remember which pawaPay
-- transaction (depositId) belongs to which pickup request, so the client
-- can later ask "has this specific payment completed yet?"

ALTER TABLE pickup_requests ADD COLUMN IF NOT EXISTS momo_deposit_id TEXT NULL;

-- Collector's device stores the depositId right after pawaPay accepts the
-- payment request (see /arrive route). Scoped to the assigned collector,
-- same self-ownership pattern as every other collector-side write here.
CREATE OR REPLACE FUNCTION store_momo_deposit_id(
    p_request_id INTEGER,
    p_collector_id INTEGER,
    p_deposit_id TEXT
)
RETURNS TABLE (id INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE pickup_requests
    SET momo_deposit_id = p_deposit_id
    WHERE pickup_requests.id = p_request_id
      AND pickup_requests.collector_id = p_collector_id
      AND pickup_requests.payment_method = 'MOMO'
    RETURNING pickup_requests.id;
$$;

-- Client's device looks this up when tapping "Validate Payment", so the
-- route knows which pawaPay transaction to check the real status of.
CREATE OR REPLACE FUNCTION get_momo_deposit_id_for_request(
    p_request_id INTEGER,
    p_client_id INTEGER
)
RETURNS TABLE (momo_deposit_id TEXT, collector_id INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT pickup_requests.momo_deposit_id, pickup_requests.collector_id
    FROM pickup_requests
    WHERE pickup_requests.id = p_request_id
      AND pickup_requests.client_id = p_client_id
      AND pickup_requests.payment_method = 'MOMO';
$$;

REVOKE ALL ON FUNCTION store_momo_deposit_id(INTEGER, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_momo_deposit_id_for_request(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION store_momo_deposit_id(INTEGER, INTEGER, TEXT) TO app_user;
GRANT EXECUTE ON FUNCTION get_momo_deposit_id_for_request(INTEGER, INTEGER) TO app_user;