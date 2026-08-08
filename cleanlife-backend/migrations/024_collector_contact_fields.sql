-- [ONBOARD-04] Collector registration screen now collects name/email/phone
-- alongside username — bring collectors schema in line with clients
-- (migrations 022/023 did the same for clients).
ALTER TABLE collectors
    ADD COLUMN full_name VARCHAR(100) NULL,
    ADD COLUMN email VARCHAR(255) NULL,
    ADD COLUMN phone_number VARCHAR(20) NULL;