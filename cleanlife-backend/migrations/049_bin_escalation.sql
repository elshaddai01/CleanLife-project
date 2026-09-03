-- [BIN-05] 48-hour full-bin escalation flag. No actual city/HYSACAM
-- notification integration yet — this is a placeholder for that future
-- work (see binEscalationWorker.js). escalated_at IS NULL is the guard
-- that keeps the polling worker from re-flagging an already-escalated bin
-- on every tick.
ALTER TABLE dumpsters ADD COLUMN escalated_at TIMESTAMP NULL;

CREATE OR REPLACE FUNCTION escalate_stale_full_bins()
RETURNS TABLE (id INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE dumpsters
    SET escalated_at = now()
    WHERE status = 'full'
      AND full_since IS NOT NULL
      AND full_since <= now() - interval '48 hours'
      AND escalated_at IS NULL
    RETURNING dumpsters.id;
$$;

REVOKE ALL ON FUNCTION escalate_stale_full_bins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION escalate_stale_full_bins() TO app_user;
