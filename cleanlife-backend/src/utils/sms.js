const AfricasTalking = require('africastalking');

const africastalking = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

const smsService = africastalking.SMS;

// Africa's Talking expects E.164-ish numbers, e.g. +237675481958
function normalizeToE164(phoneNumber, defaultCountryCode = '237') {
  const digits = phoneNumber.replace(/\D/g, '');
  if (phoneNumber.startsWith('+')) return phoneNumber;
  if (digits.startsWith(defaultCountryCode)) return `+${digits}`;
  return `+${defaultCountryCode}${digits}`;
}

async function sendOtpSms(phoneNumber, code) {
  const to = normalizeToE164(phoneNumber);
  try {
    await smsService.send({
      to: [to],
      message: `Your CleanLife verification code is ${code}. It expires in 10 minutes.`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    return true;
  } catch (err) {
    console.error('Africa\'s Talking SMS send failed:', err);
    return false; // non-fatal — see note below on how the route should handle this
  }
}

module.exports = { sendOtpSms };