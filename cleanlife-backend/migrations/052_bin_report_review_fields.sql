-- [BIN-25] Super-admin Reports UI needs: a resolution workflow (review
-- status), a neighborhood to filter/group by, and a way to merge duplicate
-- bins that slipped past the 25m creation-time dedup check.
--
-- neighborhood is nullable and NOT populated by the mobile reporting flow
-- (that wasn't part of the original spec) — it's meant to be tagged by an
-- admin while reviewing, since they're the ones who'd actually know local
-- names. Existing/new reports start with neighborhood = NULL until tagged.
CREATE TYPE bin_report_review_status_enum AS ENUM ('open', 'resolved');

ALTER TABLE bin_reports
    ADD COLUMN review_status bin_report_review_status_enum NOT NULL DEFAULT 'open',
    ADD COLUMN neighborhood VARCHAR(120) NULL,
    ADD COLUMN resolved_at TIMESTAMP NULL,
    ADD COLUMN resolved_by_admin_id INTEGER NULL REFERENCES admins(id);

-- [BIN-26] merged_into_dumpster_id marks a dumpster as a duplicate folded
-- into another. The duplicate row stays (its bin_reports history gets
-- re-pointed to the primary, not deleted — audit trail matters for the
-- "evidence for the city/HYSACAM" use case), but every live dumpster-lookup
-- query (mobility evaluation, claim-time assignment, nearby search, the
-- create-bin dedup check) must exclude merged-away dumpsters — see
-- migrations 053/054 for those.
ALTER TABLE dumpsters ADD COLUMN merged_into_dumpster_id INTEGER NULL REFERENCES dumpsters(id);
