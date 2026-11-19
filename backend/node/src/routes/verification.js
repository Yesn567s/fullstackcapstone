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
const emailResendRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan email verifikasi. Coba lagi nanti.',
  },
});
const resendEmailSchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
}).unknown(false);

router.post('/email', authMiddleware, sendEmailVerification);
router.post(
  '/email/resend',
  emailResendRateLimit,
  validateBody(resendEmailSchema, 'ID akun tidak valid.'),
  resendEmailVerification,
);
router.get('/email', verifyEmailLink);
router.get('/status', getVerificationStatus);

module.exports = router;
