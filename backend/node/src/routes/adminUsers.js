const express = require('express');
const Joi = require('joi');

const { createUser } = require('../controllers/adminUserController');
const { authMiddleware } = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const validateBody = require('../middleware/validateBody');
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
  role: Joi.string().valid('admin', 'operator').required(),
}).unknown(false);

router.use(authMiddleware, requireAdmin);

router.get('/', (req, res) => {
  res.json({ success: true, username: req.admin.username });
});
router.post(
  '/',
  validateBody(
    createUserSchema,
    'Gunakan email Gmail, Yahoo, Outlook, Hotmail, atau iCloud yang valid; password minimal 6 karakter dan role admin atau operator.',
  ),
  createUser,
);

module.exports = router;
