-- [BIN-01] Community bin-status reporting, part 1: status tracking on the
-- existing dumpsters table. 'medium' has no write path yet in this feature
-- set (nothing sets it) — kept in the enum per spec as likely future use.
-- full_since is meant to clear when status moves away from 'full', but no
-- endpoint in this feature set currently transitions a bin OFF 'full'
-- (that's presumably a future HYSACAM-integration or admin action) — the
-- column exists now so that behavior can be added later without another
-- migration.
CREATE TYPE bin_status_enum AS ENUM ('empty', 'medium', 'full');

ALTER TABLE dumpsters
    ADD COLUMN status bin_status_enum NOT NULL DEFAULT 'empty',
    ADD COLUMN status_updated_at TIMESTAMP NULL,
    ADD COLUMN full_since TIMESTAMP NULL;
