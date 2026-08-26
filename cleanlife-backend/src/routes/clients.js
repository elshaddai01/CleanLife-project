 const express = require('express');
const { pool, withTenant } = require('../db/pool');
const { handleDbError } = require('../utils/dbErrors');
const { hashPassword } = require('../utils/password');
const { nonEmptyString, positiveInteger } = require('../utils/validation');
const { requireAuth } = require('../middleware/auth');
const mailer = require('../services/mailer');

const router = express.Router();


// POST /clients/register
// Body: { name, email, phone_number, password, company_code? }
router.post('/register', async (req, res) => {
    const name = nonEmptyString(req.body.name);
    const email = nonEmptyString(req.body.email);
    const phone_number = nonEmptyString(req.body.phone_number)?.replace(/\s+/g, '') || null;
    const password = nonEmptyString(req.body.password);
    const company_code = nonEmptyString(req.body.company_code);

    if (!name || !email || !phone_number || !password) {
        return res.status(400).json({
            error: 'name, email, phone_number, and password are required'
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            error: 'password must be at least 8 characters'
        });
    }

    try {
        let company = null;

        // [ONBOARD-01] Company Referral Code path (with format validation)
        if (company_code) {
            const normalizedCode = String(company_code).trim().toLowerCase();
            if (!/^[a-z0-9-]{3,20}$/.test(normalizedCode)) {
                return res.status(400).json({ error: 'company_code format invalid' });
            }
            const companyResult = await pool.query(
                'SELECT id, company_name, subscription_tier FROM companies WHERE lower(company_code) = $1',
                [normalizedCode]
            );
            if (companyResult.rows.length === 0) {
                return res.status(400).json({
                    error: 'invalid company_code'
                });
            }

            company = companyResult.rows[0];
        }

        const tenantId = company ? company.id : null;

        const password_hash = await hashPassword(password);

        // Generate verification codes
        const phoneCode = Math.floor(100000 + Math.random() * 900000).toString();
        const emailCode = Math.floor(100000 + Math.random() * 900000).toString();

        const expiry = new Date(Date.now() + 10 * 60 * 1000);


        const inserted = await withTenant(tenantId, async (client) => {

            const result = await client.query(
                `INSERT INTO clients 
                (
                    name,
                    email,
                    phone_number,
                    company_id,
                    password_hash,
                    verification_code,
                    verification_expiry,
                    email_verification_code,
                    email_verification_expiry
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                RETURNING id, name, email, phone_number, company_id, created_at`,
                [
                    name,
                    email,
                    phone_number,
                    tenantId,
                    password_hash,
                    phoneCode,
                    expiry,
                    emailCode,
                    expiry
                ]
            );

            return result.rows[0];
        });

        // [MAIL-02] Real email delivery for the registration OTP. Non-fatal —
        // the client record already exists at this point, and a delivery
        // failure (e.g. SMTP not configured yet in this environment) must
        // not undo a successful registration. Falls back to logging the
        // code server-side so local development still works without SMTP
        // credentials — never returned in the API response itself, unlike
        // the phone reset code, since that would defeat the point of an OTP.
        let emailDelivered = true;
        try {
            await mailer.sendEmail({
                to: email,
                subject: 'CleanLife — verify your email',
                text: `Your CleanLife email verification code is ${emailCode}. It expires in 10 minutes.`,
            });
        } catch (mailError) {
            emailDelivered = false;
            console.error(`[mail] Could not send verification email to ${email}: ${mailError.message}`);
            console.warn(`[mail] DEV FALLBACK — verification code for ${email} is ${emailCode}`);
        }

        return res.status(201).json({
            message: emailDelivered
                ? 'Registration successful. Check your email for a verification code.'
                : 'Registration successful, but the verification email could not be sent — contact support.',
            email_delivered: emailDelivered,
            client: inserted
        });


    } catch (err) {
        return handleDbError(err, res, 'client registration');
    }
});


// [PROFILE-01] Self-service profile update. Client can only update their
// own record — validated against req.collector.sub (JWT payload) rather
// than trusting the :id param. Uses withTenant with the client's own
// company_id from the JWT so RLS doesn't silently no-op on corporate
// clients (see migration 008 note on the empty-string/public trap).
// Body: { name?, email? }
router.put('/:id/profile', requireAuth, async (req, res) => {
    const clientId = positiveInteger(req.params.id);
    if (!clientId) return res.status(400).json({ error: 'invalid client id' });
    if (req.collector.role !== 'client' || Number(req.collector.sub) !== clientId) {
        return res.status(403).json({ error: 'you can only update your own profile' });
    }

    const name = nonEmptyString(req.body.name);
    const email = nonEmptyString(req.body.email);
    if (!name && !email) {
        return res.status(400).json({ error: 'name or email is required' });
    }

    try {
        const updated = await withTenant(req.collector.company_id, async (client) => {
            const result = await client.query(
                `UPDATE clients
                 SET name = COALESCE($1, name),
                     email = COALESCE($2, email)
                 WHERE id = $3
                 RETURNING id, name, email, phone_number, company_id`,
                [name, email, clientId]
            );
            return result.rows[0];
        });
        if (!updated) return res.status(404).json({ error: 'client not found' });
        return res.json(updated);
    } catch (err) {
        return handleDbError(err, res, 'profile update');
    }
});


