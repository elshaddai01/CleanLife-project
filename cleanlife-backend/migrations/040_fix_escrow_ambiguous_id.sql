-- [PAYOUT-06] Bug: process_escrow_release's RETURNS TABLE (id INTEGER, ...)
-- implicitly declares a plpgsql variable named `id` in scope for the whole
-- function body. The lookup `WHERE id = p_collector_id` couldn't tell that
-- bare `id` apart from the OUT variable `id` — "column reference id is
-- ambiguous". Same class of bug as migration 017; fix is the same:
-- qualify every column reference explicitly.

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
    SELECT collectors.company_id INTO v_company_id FROM collectors WHERE collectors.id = p_collector_id;

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