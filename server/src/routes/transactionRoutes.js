const express = require('express');
const router = express.Router();
const { getTransactions, getTransactionById } = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getTransactions);
router.get('/:id', authenticate, getTransactionById);

module.exports = router;
