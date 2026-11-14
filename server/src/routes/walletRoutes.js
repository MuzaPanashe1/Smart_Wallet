const express = require('express');
const router = express.Router();
const { getWallet, setDefaultCurrency } = require('../controllers/walletController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getWallet);
router.post('/default-currency', authenticate, setDefaultCurrency);

module.exports = router;
