-- [PAYOUT-07] Company portal's Wallet module needs to show each collector's
-- current balance next to the payout form (so the admin can see who's
-- already been paid vs still pending) — admin_list_collectors_by_company
-- (migration 027) didn't return it.
DROP FUNCTION IF EXISTS admin_list_collectors_by_company(INTEGER);

CREATE OR REPLACE FUNCTION admin_list_collectors_by_company(p_company_id INTEGER)
RETURNS TABLE (
    id INTEGER, username VARCHAR(50), full_name VARCHAR(100), email VARCHAR(255),
    phone_number VARCHAR(20), collector_type collector_type_enum,
    subscription_tier subscription_tier_enum, kyc_status kyc_status_enum, created_at TIMESTAMP,
    balance DECIMAL
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, username, full_name, email, phone_number, collector_type,
           subscription_tier, kyc_status, created_at, balance
    FROM collectors
    WHERE company_id = p_company_id
    ORDER BY created_at DESC;
$$;

REVOKE ALL ON FUNCTION admin_list_collectors_by_company(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_collectors_by_company(INTEGER) TO app_user;
