-- Corporate collector earnings remain escrowed after verified disposal until
-- the company admin approves the payout. Independent collector earnings still
-- become completed immediately after verified disposal.

CREATE OR REPLACE FUNCTION complete_pickup_request(p_request_id INTEGER, p_collector_id INTEGER)
RETURNS TABLE (id INTEGER, routing_status routing_status_enum, payment_status payment_status_enum, estimated_price_fcfa DECIMAL)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE pickup_requests
    SET routing_status = 'completed',
        payment_status = CASE
            WHEN EXISTS (
                SELECT 1
                FROM collectors
                WHERE collectors.id = p_collector_id
                  AND collectors.collector_type = 'corporate'
            ) THEN 'PENDING_COMPLETION'::payment_status_enum
            ELSE 'COMPLETED'::payment_status_enum
        END
    WHERE pickup_requests.id = p_request_id
      AND pickup_requests.collector_id = p_collector_id
      AND pickup_requests.routing_status = 'assigned'
      AND (
          (pickup_requests.payment_method = 'CASH' AND pickup_requests.cash_collected_at IS NOT NULL)
          OR (pickup_requests.payment_method = 'MOMO' AND pickup_requests.momo_confirmed_at IS NOT NULL)
      )
    RETURNING pickup_requests.id, pickup_requests.routing_status, pickup_requests.payment_status, pickup_requests.estimated_price_fcfa;
$$;

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

    UPDATE pickup_requests
    SET payment_status = 'COMPLETED'
    WHERE pickup_requests.id = v_payout.pickup_request_id
      AND pickup_requests.collector_id = v_payout.collector_id
      AND pickup_requests.routing_status = 'completed';

    RETURN QUERY SELECT v_payout.id, v_wallet_id, v_new_balance;
END;
$$;
