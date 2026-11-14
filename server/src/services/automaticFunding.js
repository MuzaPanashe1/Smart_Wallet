const { v4: uuidv4 } = require('uuid');
const { LinkedAccount, Transaction } = require('../models');
const { getDirectRate } = require('./exchangeRateService');
const { pullFunds } = require('./paymentGateway');

const fundWalletShortfall = async ({ userId, wallet, balance, currency, needed, transaction }) => {
  const currentBalance = Number(balance.balance);
  const shortfall = Math.max(0, Number(needed) - currentBalance);
  if (shortfall <= 0) return null;

  const source = await LinkedAccount.findOne({
    where: { user_id: userId, status: 'ACTIVE' },
    order: [['created_at', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE
  });
  if (!source) {
    const error = new Error(`Insufficient ${currency} balance and no active local account is linked`);
    error.status = 400;
    throw error;
  }

  const sourceRate = source.currency === currency ? 1 : await getDirectRate(source.currency, currency);
  const sourceAmount = Number((Math.ceil((shortfall / sourceRate) * 10000) / 10000).toFixed(4));
  const sourceBalance = Number(source.simulated_balance);
  const payment = await pullFunds(source.provider, {
    amount: sourceAmount,
    currency: source.currency,
    availableBalance: sourceBalance
  });
  if (payment.status !== 'success') {
    const error = new Error(
      process.env.MOCK_PAYMENT_FORCE_FAILURE === 'true'
        ? 'The linked account payment was declined. Wallet balance was not changed.'
        : 'The linked account has insufficient simulated funds. Wallet balance was not changed.'
    );
    error.status = 402;
    throw error;
  }

  source.simulated_balance = Number((sourceBalance - sourceAmount).toFixed(4));
  await source.save({ transaction });
  balance.balance = Number(balance.balance) + shortfall;
  await balance.save({ transaction });

  await Transaction.create({
    user_id: userId,
    wallet_id: wallet.id,
    transaction_type: 'DEPOSIT',
    funding_source_id: source.id,
    provider_ref: uuidv4(),
    source_currency: source.currency,
    destination_currency: currency,
    source_amount: sourceAmount,
    converted_amount: shortfall,
    exchange_rate: sourceRate,
    recipient_info: `Funded from ${source.provider}`,
    status: 'success',
    fraud_risk_score: 0,
    fraud_risk_level: 'Low Risk',
    scoring_mode: 'gateway_confirmed',
    risk_factors: []
  }, { transaction });

  return { source, sourceAmount, sourceCurrency: source.currency, walletAmount: shortfall };
};

module.exports = { fundWalletShortfall };
