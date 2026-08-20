-- [PAYOUT-01] Corporate collectors' earnings now route to their COMPANY's
-- wallet, not directly to the collector — the company later decides when
-- to pay out to that collector. Independent collectors are unaffected:
-- they already only get credited at job completion (existing escrow
-- design), which already matches "withheld by the app until the task is
-- completed."

ALTER TABLE companies ADD COLUMN IF NOT EXISTS balance DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Postgres requires new enum values added outside the transaction that
-- uses them — safe here since nothing in this same file references them.
ALTER TYPE owner_type_enum ADD VALUE IF NOT EXISTS 'company';
ALTER TYPE wallet_tx_type_enum ADD VALUE IF NOT EXISTS 'payout';