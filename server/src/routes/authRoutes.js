const express = require('express');
const router = express.Router();
const { register, login, getProfile, getKycStatus, verifyKyc, logout } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticate, getProfile);
router.get('/kyc/status', authenticate, getKycStatus);
router.post('/kyc/verify', authenticate, verifyKyc);
router.post('/logout', authenticate, logout);

module.exports = router;
