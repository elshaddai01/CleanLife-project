-- [AUTH-01] Client login switches from phone_number+password to
-- email+password (better identifier — phone reuse/formatting issues are
-- common, email is already required and verified at registration). Email
-- had no uniqueness constraint before this — added here now that it's
-- becoming a login/reset credential, not just contact info. The 5
-- pre-existing duplicate accounts this would have conflicted with were
-- resolved (older duplicates removed, newest per email kept) before this
-- migration runs.
ALTER TABLE clients ADD CONSTRAINT clients_email_key UNIQUE (email);

CREATE OR REPLACE FUNCTION find_client_by_email(p_email VARCHAR)
RETURNS TABLE (id INTEGER, name VARCHAR(100), phone_number VARCHAR(20), password_hash VARCHAR(255), company_id INTEGER, email_verified BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, name, phone_number, password_hash, company_id, email_verified FROM clients WHERE email = p_email;
$$;

REVOKE ALL ON FUNCTION find_client_by_email(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_client_by_email(VARCHAR) TO app_user;
