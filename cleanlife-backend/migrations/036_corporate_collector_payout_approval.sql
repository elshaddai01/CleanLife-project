CREATE TYPE collector_payout_status_enum AS ENUM ('pending', 'paid');

CREATE TABLE collector_payouts (
    id SERIAL PRIMARY KEY,
    pickup_request_id INTEGER NOT NULL UNIQUE REFERENCES pickup_requests(id),
    collector_id INTEGER NOT NULL REFERENCES collectors(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    status collector_payout_status_enum NOT NULL DEFAULT 'pending',
    approved_by INTEGER NULL REFERENCES admins(id),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE collector_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY collector_payouts_tenant_isolation ON collector_payouts
    FOR ALL
    USING (
        CASE WHEN current_tenant() = 'public'
            THEN company_id IS NULL
            ELSE company_id = current_tenant()::integer
        END
    )
    WITH CHECK (
        CASE WHEN current_tenant() = 'public'
            THEN company_id IS NULL
            ELSE company_id = current_tenant()::integer
        END
    );

CREATE OR REPLACE FUNCTION create_pending_collector_payout(
    p_request_id INTEGER,
    p_collector_id INTEGER,
    p_company_id INTEGER,
    p_amount DECIMAL
)
RETURNS TABLE (id INTEGER, status collector_payout_status_enum)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO collector_payouts (pickup_request_id, collector_id, company_id, amount)
    SELECT p_request_id, p_collector_id, p_company_id, p_amount
    WHERE EXISTS (
        SELECT 1 FROM pickup_requests pr
        JOIN collectors c ON c.id = pr.collector_id
        WHERE pr.id = p_request_id
          AND pr.collector_id = p_collector_id
          AND c.collector_type = 'corporate'
          AND c.company_id = p_company_id
          AND pr.routing_status = 'completed'
    )
    ON CONFLICT (pickup_request_id) DO NOTHING
    RETURNING collector_payouts.id, collector_payouts.status;
$$;

CREATE OR REPLACE FUNCTION list_pending_collector_payouts(p_company_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    pickup_request_id INTEGER,
    collector_id INTEGER,
    collector_username VARCHAR(100),
    amount DECIMAL,
    created_at TIMESTAMP
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT cp.id, cp.pickup_request_id, cp.collector_id, c.username, cp.amount, cp.created_at
    FROM collector_payouts cp
    JOIN collectors c ON c.id = cp.collector_id
    WHERE cp.company_id = p_company_id AND cp.status = 'pending'
    ORDER BY cp.created_at ASC;
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

    RETURN QUERY SELECT v_payout.id, v_wallet_id, v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION create_pending_collector_payout(INTEGER, INTEGER, INTEGER, DECIMAL) TO app_user;
GRANT EXECUTE ON FUNCTION list_pending_collector_payouts(INTEGER) TO app_user;
GRANT EXECUTE ON FUNCTION approve_collector_payout(INTEGER, INTEGER, INTEGER) TO app_user;