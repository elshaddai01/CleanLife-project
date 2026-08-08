-- [DISP-09] Real bug: admin_hold_expires_at is TIMESTAMP (no timezone).
-- Node computes `new Date(Date.now() + ADMIN_HOLD_MS)` — a correct UTC
-- instant — but the pg driver writes it into a tz-naive column, and this
-- server's local time is UTC+2. Postgres stores the raw wall-clock numbers
-- with no conversion, so the stored value ends up 2 hours behind where it
-- needs to be, making every corporate hold look already-expired the
-- instant it's created. Converting to TIMESTAMPTZ fixes this at the
-- column level — Postgres then always stores/compares in UTC internally
-- regardless of session timezone.
ALTER TABLE pickup_requests
    ALTER COLUMN admin_hold_expires_at TYPE TIMESTAMPTZ;