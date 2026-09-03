-- [BIN-31] claim_pickup_request / claim_corporate_pickup_request (migration
-- 051) redefined to also exclude merged-away dumpsters from both the
-- nearest-non-full and the any-status fallback lookups — otherwise a
-- duplicate dumpster an admin just merged away could still get assigned to
-- a brand new job.
DROP FUNCTION IF EXISTS claim_pickup_request(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION claim_pickup_request(p_request_id INTEGER, p_collector_id INTEGER)
RETURNS TABLE (id INTEGER, routing_status routing_status_enum, collector_id INTEGER, assigned_dumpster_id INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE pickup_requests AS pr
    SET routing_status = 'assigned',
        collector_id = p_collector_id,
        assigned_dumpster_id = COALESCE(
            (SELECT d.id FROM dumpsters d
             WHERE d.status != 'full' AND d.merged_into_dumpster_id IS NULL
             ORDER BY 6371000 * 2 * asin(sqrt(
                 power(sin(radians(d.latitude - pr.client_latitude) / 2), 2) +
                 cos(radians(pr.client_latitude)) * cos(radians(d.latitude)) *
                 power(sin(radians(d.longitude - pr.client_longitude) / 2), 2)
             ))
             LIMIT 1),
            (SELECT d.id FROM dumpsters d
             WHERE d.merged_into_dumpster_id IS NULL
             ORDER BY 6371000 * 2 * asin(sqrt(
                 power(sin(radians(d.latitude - pr.client_latitude) / 2), 2) +
                 cos(radians(pr.client_latitude)) * cos(radians(d.latitude)) *
                 power(sin(radians(d.longitude - pr.client_longitude) / 2), 2)
             ))
             LIMIT 1)
        )
    FROM collectors AS c
    WHERE pr.id = p_request_id
      AND pr.collector_id IS NULL
      AND pr.routing_status = 'broadcast_public'
      AND c.id = p_collector_id
      AND CASE c.subscription_tier
            WHEN 'Premium' THEN 1
            WHEN 'Gold' THEN 2
            ELSE 3
          END <= pr.current_stage_rank
    RETURNING pr.id, pr.routing_status, pr.collector_id, pr.assigned_dumpster_id;
$$;

GRANT EXECUTE ON FUNCTION claim_pickup_request(INTEGER, INTEGER) TO app_user;

DROP FUNCTION IF EXISTS claim_corporate_pickup_request(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION claim_corporate_pickup_request(p_request_id INTEGER, p_collector_id INTEGER)
RETURNS TABLE (id INTEGER, routing_status routing_status_enum, collector_id INTEGER, assigned_dumpster_id INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE pickup_requests AS pr
    SET routing_status = 'assigned',
        collector_id = p_collector_id,
        assigned_dumpster_id = COALESCE(
            (SELECT d.id FROM dumpsters d
             WHERE d.status != 'full' AND d.merged_into_dumpster_id IS NULL
             ORDER BY 6371000 * 2 * asin(sqrt(
                 power(sin(radians(d.latitude - pr.client_latitude) / 2), 2) +
                 cos(radians(pr.client_latitude)) * cos(radians(d.latitude)) *
                 power(sin(radians(d.longitude - pr.client_longitude) / 2), 2)
             ))
             LIMIT 1),
            (SELECT d.id FROM dumpsters d
             WHERE d.merged_into_dumpster_id IS NULL
             ORDER BY 6371000 * 2 * asin(sqrt(
                 power(sin(radians(d.latitude - pr.client_latitude) / 2), 2) +
                 cos(radians(pr.client_latitude)) * cos(radians(d.latitude)) *
                 power(sin(radians(d.longitude - pr.client_longitude) / 2), 2)
             ))
             LIMIT 1)
        )
    FROM collectors AS c, clients AS cl
    WHERE pr.id = p_request_id
      AND pr.collector_id IS NULL
      AND pr.routing_status = 'searching_corporate'
      AND c.id = p_collector_id
      AND c.collector_type = 'corporate'
      AND cl.id = pr.client_id
      AND cl.company_id = c.company_id
    RETURNING pr.id, pr.routing_status, pr.collector_id, pr.assigned_dumpster_id;
$$;

REVOKE ALL ON FUNCTION claim_corporate_pickup_request(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_corporate_pickup_request(INTEGER, INTEGER) TO app_user;
