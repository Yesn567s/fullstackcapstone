const express = require('express');

const {
  sendEmailVerification,
  sendPhoneVerification,
} = require('../controllers/verificationController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/email', authMiddleware, sendEmailVerification);
router.post('/phone', authMiddleware, sendPhoneVerification);

module.exports = router;
