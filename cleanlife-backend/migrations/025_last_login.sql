-- [AUTH-05] auth.js unified /login updates last_login on both roles after
-- successful auth. collectors already had it; clients didn't.
ALTER TABLE clients ADD COLUMN last_login TIMESTAMP NULL;