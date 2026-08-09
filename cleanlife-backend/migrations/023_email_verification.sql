ALTER TABLE clients
ADD COLUMN email VARCHAR(255),
ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN email_verification_code VARCHAR(6),
ADD COLUMN email_verification_expiry TIMESTAMP;