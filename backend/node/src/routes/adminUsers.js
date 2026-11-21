const express = require('express');
const Joi = require('joi');

const { createUser } = require('../controllers/adminUserController');
const { authMiddleware } = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const validateBody = require('../middleware/validateBody');
const { ktpUpload } = require('../middleware/upload');
const { ALLOWED_EMAIL_PATTERN } = require('../utils/email');

const router = express.Router();

const createUserSchema = Joi.object({
  username: Joi.string().trim().min(1).max(50).required(),
  password: Joi.string().min(6).required(),
  fullName: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string()
    .trim()
    .email()
    .pattern(ALLOWED_EMAIL_PATTERN)
    .max(100)
    .required(),
  phone: Joi.string().trim().min(1).max(30).required(),
  nik: Joi.string().trim().pattern(/^\d{16}$/).required(),
  gender: Joi.string().valid('laki-laki', 'perempuan').required(),
  address: Joi.string().trim().min(1).max(2000).required(),
  birthDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .custom((value, helpers) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value ||
        date > new Date(new Date().toISOString().slice(0, 10))
      ) {
        return helpers.error('date.invalid');
      }
      return value;
    }, 'valid past birth date')
    .required(),
  role: Joi.string().valid('admin', 'operator').required(),
}).unknown(false);

router.use(authMiddleware, requireAdmin);

router.get('/', (req, res) => {
  res.json({ success: true, username: req.admin.username });
});
router.post(
  '/',
  (req, res, next) => {
    ktpUpload.single('ktpImage')(req, res, (error) => {
      if (error) {
        return res.status(error.status || 422).json({
          success: false,
          message: error.message || 'Gambar KTP tidak dapat diproses.',
        });
      }
      return next();
    });
  },
  validateBody(
    createUserSchema,
    'Periksa kembali data pengguna. Gunakan email Gmail, Yahoo, Outlook, Hotmail, atau iCloud yang valid; password minimal 6 karakter; NIK 16 digit; tanggal lahir yang valid; serta role admin atau operator.',
  ),
  createUser,
);

module.exports = router;
