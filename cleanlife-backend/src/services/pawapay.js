const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// [MOMO-02] Real pawaPay integration — replaces the earlier SIMULATED
// console.log placeholder. pawaPay is a payment aggregator that routes to
// MTN Mobile Money and Orange Money across several African countries,
// including Cameroon.
//
// Reads its own settings lazily (at call time, not at server startup) so
// a developer who isn't testing MoMo yet doesn't get blocked from running
// the rest of the app just because these 2 env vars aren't set.

function getConfig() {
    const token = process.env.PAWAPAY_TOKEN;
    const baseUrl = process.env.PAWAPAY_BASE_URL || 'https://api.pawapay.io';
    if (!token) {
        throw new Error('PAWAPAY_TOKEN is not set in .env — required for real MoMo payments.');
    }
    return { token, baseUrl };
}

function client() {
    const { token, baseUrl } = getConfig();
    return axios.create({
        baseURL: baseUrl,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        timeout: 15000,
    });
}

// [MOMO-09] Registration never enforced a phone number format (auth.js /
// clients.js just strip whitespace and store whatever was typed), so a
// client who typed their number as a local 9-digit "6XXXXXXXX" instead of
// "237XXXXXXXXX" would have their deposit sent with an incomplete MSISDN —
// pawaPay accepts 237-prefixed MSISDNs only, so the request would be
// REJECTED/FAILED before ever reaching MTN, again with no visible symptom
// besides "no prompt arrived." Normalizing here, at the one place all real
// payments funnel through, fixes it regardless of what got stored at signup.
function normalizeCameroonMsisdn(rawPhone) {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (digits.startsWith('237') && digits.length === 12) return digits;
    if (digits.length === 9 && digits.startsWith('6')) return `237${digits}`;
    throw new Error(
        `Invalid Cameroon phone number "${rawPhone}" — expected 9 digits starting with 6 (e.g. 670000000) or 237 followed by those 9 digits.`
    );
}

// [MOMO-03] Kicks off a real Request-to-Pay prompt on the client's phone via
// the pawaPay v2 API. amount is a plain number (FCFA), no decimals needed
// for MTN Cameroon Mobile Money.
//
// [MOMO-08] Was posting the v1 request shape (payer.type: 'MSISDN',
// payer.address.value, top-level correspondent) to the v1 '/deposits' path.
// This account is provisioned on v2 ('/v2/active-conf' confirms it), whose
// schema is payer.type: 'MMO' with payer.accountDetails: { phoneNumber,
// provider }. The mismatch meant the request never properly reached MTN's
// PROVIDER_AUTH prompt dispatch — pawaPay's gateway still returned HTTP 200,
// and `response.data?.status || 'ACCEPTED'` silently defaulted to a fake
// success whenever the (wrongly-shaped) response didn't carry a `status`
// field pawaPay actually recognized, masking the real outcome.
// [MOMO-11] `amount` here is a Postgres NUMERIC column value (e.g.
// clients.estimated_price_fcfa), which the `pg` driver returns as a string
// like "1500.00". Passing that straight through as `String(amount)` sent
// pawaPay a decimal amount — confirmed live: MTN_MOMO_CMR rejects any XAF
// deposit with decimal places (XAF is a zero-decimal currency) with
// REJECTED/INVALID_AMOUNT, before ever dispatching a prompt. Rounding to a
// whole-number string here fixes it regardless of what shape the caller's
// amount arrives in (string, numeric-with-decimals, or plain number).
async function initiatePayment({ phoneNumber, amount, currency = 'XAF', correspondent = 'MTN_MOMO_CMR' }) {
    const depositId = uuidv4();
    const msisdn = normalizeCameroonMsisdn(phoneNumber);
    const wholeAmount = Math.round(Number(amount));
    if (!Number.isFinite(wholeAmount) || wholeAmount <= 0) {
        throw new Error(`Invalid deposit amount: ${amount}`);
    }

    const response = await client().post('/v2/deposits', {
        depositId,
        amount: String(wholeAmount),
        currency,
        payer: {
            type: 'MMO',
            accountDetails: {
                phoneNumber: msisdn,
                provider: correspondent,
            },
        },
        customerMessage: 'CleanLife pickup',
    });

    // [MOMO-08] v2 can return HTTP 200 for ACCEPTED, DUPLICATE_IGNORED, or
    // REJECTED alike — a 200 status code alone does NOT mean the prompt was
    // sent. Callers must check `status` themselves rather than assume success.
    return {
        depositId,
        status: response.data?.status || 'UNKNOWN',
        failureReason: response.data?.failureReason || null,
        raw: response.data,
    };
}

// [MOMO-04] Checks the real, current status of a previously-initiated
// payment via pawaPay v2. Response is wrapped as { status: 'FOUND' | 'NOT_FOUND',
// data: { status: 'ACCEPTED' | 'PROCESSING' | 'IN_RECONCILIATION' | 'COMPLETED' | 'FAILED', ... } }.
async function getPaymentStatus(depositId) {
    const response = await client().get(`/v2/deposits/${depositId}`);
    const record = response.data?.data || null;
    return {
        depositId,
        status: record?.status || 'UNKNOWN',
        raw: response.data,
    };
}

module.exports = { initiatePayment, getPaymentStatus, normalizeCameroonMsisdn };