const axios = require('axios');
const { Transaction } = require('../models');
const { Op } = require('sequelize');
const { convertToUSD, SUPPORTED_CURRENCIES } = require('./exchangeRateService');

const FRAUD_SERVICE_URL = process.env.FRAUD_SERVICE_URL || 'http://127.0.0.1:5001';

/**
 * Computes behavioural historical context for a user before evaluating fraud risk:
 * 1. Historical average transaction amount (in USD)
 * 2. Minutes elapsed since last transaction
 * 3. Count of transactions in the last 1 hour (velocity)
 */
const getUserTransactionHistoryMetrics = async (userId, currentAmountUsd) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const pastTransactions = await Transaction.findAll({
    where: {
      user_id: userId,
      status: {
        [Op.in]: [
          'COMPLETED',
          'PENDING_REVIEW',
          'FLAGGED',
          'FAILED',
          'REJECTED',
          'success',
          'pending',
          'failed'
        ]
      }
    },
    order: [['created_at', 'DESC']],
    limit: 20
  });

  if (!pastTransactions.length) {
    return {
      userAvgAmount: currentAmountUsd,
      minutesSinceLastTx: 1440,
      userTxCountLastHour: 0
    };
  }

  const lastTx = pastTransactions[0];
  const diffMs = Date.now() - new Date(lastTx.created_at).getTime();
  const minutesSinceLastTx = Math.max(0.1, parseFloat((diffMs / (60 * 1000)).toFixed(2)));
  const recentCount = pastTransactions.filter(tx => new Date(tx.created_at) >= oneHourAgo).length;
  const validTransactions = pastTransactions.filter(tx =>
    SUPPORTED_CURRENCIES.includes(String(tx.source_currency).toUpperCase()) &&
    Number(tx.source_amount) > 0
  );
  const amounts = await Promise.all(validTransactions.map(tx =>
    convertToUSD(tx.source_currency, Number(tx.source_amount))
  ));
  const avgAmount = amounts.length
    ? amounts.reduce((total, amount) => total + amount, 0) / amounts.length
    : currentAmountUsd;

  return {
    userAvgAmount: parseFloat(avgAmount.toFixed(2)),
    minutesSinceLastTx,
    userTxCountLastHour: recentCount
  };
};

/**
 * Fallback assessment if the Python microservice is offline
 */
const fallbackAssessment = (data) => {
  const amount = Number(data.amount_usd);
  const avg = Number(data.user_avg_amount);
  const ratio = avg > 0 ? amount / avg : 1.0;
  const timeSince = Number(data.minutes_since_last_tx);
  const velocity = Number(data.user_tx_count_last_hour);

  let riskScore = 5.0 + Math.min(20.0, velocity * 2.0);
  const riskFactors = [];

  if (timeSince < 2.0 && velocity >= 2) {
    riskScore += 45.0;
    riskFactors.push(`Rapid repeated transaction: ${timeSince.toFixed(1)} mins since previous activity`);
  } else if (velocity >= 3) {
    riskScore += 25.0;
    riskFactors.push(`Elevated velocity: ${velocity} transactions in the last hour`);
  }

  if (ratio >= 4.0) {
    riskScore += 35.0;
    riskFactors.push(`Unusual spike: Amount is ${ratio.toFixed(1)}x greater than historical baseline ($${avg.toFixed(2)})`);
  } else if (ratio >= 2.0) {
    riskScore += 15.0;
    riskFactors.push(`Above average transfer value (${ratio.toFixed(1)}x baseline)`);
  }

  if (amount >= 3000) {
    riskScore += 25.0;
    riskFactors.push(`High absolute value cross-border transfer ($${amount.toFixed(2)} USD)`);
  }

  riskScore = Math.min(99.0, Math.max(5.0, riskScore));

  let riskLevel = 'Low Risk';
  let decision = 'LOW';
  if (riskScore > 70.0) {
    riskLevel = 'High Risk';
    decision = 'BLOCK';
  } else if (riskScore >= 30.0) {
    riskLevel = 'Medium Risk';
    decision = 'REVIEW';
  }

  if (riskFactors.length === 0) {
    riskFactors.push('No heuristic risk threshold was triggered by the assessed transaction data.');
  }

  return {
    risk_score: parseFloat(riskScore.toFixed(2)),
    risk_level: riskLevel,
    decision,
    recommendation: decision,
    flagged: decision !== 'LOW',
    scoring_mode: 'heuristic_fallback',
    risk_factors: riskFactors,
    engine: 'NodeJS_Heuristic_Fallback'
  };
};

/**
 * Assesses transaction risk by calling the Python ML Fraud Service
 */
const assessTransactionRisk = async ({
  userId,
  transactionType,
  sourceCurrency,
  destinationCurrency,
  sourceAmount,
  features
}) => {
  const amountUsd = await convertToUSD(sourceCurrency, sourceAmount);
  const metrics = await getUserTransactionHistoryMetrics(userId, amountUsd);
  const currentHour = new Date().getHours();

  const payload = {
    user_id: userId,
    transaction_type: transactionType,
    source_currency: sourceCurrency,
    destination_currency: destinationCurrency,
    amount_usd: amountUsd,
    amount: amountUsd,
    user_avg_amount: metrics.userAvgAmount,
    minutes_since_last_tx: metrics.minutesSinceLastTx,
    user_tx_count_last_hour: metrics.userTxCountLastHour,
    hour_of_day: currentHour,
    features
  };

  try {
    const response = await axios.post(`${FRAUD_SERVICE_URL}/api/fraud/assess`, payload, {
      timeout: 3500
    });

    if (response.data && response.data.status === 'success') {
      const assessment = response.data.data;
      assessment.scoring_mode = assessment.scoring_mode || 'heuristic_fallback';
      assessment.engine = assessment.scoring_mode === 'ml_model'
        ? 'Python_PaySim_RandomForest'
        : 'Python_Heuristic_Fallback';
      return assessment;
    }
    console.warn('[FraudClient] Python service returned an invalid assessment; using heuristic fallback.');
  } catch (apiError) {
    console.warn('[FraudClient] Python fraud service request failed:', apiError.message);
  }

  return fallbackAssessment(payload);
};

module.exports = {
  assessTransactionRisk,
  getUserTransactionHistoryMetrics
};
