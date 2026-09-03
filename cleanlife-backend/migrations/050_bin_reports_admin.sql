-- [BIN-06] Super-admin bin-reports queries, split attributed vs anonymous
-- per spec. API-only for now — no super-admin-portal UI page consumes
-- these yet (same "flag it, don't build the UI" posture as payouts.js's
-- company-balance/payout endpoints when they first landed).
CREATE OR REPLACE FUNCTION admin_get_attributed_bin_reports()
RETURNS TABLE (
    id INTEGER, dumpster_id INTEGER, report_type report_type_enum,
    latitude DECIMAL, longitude DECIMAL, photo_url VARCHAR,
    reporter_role reporter_role_enum, reporter_id INTEGER,
    reporter_name VARCHAR, created_at TIMESTAMP
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT br.id, br.dumpster_id, br.report_type, br.latitude, br.longitude, br.photo_url,
           br.reporter_role, br.reporter_id,
           CASE br.reporter_role
               WHEN 'client' THEN (SELECT c.name FROM clients c WHERE c.id = br.reporter_id)
               WHEN 'collector' THEN (SELECT co.full_name FROM collectors co WHERE co.id = br.reporter_id)
               ELSE NULL
           END::VARCHAR AS reporter_name,
           br.created_at
    FROM bin_reports br
    WHERE br.reporter_id IS NOT NULL
    ORDER BY br.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION admin_get_anonymous_bin_reports()
RETURNS TABLE (
    id INTEGER, dumpster_id INTEGER, report_type report_type_enum,
    latitude DECIMAL, longitude DECIMAL, photo_url VARCHAR, created_at TIMESTAMP
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT br.id, br.dumpster_id, br.report_type, br.latitude, br.longitude, br.photo_url, br.created_at
    FROM bin_reports br
    WHERE br.reporter_id IS NULL
    ORDER BY br.created_at DESC;
$$;

REVOKE ALL ON FUNCTION admin_get_attributed_bin_reports() FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_get_anonymous_bin_reports() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_attributed_bin_reports() TO app_user;
GRANT EXECUTE ON FUNCTION admin_get_anonymous_bin_reports() TO app_user;
