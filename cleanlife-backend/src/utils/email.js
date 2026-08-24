const nodemailer = require('nodemailer');

function isConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM);
}

async function sendOtpEmail(email, code) {
    if (!isConfigured()) {
        console.warn('Email OTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM in cleanlife-backend/.env.');
        return false;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: email,
            subject: 'Your CleanLife verification code',
            text: `Your CleanLife verification code is ${code}. It expires in 10 minutes.`,
        });
        return true;
    } catch (error) {
        console.error('Email OTP send failed:', error.message);
        return false;
    }
}

module.exports = { sendOtpEmail };
