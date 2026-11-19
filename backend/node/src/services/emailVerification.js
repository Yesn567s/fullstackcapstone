const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/db');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationEmailForUser(userId, email) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email verification is not configured.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.execute(
    'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt],
  );

  const frontendBaseUrl = (
    process.env.FRONTEND_BASE_URL || 'http://localhost:5500/frontend'
  ).replace(/\/+$/, '');
  const verifyUrl = `${frontendBaseUrl}/template/verify.html?uid=${encodeURIComponent(
    userId,
  )}&t=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify your email address',
    html:
      '<p>Hello,</p>' +
      '<p>Click the button to verify your email.</p>' +
      `<p><a href="${verifyUrl}" style="display:inline-block;background-color:#8b5e3c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Click me</a></p>` +
      '<p>This link expires in 24 hours.</p>',
    text: `Click the button to verify your email.\n${verifyUrl}\n\nThis link expires in 24 hours.`,
  });
}

module.exports = { sendVerificationEmailForUser };
