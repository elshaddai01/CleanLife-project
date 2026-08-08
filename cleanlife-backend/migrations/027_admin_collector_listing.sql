-- [ADMIN-01] Company portal needs to list its own fleet + KYC status.
-- No real admin identity model exists yet (still gated by X-Admin-Key,
-- same interim measure used everywhere else in this backend) — this stays
-- a narrow SECURITY DEFINER lookup scoped by company_id, same reasoning as
-- every other cross-tenant admin function in this project.
CREATE OR REPLACE FUNCTION admin_list_collectors_by_company(p_company_id INTEGER)
RETURNS TABLE (
    id INTEGER, username VARCHAR(50), full_name VARCHAR(100), email VARCHAR(255),
    phone_number VARCHAR(20), collector_type collector_type_enum,
    subscription_tier subscription_tier_enum, kyc_status kyc_status_enum, created_at TIMESTAMP
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, username, full_name, email, phone_number, collector_type,
           subscription_tier, kyc_status, created_at
    FROM collectors
    WHERE company_id = p_company_id
    ORDER BY created_at DESC;
$$;

REVOKE ALL ON FUNCTION admin_list_collectors_by_company(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_collectors_by_company(INTEGER) TO app_user;