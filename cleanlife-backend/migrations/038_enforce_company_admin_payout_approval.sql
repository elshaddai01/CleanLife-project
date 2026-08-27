CREATE OR REPLACE FUNCTION approve_collector_payout(
    p_payout_id INTEGER,
    p_company_id INTEGER,
    p_admin_id INTEGER
)
RETURNS TABLE (id INTEGER, wallet_transaction_id INTEGER, new_balance DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payout collector_payouts%ROWTYPE;
    v_wallet_id INTEGER;
    v_new_balance DECIMAL;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM admins
        WHERE admins.id = p_admin_id
          AND admins.role = 'company_admin'
          AND admins.company_id = p_company_id
    ) THEN
        RAISE EXCEPTION 'admin is not authorized for this company payout';
    END IF;

    SELECT * INTO v_payout
    FROM collector_payouts
    WHERE collector_payouts.id = p_payout_id
      AND collector_payouts.company_id = p_company_id
      AND collector_payouts.status = 'pending'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'pending collector payout not found'; END IF;

    SELECT w.id, w.new_balance INTO v_wallet_id, v_new_balance
    FROM create_wallet_transaction(
        'collector', v_payout.collector_id, 'job_earnings', v_payout.amount,
        format('Approved earnings for pickup request %s', v_payout.pickup_request_id),
        v_payout.pickup_request_id
    ) w;

    UPDATE collector_payouts
    SET status = 'paid', approved_by = p_admin_id, approved_at = now()
    WHERE collector_payouts.id = v_payout.id;
    RETURN QUERY SELECT v_payout.id, v_wallet_id, v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_collector_payout(INTEGER, INTEGER, INTEGER) TO app_user;