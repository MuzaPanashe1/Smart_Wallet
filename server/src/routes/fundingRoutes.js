const express = require('express');
const {
  getFundingProviders,
  listFundingSources
} = require('../controllers/fundingController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/providers', getFundingProviders);
router.get('/sources', authenticate, listFundingSources);

module.exports = router;
