// src/controllers/verificationController.js
// Verification controller – placeholders for email and phone flows
// ---------------------------------------------------------------
// In a real implementation you would integrate SendGrid (or another email service)
// and Twilio (or another SMS provider). For now we simply return a success
// message so the route structure is in place.

async function sendEmailVerification(req, res) {
  // TODO: generate token, store it, send email via provider SDK
  res.json({ success: true, message: 'Email verification triggered (placeholder)' });
}

async function sendPhoneVerification(req, res) {
  // TODO: generate OTP, store it, send SMS via provider SDK
  res.json({ success: true, message: 'Phone verification OTP sent (placeholder)' });
}

module.exports = { sendEmailVerification, sendPhoneVerification };
