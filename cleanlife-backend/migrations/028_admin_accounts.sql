-- [ADMIN-IDENTITY-01] Real admin identity model, replacing the shared
-- X-Admin-Key for company/collector management. Two roles:
-- - super_admin: manages companies + issues company_admin accounts
-- - company_admin: manages their own company's corporate collectors,
--   scoped strictly to their own company_id.
-- The static X-Admin-Key stays only for dumpster management (unrelated,
-- out of scope for this change).

CREATE TYPE admin_role_enum AS ENUM ('super_admin', 'company_admin');

CREATE TABLE admins (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            admin_role_enum NOT NULL,
    company_id      INTEGER NULL REFERENCES companies(id),
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_admins_company_id ON admins(company_id);

-- Login needs to find an admin by username before knowing their role —
-- same narrow SECURITY DEFINER pattern as collector/client login lookups.
CREATE OR REPLACE FUNCTION find_admin_by_username(p_username TEXT)
RETURNS TABLE (id INTEGER, username VARCHAR(50), password_hash VARCHAR(255), role admin_role_enum, company_id INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, username, password_hash, role, company_id FROM admins WHERE username = p_username;
$$;

REVOKE ALL ON FUNCTION find_admin_by_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_admin_by_username(TEXT) TO app_user;

GRANT SELECT, INSERT, UPDATE ON admins TO app_user;
GRANT USAGE, SELECT ON SEQUENCE admins_id_seq TO app_user;