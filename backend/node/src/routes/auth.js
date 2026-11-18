// src/routes/auth.js
// Authentication routes – register, login, profile
// ---------------------------------------------------
const express = require('express');
const Joi = require('joi');

const {
  login,
  logout,
  profile,
  register,
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const validateBody = require('../middleware/validateBody');
const { ALLOWED_EMAIL_PATTERN } = require('../utils/email');

const router = express.Router();

const registerSchema = Joi.object({
  fullname: Joi.string().trim().max(100).required(),
  username: Joi.string().trim().min(4).max(50).required(),
  email: Joi.string()
    .trim()
    .email()
    .pattern(ALLOWED_EMAIL_PATTERN)
    .max(100)
    .required(),
  phone: Joi.string().trim().min(1).max(30).required(),
  role: Joi.string().valid('customer').default('customer'),
  password: Joi.string().min(6).required(),
  companyName: Joi.string().trim().min(1).max(150).required(),
  contactPerson: Joi.string().trim().min(1).max(100).required(),
  address: Joi.string().trim().min(1).required(),
}).unknown(false);

const loginSchema = Joi.object({
  username: Joi.string().trim().min(1),
  identifier: Joi.string().trim().min(1),
  password: Joi.string().min(1).required(),
  portal: Joi.string().valid('customer', 'staff').required(),
})
  .or('username', 'identifier')
  .unknown(false);

router.post(
  '/register',
  validateBody(registerSchema, 'Data pendaftaran belum lengkap atau tidak valid.'),
  register,
);
router.post(
  '/login',
  validateBody(loginSchema, 'Username, password, atau portal tidak valid.'),
  login,
);
router.post('/logout', logout);
router.get('/profile', authMiddleware, profile);

module.exports = router;
