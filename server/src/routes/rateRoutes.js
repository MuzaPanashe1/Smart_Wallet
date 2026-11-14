const express = require('express');
const router = express.Router();
const { getRates, getPairRate, requestRateQuote } = require('../controllers/rateController');

router.get('/', getRates);
router.get('/:from/:to', getPairRate);
router.post('/quote', requestRateQuote);

module.exports = router;
