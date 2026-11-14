const express = require('express');
const router = express.Router();
const { previewConversion, executeConversion } = require('../controllers/conversionController');
const { authenticate } = require('../middleware/auth');

router.post('/preview', authenticate, previewConversion);
router.post('/execute', authenticate, executeConversion);

module.exports = router;
