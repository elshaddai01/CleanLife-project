-- [AUTH-05] auth.js unified /login updates last_login on both roles after
-- successful auth. Add last_login to both collectors and clients tables.
ALTER TABLE collectors ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL;