const nodemailer = require('nodemailer');

// [MAIL-01] Real SMTP-backed email sending for the client registration OTP
// (and anything else that needs to email a client). Reads its own settings
// lazily, same reasoning as pawapay.js — a developer not testing email
// shouldn't be blocked from running the rest of the app just because these
// env vars aren't set yet.
function getConfig() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;
    if (!host || !user || !pass) {
        throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS must be set in .env — required to send real emails.');
    }
    return { host, port, user, pass, from };
}

let cachedTransporter = null;
function transporter() {
    if (cachedTransporter) return cachedTransporter;
    const { host, port, user, pass } = getConfig();
    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
    return cachedTransporter;
}

async function sendEmail({ to, subject, text }) {
    const { from } = getConfig();
    await transporter().sendMail({ from, to, subject, text });
}

module.exports = { sendEmail };
