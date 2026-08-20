-- [PAYOUT-02] Companies table has no direct wallet_transactions RLS
-- policy of its own (see migration 014) — companies aren't tenant-scoped
-- the way clients/collectors are. Adding a narrow policy so a
-- company_admin can see their own company's transaction history.
CREATE POLICY wallet_tx_select_company ON wallet_transactions
    FOR SELECT
    USING (
        owner_type = 'company'
        AND owner_id::text = current_tenant()
    );

-- [PAYOUT-03] create_wallet_transaction (migrations 014/017) only knew
-- about 'client' and 'collector' owner types — extending it to handle
-- 'company' too, since companies now hold a real wallet balance. Every
-- other line is unchanged from migration 017's version.
CREATE OR REPLACE FUNCTION create_wallet_transaction(
    p_owner_type TEXT,
    p_owner_id INTEGER,
    p_type TEXT,
    p_amount DECIMAL,
    p_description TEXT,
    p_reference_pickup_request_id INTEGER
)
RETURNS TABLE (id INTEGER, new_balance DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id INTEGER;
    v_delta DECIMAL;
    v_current_balance DECIMAL;
    v_new_balance DECIMAL;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'amount must be positive';
    END IF;

    IF p_type IN ('top_up', 'job_earnings', 'referral_bonus') THEN
        v_delta := p_amount;
    ELSIF p_type IN ('withdraw', 'pickup_payment', 'payout') THEN
        v_delta := -p_amount;
    ELSE
        RAISE EXCEPTION 'invalid wallet transaction type: %', p_type;
    END IF;

    IF p_owner_type = 'client' THEN
        SELECT clients.balance INTO v_current_balance FROM clients WHERE clients.id = p_owner_id FOR UPDATE;
    ELSIF p_owner_type = 'collector' THEN
        SELECT collectors.balance INTO v_current_balance FROM collectors WHERE collectors.id = p_owner_id FOR UPDATE;
    ELSIF p_owner_type = 'company' THEN
        SELECT companies.balance INTO v_current_balance FROM companies WHERE companies.id = p_owner_id FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'invalid owner_type: %', p_owner_type;
    END IF;

    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'owner not found';
    END IF;

    IF v_delta < 0 AND (v_current_balance + v_delta) < 0 THEN
        RAISE EXCEPTION 'insufficient balance';
    END IF;

    v_new_balance := v_current_balance + v_delta;

    IF p_owner_type = 'client' THEN
        UPDATE clients SET balance = v_new_balance WHERE clients.id = p_owner_id;
    ELSIF p_owner_type = 'collector' THEN
        UPDATE collectors SET balance = v_new_balance WHERE collectors.id = p_owner_id;
    ELSE
        UPDATE companies SET balance = v_new_balance WHERE companies.id = p_owner_id;
    END IF;

    INSERT INTO wallet_transactions (owner_type, owner_id, type, amount, description, reference_pickup_request_id)
    VALUES (p_owner_type::owner_type_enum, p_owner_id, p_type::wallet_tx_type_enum, p_amount, p_description, p_reference_pickup_request_id)
    RETURNING wallet_transactions.id INTO v_id;

    RETURN QUERY SELECT v_id, v_new_balance;
END;
$$;

-- Replaces the manual create_wallet_transaction call that used to run
-- inline in paymentAndProof.js on job completion. Routes to the
-- collector's COMPANY wallet if they're corporate, or directly to the
-- collector if independent (unchanged existing behavior for that case).
CREATE OR REPLACE FUNCTION process_escrow_release(
    p_collector_id INTEGER,
    p_amount DECIMAL,
    p_reference_pickup_request_id INTEGER
)
RETURNS TABLE (id INTEGER, new_balance DECIMAL, routed_to TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id INTEGER;
    v_result RECORD;
BEGIN
    SELECT company_id INTO v_company_id FROM collectors WHERE id = p_collector_id;

    IF v_company_id IS NOT NULL THEN
        SELECT * INTO v_result FROM create_wallet_transaction(
            'company', v_company_id, 'job_earnings', p_amount,
            'Job earnings for corporate collector #' || p_collector_id,
            p_reference_pickup_request_id
        );
        RETURN QUERY SELECT v_result.id, v_result.new_balance, 'company'::TEXT;
    ELSE
        SELECT * INTO v_result FROM create_wallet_transaction(
            'collector', p_collector_id, 'job_earnings', p_amount,
            'Job earnings', p_reference_pickup_request_id
        );
        RETURN QUERY SELECT v_result.id, v_result.new_balance, 'collector'::TEXT;
    END IF;
END;
$$;

-- Company admin manually releases funds from the company wallet to one of
-- their own corporate collectors. Scoped so a company_admin can only pay
-- out collectors who actually belong to their own company.
CREATE OR REPLACE FUNCTION company_payout_to_collector(
    p_company_id INTEGER,
    p_collector_id INTEGER,
    p_amount DECIMAL,
    p_description TEXT
)
RETURNS TABLE (collector_id INTEGER, collector_new_balance DECIMAL, company_new_balance DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_debit RECORD;
    v_credit RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM collectors WHERE id = p_collector_id AND company_id = p_company_id) THEN
        RAISE EXCEPTION 'collector does not belong to this company';
    END IF;

    SELECT * INTO v_debit FROM create_wallet_transaction(
        'company', p_company_id, 'payout', p_amount,
        COALESCE(p_description, 'Payout to collector #' || p_collector_id), NULL
    );
    SELECT * INTO v_credit FROM create_wallet_transaction(
        'collector', p_collector_id, 'job_earnings', p_amount,
        COALESCE(p_description, 'Payout from company'), NULL
    );

    RETURN QUERY SELECT p_collector_id, v_credit.new_balance, v_debit.new_balance;
END;
$$;

REVOKE ALL ON FUNCTION process_escrow_release(INTEGER, DECIMAL, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION company_payout_to_collector(INTEGER, INTEGER, DECIMAL, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_escrow_release(INTEGER, DECIMAL, INTEGER) TO app_user;
GRANT EXECUTE ON FUNCTION company_payout_to_collector(INTEGER, INTEGER, DECIMAL, TEXT) TO app_user;
GRANT SELECT ON companies TO app_user;