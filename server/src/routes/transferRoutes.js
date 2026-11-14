const express = require('express');
const router = express.Router();
const { preScreenTransferRisk, executeTransfer } = require('../controllers/transferController');
const { authenticate } = require('../middleware/auth');

router.post('/pre-screen', authenticate, preScreenTransferRisk);
router.post('/execute', authenticate, executeTransfer);

module.exports = router;
