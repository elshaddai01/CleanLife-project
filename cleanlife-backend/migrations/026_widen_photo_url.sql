-- [UPLOAD-02] photo_storage_url was sized for a short external URL
-- (VARCHAR(255)), but the SIMULATED upload endpoint (migration/uploads.js)
-- returns a base64 data: URL instead, which is far longer. Widen to TEXT.
ALTER TABLE proof_of_works ALTER COLUMN photo_storage_url TYPE TEXT;