const express = require('express');

const { sendEmailVerification, verifyEmailLink } = require('../controllers/verificationController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/email', authMiddleware, sendEmailVerification);
router.get('/email', verifyEmailLink);

module.exports = router;