// POST /clients/verify-phone
// Body: { phone_number, code }
router.post('/verify-phone', async (req, res) => {

    const phone_number = nonEmptyString(req.body.phone_number);
    const code = nonEmptyString(req.body.code);

    if (!phone_number || !code) {
        return res.status(400).json({
            error: 'phone_number and code are required'
        });
    }

    try {

        const result = await pool.query(
            `UPDATE clients
             SET phone_verified = true,
                 verification_code = NULL,
                 verification_expiry = NULL
             WHERE phone_number = $1
             AND verification_code = $2
             AND verification_expiry > NOW()
             RETURNING id`,
            [phone_number, code]
        );


        if (result.rows.length === 0) {
            return res.status(400).json({
                error: 'invalid or expired verification code'
            });
        }


        res.json({
            message: 'Phone verified successfully'
        });


    } catch (err) {
        return handleDbError(err, res, 'phone verification');
    }
});



// POST /clients/verify-email
// Body: { email, code }
router.post('/verify-email', async (req, res) => {

    const email = nonEmptyString(req.body.email);
    const code = nonEmptyString(req.body.code);

    if (!email || !code) {
        return res.status(400).json({
            error: 'email and code are required'
        });
    }


    try {

        const result = await pool.query(
            `UPDATE clients
             SET email_verified = true,
                 email_verification_code = NULL,
                 email_verification_expiry = NULL
             WHERE email = $1
             AND email_verification_code = $2
             AND email_verification_expiry > NOW()
             RETURNING id`,
            [email, code]
        );


        if (result.rows.length === 0) {
            return res.status(400).json({
                error: 'invalid or expired verification code'
            });
        }


        res.json({
            message: 'Email verified successfully'
        });


    } catch(err) {
        return handleDbError(err, res, 'email verification');
    }
});



// [MAIL-03] Lets a client who never got (or let expire) their registration
// email request a fresh code, instead of being stuck unverified forever.
// POST /clients/resend-email-code
// Body: { email }
router.post('/resend-email-code', async (req, res) => {
    const email = nonEmptyString(req.body.email);
    if (!email) {
        return res.status(400).json({ error: 'email is required' });
    }

    try {
        const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        const result = await pool.query(
            `UPDATE clients
             SET email_verification_code = $1,
                 email_verification_expiry = $2
             WHERE email = $3 AND email_verified = false
             RETURNING id`,
            [emailCode, expiry, email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'no unverified account found for that email' });
        }

        let emailDelivered = true;
        try {
            await mailer.sendEmail({
                to: email,
                subject: 'CleanLife — your new verification code',
                text: `Your new CleanLife email verification code is ${emailCode}. It expires in 10 minutes.`,
            });
        } catch (mailError) {
            emailDelivered = false;
            console.error(`[mail] Could not resend verification email to ${email}: ${mailError.message}`);
            console.warn(`[mail] DEV FALLBACK — verification code for ${email} is ${emailCode}`);
        }

        return res.json({
            message: emailDelivered ? 'Verification code resent.' : 'Could not send the email — contact support.',
            email_delivered: emailDelivered,
        });
    } catch (err) {
        return handleDbError(err, res, 'resend verification code');
    }
});

// [MAIL-05] Was returning reset_code directly in the API response — anyone
// who knew a client's phone number could fetch their reset code with no
// verification at all, defeating the point of the code. Now sent to the
// client's email (same real delivery path as the registration OTP) instead
// of handed back over the same channel that requested it.
// POST /clients/request-password-reset
// Body: { email }
router.post('/request-password-reset', async (req,res)=>{

    const email = nonEmptyString(req.body.email);

    if(!email){
        return res.status(400).json({
            error:'email is required'
        });
    }


    try{

        const resetCode = Math.floor(100000 + Math.random()*900000).toString();

        const expiry = new Date(Date.now()+10*60*1000);


        const result = await pool.query(
            `UPDATE clients
             SET reset_code=$1,
                 reset_expiry=$2
             WHERE email=$3
             RETURNING id`,
             [
                resetCode,
                expiry,
                email
             ]
        );


        if(result.rows.length===0){
            return res.status(404).json({
                error:'client not found'
            });
        }

        let emailDelivered = true;
        try {
            await mailer.sendEmail({
                to: email,
                subject: 'CleanLife — password reset code',
                text: `Your CleanLife password reset code is ${resetCode}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
            });
        } catch (mailError) {
            emailDelivered = false;
            console.error(`[mail] Could not send password reset email to ${email}: ${mailError.message}`);
            console.warn(`[mail] DEV FALLBACK — password reset code for ${email} is ${resetCode}`);
        }

        res.json({
            message: emailDelivered
                ? 'A password reset code has been sent to your email.'
                : 'Could not send the reset email right now — contact support.',
            email_delivered: emailDelivered,
        });


    }catch(err){
        return handleDbError(err,res,'password reset request');
    }

});



// POST /clients/reset-password
// Body: { email, code, new_password }
router.post('/reset-password', async(req,res)=>{

    const email = nonEmptyString(req.body.email);
    const code = nonEmptyString(req.body.code);
    const new_password = nonEmptyString(req.body.new_password);


    if(!email || !code || !new_password){
        return res.status(400).json({
            error:'email, code and new_password are required'
        });
    }


    try{

        const password_hash = await hashPassword(new_password);


        const result = await pool.query(
            `UPDATE clients
             SET password_hash=$1,
                 reset_code=NULL,
                 reset_expiry=NULL
             WHERE email=$2
             AND reset_code=$3
             AND reset_expiry > NOW()
             RETURNING id`,
             [
                password_hash,
                email,
                code
             ]
        );


        if(result.rows.length===0){
            return res.status(400).json({
                error:'invalid or expired reset code'
            });
        }


        res.json({
            message:'Password reset successful'
        });


    }catch(err){
        return handleDbError(err,res,'password reset');
    }

});


module.exports = router;