-- [NOTIF-01] Expo push token storage. A device registers its token after
-- login; the backend uses it to send real push notifications via Expo's
-- push API at key events (collector claims a job, collector arrives).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS push_token TEXT NULL;
ALTER TABLE collectors ADD COLUMN IF NOT EXISTS push_token TEXT NULL;