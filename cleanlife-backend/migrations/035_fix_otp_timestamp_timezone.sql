-- Keep OTP expiry instants timezone-aware so Node Date values compare correctly with NOW().
ALTER TABLE clients
    ALTER COLUMN verification_expiry TYPE TIMESTAMPTZ
        USING verification_expiry AT TIME ZONE 'UTC',
    ALTER COLUMN email_verification_expiry TYPE TIMESTAMPTZ
        USING email_verification_expiry AT TIME ZONE 'UTC',
    ALTER COLUMN reset_expiry TYPE TIMESTAMPTZ
        USING reset_expiry AT TIME ZONE 'UTC';
