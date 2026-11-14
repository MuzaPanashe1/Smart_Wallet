const express = require('express');
const router = express.Router();
const { getFraudAlerts, getUserFraudAlerts, reviewFraudAlert } = require('../controllers/fraudController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// User can view their own alerts
router.get('/my-alerts', authenticate, getUserFraudAlerts);

// Reviewer/Admin only routes
router.get('/alerts', authenticate, requireRole(['admin', 'reviewer']), getFraudAlerts);
router.patch('/alerts/:id/review', authenticate, requireRole(['admin', 'reviewer']), reviewFraudAlert);

module.exports = router;
