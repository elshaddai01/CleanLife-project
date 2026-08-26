const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { positiveInteger, finiteNumber } = require('../utils/validation');
const config = require('../config/env');
const { handleDbError } = require('../utils/dbErrors');
const { verifyDisposal } = require('../services/proofOfWorkVerification');
const { sendPushNotification } = require('../utils/pushService');
const pawapay = require('../services/pawapay');

const router = express.Router();

// [MOMO-05] Collector marks arrival. For MoMo requests, this is now where
// a REAL pawaPay Request-to-Pay prompt is sent to the client's phone —
// replaces the earlier SIMULATED console.log placeholder. If pawaPay
// itself fails to send (bad token, client's phone number invalid, pawaPay
// service down), the arrival confirmation still succeeds — a payment
// hiccup should never block the collector from continuing their job; the
// client can still be prompted again later if needed.
router.post('/:id/arrive', requireAuth, requireRole('collector'), async (req, res) => {
    const requestId = positiveInteger(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'invalid pickup request id' });
    try {
        const result = await pool.query(
            'SELECT * FROM mark_collector_arrived($1, $2)',
            [requestId, req.collector.sub]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'request not found, not yours, or not currently assigned' });
        }
        const row = result.rows[0];

        if (row.payment_method === 'MOMO') {
            try {
                const clientLookup = await pool.query(
                    `SELECT phone_number, estimated_price_fcfa FROM clients c
                     JOIN pickup_requests pr ON pr.client_id = c.id
                     WHERE pr.id = $1`,
                    [requestId]
                );
                const clientRow = clientLookup.rows[0];
                if (clientRow?.phone_number) {
                    const payment = await pawapay.initiatePayment({
                        phoneNumber: clientRow.phone_number,
                        amount: clientRow.estimated_price_fcfa || 0,
                    });
                    await pool.query(
                        'SELECT * FROM store_momo_deposit_id($1, $2, $3)',
                        [requestId, req.collector.sub, payment.depositId]
                    );
                    if (payment.status === 'ACCEPTED') {
                        console.log(`[momo] Real Request-to-Pay sent for request ${requestId}, depositId=${payment.depositId}`);
                    } else {
                        console.error(
                            `[momo] Deposit not accepted for request ${requestId}, depositId=${payment.depositId}, status=${payment.status}`,
                            payment.failureReason || ''
                        );
                    }
                } else {
                    console.warn(`[momo] Client has no phone_number on file for request ${requestId} — cannot send Request-to-Pay.`);
                }
            } catch (momoError) {
                // Non-fatal — the arrival itself already succeeded above.
                console.error(`[momo] Failed to initiate real payment for request ${requestId}:`, momoError.message);
            }
        }

        const clientLookup = await pool.query(
            'SELECT push_token FROM clients WHERE id = (SELECT client_id FROM pickup_requests WHERE id = $1)',
            [requestId]
        );
        if (clientLookup.rows[0]?.push_token) {
            void sendPushNotification(
                clientLookup.rows[0].push_token,
                'Your collector has arrived',
                'They are at your pickup location now.',
                { pickup_request_id: requestId }
            );
        }

        return res.json(row);
    } catch (err) {
        return handleDbError(err, res, 'arrival confirmation');
    }
});

router.post('/:id/collect-cash', requireAuth, requireRole('collector'), async (req, res) => {
    const requestId = positiveInteger(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'invalid pickup request id' });
    try {
        const result = await pool.query(
            'SELECT * FROM confirm_cash_collected($1, $2)',
            [requestId, req.collector.sub]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'request not found, not yours, or not a CASH payment' });
        }
        console.log(`[payment] SIMULATED commission webhook fired for cash request ${requestId}`);
        return res.json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'cash confirmation');
    }
});

