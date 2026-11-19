const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');

const {
  getVerificationStatus,
  resendEmailVerification,
  sendEmailVerification,
  verifyEmailLink,
} = require('../controllers/verificationController');
const { authMiddleware } = require('../middleware/auth');
const validateBody = require('../middleware/validateBody');

const router = express.Router();
const emailVerificationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan email verifikasi. Coba lagi nanti.',
  },
});
const userIdSchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
}).unknown(false);

router.get('/status', getVerificationStatus);
router.post(
  '/email/resend',
  emailVerificationRateLimit,
  validateBody(userIdSchema, 'ID akun tidak valid.'),
  resendEmailVerification,
);
router.post('/email', authMiddleware, sendEmailVerification);
router.get('/email', verifyEmailLink);

module.exports = router;
