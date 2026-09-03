-- [BIN-02] bin_reports: every add/confirm/full-report event, from logged-in
-- users or anonymous ones. Same "no RLS" posture as dumpsters (migration
-- 001/002 comment: dumpsters have no RLS, plain reads) — reports aren't
-- tenant-scoped, and anonymous reporting is a deliberate feature, not a
-- gap, so there's no ownership boundary to enforce here. reporter_id is
-- never trusted from client input — the routes derive it from the verified
-- JWT (via optionalAuth) or leave it NULL, never from the request body.
CREATE TYPE report_type_enum AS ENUM ('new_bin', 'full_report', 'confirm_existing');
CREATE TYPE reporter_role_enum AS ENUM ('client', 'collector', 'anonymous');

CREATE TABLE bin_reports (
    id              SERIAL PRIMARY KEY,
    dumpster_id     INTEGER NULL REFERENCES dumpsters(id),
    report_type     report_type_enum NOT NULL,
    latitude        DECIMAL(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude       DECIMAL(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    photo_url       VARCHAR(500) NOT NULL,
    reporter_role   reporter_role_enum NOT NULL,
    reporter_id     INTEGER NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON bin_reports TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- [BIN-03] Atomic check-then-insert: if a dumpster already exists within
-- p_radius_meters, returns it (was_created = false) instead of creating a
-- duplicate. FOR UPDATE locks a genuinely-existing match against concurrent
-- confirms/creates landing on it at the same time. Doesn't fully close the
-- race where two brand-new bins get reported at the same spot in the same
-- instant (neither sees the other's uncommitted row) — accepted as a rare,
-- low-stakes edge case for a community-reporting feature, not worth an
-- advisory lock.
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
    WHERE 6371000 * 2 * asin(sqrt(
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

CREATE OR REPLACE FUNCTION confirm_bin(
    p_dumpster_id INTEGER,
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_photo_url VARCHAR,
    p_reporter_role reporter_role_enum,
    p_reporter_id INTEGER
)
RETURNS TABLE (id INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dumpsters WHERE dumpsters.id = p_dumpster_id) THEN
        RETURN;
    END IF;

    INSERT INTO bin_reports (dumpster_id, report_type, latitude, longitude, photo_url, reporter_role, reporter_id)
    VALUES (p_dumpster_id, 'confirm_existing', p_latitude, p_longitude, p_photo_url, p_reporter_role, p_reporter_id);

    RETURN QUERY SELECT p_dumpster_id;
END;
$$;

-- full_since only set the first time a bin becomes full (COALESCE), so a
-- second full-report on an already-full bin doesn't reset the 48h clock.
CREATE OR REPLACE FUNCTION report_bin_full(
    p_dumpster_id INTEGER,
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_photo_url VARCHAR,
    p_reporter_role reporter_role_enum,
    p_reporter_id INTEGER
)
RETURNS TABLE (id INTEGER, status bin_status_enum, full_since TIMESTAMP)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE dumpsters
    SET status = 'full',
        status_updated_at = now(),
        full_since = COALESCE(dumpsters.full_since, now())
    WHERE dumpsters.id = p_dumpster_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    INSERT INTO bin_reports (dumpster_id, report_type, latitude, longitude, photo_url, reporter_role, reporter_id)
    VALUES (p_dumpster_id, 'full_report', p_latitude, p_longitude, p_photo_url, p_reporter_role, p_reporter_id);

    RETURN QUERY SELECT dumpsters.id, dumpsters.status, dumpsters.full_since FROM dumpsters WHERE dumpsters.id = p_dumpster_id;
END;
$$;

REVOKE ALL ON FUNCTION create_or_find_nearby_bin(DECIMAL, DECIMAL, VARCHAR, reporter_role_enum, INTEGER, DECIMAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION confirm_bin(INTEGER, DECIMAL, DECIMAL, VARCHAR, reporter_role_enum, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION report_bin_full(INTEGER, DECIMAL, DECIMAL, VARCHAR, reporter_role_enum, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_or_find_nearby_bin(DECIMAL, DECIMAL, VARCHAR, reporter_role_enum, INTEGER, DECIMAL) TO app_user;
GRANT EXECUTE ON FUNCTION confirm_bin(INTEGER, DECIMAL, DECIMAL, VARCHAR, reporter_role_enum, INTEGER) TO app_user;
GRANT EXECUTE ON FUNCTION report_bin_full(INTEGER, DECIMAL, DECIMAL, VARCHAR, reporter_role_enum, INTEGER) TO app_user;
