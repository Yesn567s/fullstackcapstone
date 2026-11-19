const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const validateBody = require('../middleware/validateBody');
const { verifyPhoneNumber } = require('../controllers/phoneController');

const router = express.Router();
const phoneVerificationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan pemeriksaan nomor. Coba lagi nanti.',
  },
});
const userIdSchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
}).unknown(false);

router.post(
  '/validate',
  phoneVerificationRateLimit,
  validateBody(userIdSchema, 'ID akun tidak valid.'),
  verifyPhoneNumber,
);

module.exports = router;
