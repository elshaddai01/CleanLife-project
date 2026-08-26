-- [MAIL-04] Registration now requires a real email OTP before a client can
-- log in — enforced here, not just in the mobile UI, so it can't be
-- bypassed by calling the API directly (same reasoning as [FLOW-02] in
-- migration 035). Grandfather every account that predates this gate: they
-- registered when verification wasn't required or enforced, so locking
-- them out now would break existing test/demo accounts for no reason.
UPDATE clients SET email_verified = true WHERE email_verified = false;

-- find_client_by_phone (migration 013) didn't return email_verified —
-- auth.js's login route needs it to enforce the gate.
DROP FUNCTION IF EXISTS find_client_by_phone(VARCHAR);

CREATE OR REPLACE FUNCTION find_client_by_phone(p_phone VARCHAR)
RETURNS TABLE (id INTEGER, name VARCHAR(100), phone_number VARCHAR(20), password_hash VARCHAR(255), company_id INTEGER, email_verified BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, name, phone_number, password_hash, company_id, email_verified FROM clients WHERE phone_number = p_phone;
$$;

REVOKE ALL ON FUNCTION find_client_by_phone(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_client_by_phone(VARCHAR) TO app_user;
