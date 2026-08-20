-- [FLOW-01] REGRESSION FIX: migration 033 redefined
-- get_pickup_request_status_for_actor and accidentally dropped
-- payment_method from its return columns (it existed in migration 020's
-- version). apiClient.ts's getStatus() type still expects it — this
-- silently returned undefined on mobile ever since 033 ran. Restoring it.
--
-- [FLOW-02] New rule: for MoMo payments, the client must actively confirm
-- payment (a real button tap, calling client_confirm_momo_payment below)
-- before the collector can submit proof-of-work. This is enforced in the
-- DATABASE (insert_proof_of_work's WHERE clause), not just hidden in the
-- UI, so it can't be bypassed by calling the API directly.
--
-- Today this is a "demo" trigger — the client taps a button and it's
-- immediately confirmed. When real MTN/Orange MoMo API integration lands
-- (USSD prompt-and-confirm), that integration would call this exact same
-- underlying confirm path instead of the demo button — the gate and the
-- collector notification stay the same either way.

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

-- Client-triggered MoMo confirmation, scoped to their own request. Wraps
-- confirm_momo_payment (migration 010) with an ownership + payment-method
-- check baked in, so the route doesn't need to trust the caller's input.
CREATE OR REPLACE FUNCTION client_confirm_momo_payment(p_request_id INTEGER, p_client_id INTEGER)
RETURNS TABLE (id INTEGER, momo_confirmed_at TIMESTAMP, collector_id INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE pickup_requests
    SET momo_confirmed_at = now()
    WHERE pickup_requests.id = p_request_id
      AND pickup_requests.client_id = p_client_id
      AND pickup_requests.payment_method = 'MOMO'
      AND pickup_requests.collector_arrived_at IS NOT NULL
      AND pickup_requests.momo_confirmed_at IS NULL
    RETURNING pickup_requests.id, pickup_requests.momo_confirmed_at, pickup_requests.collector_id;
$$;

-- [FLOW-03] The actual gate: proof-of-work can only be inserted once
-- payment is confirmed by EITHER path (cash_collected_at for CASH,
-- momo_confirmed_at for MOMO). Redefined from migration 011 to add this
-- one extra condition — everything else identical.
DROP FUNCTION IF EXISTS insert_proof_of_work(INTEGER, INTEGER, VARCHAR, DECIMAL, DECIMAL, verification_method_enum, INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION insert_proof_of_work(
    p_request_id INTEGER,
    p_collector_id INTEGER,
    p_photo_url VARCHAR,
    p_exif_lat DECIMAL,
    p_exif_lng DECIMAL,
    p_verification_method verification_method_enum,
    p_dumpster_id INTEGER,
    p_is_verified BOOLEAN
)
RETURNS TABLE (id INTEGER, is_verified BOOLEAN, verification_method verification_method_enum, dumpster_id INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO proof_of_works
        (pickup_request_id, photo_storage_url, exif_latitude, exif_longitude,
         verification_method, dumpster_id, is_verified)
    SELECT p_request_id, p_photo_url, p_exif_lat, p_exif_lng,
           p_verification_method, p_dumpster_id, p_is_verified
    WHERE EXISTS (
        SELECT 1 FROM pickup_requests
        WHERE pickup_requests.id = p_request_id
          AND pickup_requests.collector_id = p_collector_id
          AND pickup_requests.routing_status = 'assigned'
          AND (pickup_requests.cash_collected_at IS NOT NULL OR pickup_requests.momo_confirmed_at IS NOT NULL)
    )
    RETURNING proof_of_works.id, proof_of_works.is_verified,
              proof_of_works.verification_method, proof_of_works.dumpster_id;
$$;

REVOKE ALL ON FUNCTION client_confirm_momo_payment(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION client_confirm_momo_payment(INTEGER, INTEGER) TO app_user;
GRANT EXECUTE ON FUNCTION insert_proof_of_work(INTEGER, INTEGER, VARCHAR, DECIMAL, DECIMAL, verification_method_enum, INTEGER, BOOLEAN) TO app_user;