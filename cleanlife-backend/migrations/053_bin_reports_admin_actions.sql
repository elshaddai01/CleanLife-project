-- [BIN-27] Filterable versions of the two report queries from migration
-- 050 — NULL for any filter param means "don't filter on this." Redefined
-- (not altered in place) since the return signature changes.
DROP FUNCTION IF EXISTS admin_get_attributed_bin_reports();

CREATE OR REPLACE FUNCTION admin_get_attributed_bin_reports(
    p_neighborhood TEXT DEFAULT NULL,
    p_status bin_report_review_status_enum DEFAULT NULL,
    p_date_from TIMESTAMP DEFAULT NULL,
    p_date_to TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
    id INTEGER, dumpster_id INTEGER, report_type report_type_enum,
    latitude DECIMAL, longitude DECIMAL, photo_url VARCHAR,
    reporter_role reporter_role_enum, reporter_id INTEGER,
    reporter_name VARCHAR, neighborhood VARCHAR,
    review_status bin_report_review_status_enum, resolved_at TIMESTAMP,
    created_at TIMESTAMP
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
           br.neighborhood, br.review_status, br.resolved_at, br.created_at
    FROM bin_reports br
    WHERE br.reporter_id IS NOT NULL
      AND (p_neighborhood IS NULL OR br.neighborhood ILIKE '%' || p_neighborhood || '%')
      AND (p_status IS NULL OR br.review_status = p_status)
      AND (p_date_from IS NULL OR br.created_at >= p_date_from)
      AND (p_date_to IS NULL OR br.created_at <= p_date_to)
    ORDER BY br.created_at DESC;
$$;

DROP FUNCTION IF EXISTS admin_get_anonymous_bin_reports();

CREATE OR REPLACE FUNCTION admin_get_anonymous_bin_reports(
    p_neighborhood TEXT DEFAULT NULL,
    p_status bin_report_review_status_enum DEFAULT NULL,
    p_date_from TIMESTAMP DEFAULT NULL,
    p_date_to TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
    id INTEGER, dumpster_id INTEGER, report_type report_type_enum,
    latitude DECIMAL, longitude DECIMAL, photo_url VARCHAR, neighborhood VARCHAR,
    review_status bin_report_review_status_enum, resolved_at TIMESTAMP,
    created_at TIMESTAMP
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT br.id, br.dumpster_id, br.report_type, br.latitude, br.longitude, br.photo_url,
           br.neighborhood, br.review_status, br.resolved_at, br.created_at
    FROM bin_reports br
    WHERE br.reporter_id IS NULL
      AND (p_neighborhood IS NULL OR br.neighborhood ILIKE '%' || p_neighborhood || '%')
      AND (p_status IS NULL OR br.review_status = p_status)
      AND (p_date_from IS NULL OR br.created_at >= p_date_from)
      AND (p_date_to IS NULL OR br.created_at <= p_date_to)
    ORDER BY br.created_at DESC;
$$;

REVOKE ALL ON FUNCTION admin_get_attributed_bin_reports(TEXT, bin_report_review_status_enum, TIMESTAMP, TIMESTAMP) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_get_anonymous_bin_reports(TEXT, bin_report_review_status_enum, TIMESTAMP, TIMESTAMP) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_attributed_bin_reports(TEXT, bin_report_review_status_enum, TIMESTAMP, TIMESTAMP) TO app_user;
GRANT EXECUTE ON FUNCTION admin_get_anonymous_bin_reports(TEXT, bin_report_review_status_enum, TIMESTAMP, TIMESTAMP) TO app_user;

-- [BIN-28] Toggle-capable rather than resolve-only — a one-way "resolved"
-- button with no undo is a real footgun for a review workflow; reopening
-- costs nothing extra to support.
CREATE OR REPLACE FUNCTION admin_set_bin_report_status(
    p_report_id INTEGER,
    p_status bin_report_review_status_enum,
    p_admin_id INTEGER
)
RETURNS TABLE (id INTEGER, review_status bin_report_review_status_enum, resolved_at TIMESTAMP)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE bin_reports
    SET review_status = p_status,
        resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END,
        resolved_by_admin_id = CASE WHEN p_status = 'resolved' THEN p_admin_id ELSE NULL END
    WHERE bin_reports.id = p_report_id
    RETURNING bin_reports.id, bin_reports.review_status, bin_reports.resolved_at;
$$;

CREATE OR REPLACE FUNCTION admin_set_bin_report_neighborhood(
    p_report_id INTEGER,
    p_neighborhood VARCHAR
)
RETURNS TABLE (id INTEGER, neighborhood VARCHAR)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE bin_reports
    SET neighborhood = p_neighborhood
    WHERE bin_reports.id = p_report_id
    RETURNING bin_reports.id, bin_reports.neighborhood;
$$;

-- [BIN-29] Merges p_duplicate_id into p_primary_id: every bin_reports row
-- pointing at the duplicate gets re-pointed to the primary (history
-- preserved, not deleted — matters for the city/HYSACAM evidence use
-- case), then the duplicate is flagged via merged_into_dumpster_id so
-- every live "nearest dumpster" query excludes it going forward. Refuses
-- self-merges and merging into an already-merged-away dumpster (no merge
-- chains — always point directly at a live primary).
CREATE OR REPLACE FUNCTION admin_merge_dumpsters(
    p_duplicate_id INTEGER,
    p_primary_id INTEGER
)
RETURNS TABLE (duplicate_id INTEGER, primary_id INTEGER, reports_moved INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_moved INTEGER;
    v_primary_already_merged BOOLEAN;
BEGIN
    IF p_duplicate_id = p_primary_id THEN
        RAISE EXCEPTION 'cannot merge a dumpster into itself';
    END IF;

    SELECT (merged_into_dumpster_id IS NOT NULL) INTO v_primary_already_merged
    FROM dumpsters WHERE id = p_primary_id;

    IF v_primary_already_merged IS NULL THEN
        RAISE EXCEPTION 'primary dumpster does not exist';
    END IF;
    IF v_primary_already_merged THEN
        RAISE EXCEPTION 'primary dumpster is itself merged into another — merge into the live one instead';
    END IF;

    UPDATE bin_reports SET dumpster_id = p_primary_id WHERE dumpster_id = p_duplicate_id;
    GET DIAGNOSTICS v_moved = ROW_COUNT;

    UPDATE dumpsters SET merged_into_dumpster_id = p_primary_id WHERE id = p_duplicate_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'duplicate dumpster does not exist';
    END IF;

    RETURN QUERY SELECT p_duplicate_id, p_primary_id, v_moved;
END;
$$;

REVOKE ALL ON FUNCTION admin_set_bin_report_status(INTEGER, bin_report_review_status_enum, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_set_bin_report_neighborhood(INTEGER, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_merge_dumpsters(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_bin_report_status(INTEGER, bin_report_review_status_enum, INTEGER) TO app_user;
GRANT EXECUTE ON FUNCTION admin_set_bin_report_neighborhood(INTEGER, VARCHAR) TO app_user;
GRANT EXECUTE ON FUNCTION admin_merge_dumpsters(INTEGER, INTEGER) TO app_user;

-- [BIN-30] create_or_find_nearby_bin (migration 047) redefined to exclude
-- merged-away dumpsters from the "does one already exist here" check —
-- otherwise a duplicate that was just merged away could still be matched
-- and confirmed against, undoing the point of merging it.
DROP FUNCTION IF EXISTS create_or_find_nearby_bin(DECIMAL, DECIMAL, VARCHAR, reporter_role_enum, INTEGER, DECIMAL);

CREATE OR REPLACE FUNCTION create_or_find_nearby_bin(
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_photo_url VARCHAR,
    p_reporter_role reporter_role_enum,
    p_reporter_id INTEGER,
    p_radius_meters DECIMAL DEFAULT 25
)
RETURNS TABLE (id INTEGER, latitude DECIMAL, longitude DECIMAL, bin_code VARCHAR, status bin_status_enum, was_created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing RECORD;
    v_new_id INTEGER;
BEGIN
    SELECT d.id, d.latitude, d.longitude, d.bin_code, d.status
    INTO v_existing
    FROM dumpsters d
    WHERE d.merged_into_dumpster_id IS NULL
      AND 6371000 * 2 * asin(sqrt(
              power(sin(radians(d.latitude - p_latitude) / 2), 2) +
              cos(radians(p_latitude)) * cos(radians(d.latitude)) *
              power(sin(radians(d.longitude - p_longitude) / 2), 2)
          )) <= p_radius_meters
    ORDER BY 6371000 * 2 * asin(sqrt(
              power(sin(radians(d.latitude - p_latitude) / 2), 2) +
              cos(radians(p_latitude)) * cos(radians(d.latitude)) *
              power(sin(radians(d.longitude - p_longitude) / 2), 2)
          ))
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        RETURN QUERY SELECT v_existing.id, v_existing.latitude, v_existing.longitude, v_existing.bin_code, v_existing.status, false;
        RETURN;
    END IF;

    INSERT INTO dumpsters (latitude, longitude, status, status_updated_at)
    VALUES (p_latitude, p_longitude, 'empty', now())
    RETURNING dumpsters.id INTO v_new_id;

    INSERT INTO bin_reports (dumpster_id, report_type, latitude, longitude, photo_url, reporter_role, reporter_id)
    VALUES (v_new_id, 'new_bin', p_latitude, p_longitude, p_photo_url, p_reporter_role, p_reporter_id);

    RETURN QUERY SELECT v_new_id, p_latitude, p_longitude, NULL::VARCHAR, 'empty'::bin_status_enum, true;
END;
$$;

REVOKE ALL ON FUNCTION create_or_find_nearby_bin(DECIMAL, DECIMAL, VARCHAR, reporter_role_enum, INTEGER, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_or_find_nearby_bin(DECIMAL, DECIMAL, VARCHAR, reporter_role_enum, INTEGER, DECIMAL) TO app_user;