router.post('/momo/webhook', async (req, res) => {
    const secret = req.headers['x-momo-webhook-secret'];
    if (!secret || secret !== config.momoWebhookSecret) {
        return res.status(401).json({ error: 'invalid webhook secret' });
    }
    const { pickup_request_id } = req.body;
    if (!pickup_request_id) {
        return res.status(400).json({ error: 'pickup_request_id is required' });
    }
    try {
        const result = await pool.query('SELECT * FROM confirm_momo_payment($1)', [pickup_request_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'request not found or not a MOMO payment' });
        }
        return res.json(result.rows[0]);
    } catch (err) {
        return handleDbError(err, res, 'momo webhook');
    }
});

// [POW-06] Proof-of-work submission — the ONLY action that completes a
// request and releases escrow (SRS 3.4), regardless of payment method.
// insert_proof_of_work (migration 035) requires payment already confirmed.
// Body: { photo_storage_url, exif_latitude?, exif_longitude?, bin_code? }
router.post('/:id/proof-of-work', requireAuth, requireRole('collector'), async (req, res) => {
    const requestId = positiveInteger(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'invalid pickup request id' });
    const { photo_storage_url, exif_latitude, exif_longitude, bin_code } = req.body;

    if (!photo_storage_url) {
        return res.status(400).json({ error: 'photo_storage_url is required' });
    }
    if (!bin_code && (exif_latitude == null || exif_longitude == null)) {
        return res.status(400).json({ error: 'either bin_code or both exif_latitude and exif_longitude are required' });
    }
    if (exif_latitude != null && finiteNumber(exif_latitude, { min: -90, max: 90 }) === null) {
        return res.status(400).json({ error: 'exif_latitude must be between -90 and 90' });
    }
    if (exif_longitude != null && finiteNumber(exif_longitude, { min: -180, max: 180 }) === null) {
        return res.status(400).json({ error: 'exif_longitude must be between -180 and 180' });
    }

    try {
        const { isVerified, verificationMethod, dumpsterId } = await verifyDisposal({
            exifLatitude: exif_latitude,
            exifLongitude: exif_longitude,
            binCode: bin_code,
        });

        const proofParams = [requestId, req.collector.sub, photo_storage_url, exif_latitude, exif_longitude, verificationMethod, dumpsterId, isVerified];

        if (!isVerified) {
            const inserted = await pool.query(
                'SELECT * FROM insert_proof_of_work($1, $2, $3, $4, $5, $6, $7, $8)',
                proofParams
            );
            if (inserted.rows.length === 0) {
                return res.status(409).json({ error: 'request not found, not yours, not currently assigned, or payment not yet confirmed' });
            }
            return res.status(422).json({
                error: bin_code
                    ? 'bin_code not recognized'
                    : `disposal photo location is not within the required ${100}m of an authorized dumpster`,
                proof_of_work: inserted.rows[0],
            });
        }

        const client = await pool.connect();
        await client.query('BEGIN');
        try {
            const inserted = await client.query(
                'SELECT * FROM insert_proof_of_work($1, $2, $3, $4, $5, $6, $7, $8)',
                proofParams
            );

            if (inserted.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'request not found, not yours, not currently assigned, or payment not yet confirmed' });
            }

            const completed = await client.query(
                'SELECT * FROM complete_pickup_request($1, $2)',
                [requestId, req.collector.sub]
            );
            if (completed.rows.length === 0) throw new Error('pickup request could not be completed');

            let walletCredit = null;
            const price = completed.rows[0].estimated_price_fcfa;
            if (price && Number(price) > 0) {
                const creditResult = await client.query(
                    'SELECT * FROM process_escrow_release($1, $2, $3)',
                    [req.collector.sub, price, requestId]
                );
                walletCredit = creditResult.rows[0];
            }

            await client.query('COMMIT');

            return res.json({
                proof_of_work: inserted.rows[0],
                pickup_request: completed.rows[0],
                wallet_credit: walletCredit,
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (err) {
        return handleDbError(err, res, 'proof-of-work submission');
    }
});

module.exports = router;