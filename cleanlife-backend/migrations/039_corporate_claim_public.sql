-- [CLAIM-01] Previously (migration 020) claim_pickup_request required
-- collector_type = 'independent', blocking corporate collectors from
-- ever claiming a public broadcast job. Removing that restriction —
-- corporate collectors can now claim public jobs too, same as
-- independent ones. The atomic "first tap wins, disappears for
-- everyone else" guarantee is untouched (WHERE collector_id IS NULL
-- already made that safe under concurrent requests).
-- Tier cascade rank check is unchanged — corporate collectors inherit
-- their company's subscription_tier (per SRS), so Premium-tier corporate
-- collectors still see rank-1 jobs first, same as independent Premium.

DROP FUNCTION IF EXISTS claim_pickup_request(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION claim_pickup_request(p_request_id INTEGER, p_collector_id INTEGER)
RETURNS TABLE (id INTEGER, routing_status routing_status_enum, collector_id INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE pickup_requests AS pr
    SET routing_status = 'assigned', collector_id = p_collector_id
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
    RETURNING pr.id, pr.routing_status, pr.collector_id;
$$;

GRANT EXECUTE ON FUNCTION claim_pickup_request(INTEGER, INTEGER) TO app_user;