const { User, Wallet, WalletBalance, Transaction, FraudAlert, sequelize } = require('../models');
const { Op } = require('sequelize');
const {
  SUPPORTED_CURRENCIES,
  getDirectRate,
  convertToUSD,
  createRateQuote,
  validateRateQuote
} = require('../services/exchangeRateService');
const { assessTransactionRisk } = require('../services/fraudServiceClient');
const { fundWalletShortfall } = require('../services/automaticFunding');

/**
 * Pre-screen risk score before sending transfer
 */
const preScreenTransferRisk = async (req, res) => {
  try {
    const { recipientEmail, sourceCurrency, destinationCurrency, amount } = req.body;
    const numericAmount = parseFloat(amount);
    const userId = req.user.id;

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid transfer amount is required' });
    }

    const source = (sourceCurrency || 'USD').toUpperCase();
    const destination = (destinationCurrency || 'USD').toUpperCase();
    const wallet = await Wallet.findOne({ where: { user_id: userId } });
    const sourceBalance = wallet && await WalletBalance.findOne({
      where: { wallet_id: wallet.id, currency: source }
    });
    const recipient = recipientEmail && await User.findOne({
      where: { email: recipientEmail.trim().toLowerCase() },
      include: [{ model: Wallet, as: 'wallet', include: [{ model: WalletBalance, as: 'balances' }] }]
    });
    const destinationBalanceRecord = recipient?.wallet?.balances.find((balance) => balance.currency === destination);
    const convertedAmount = numericAmount * await getDirectRate(source, destination);

    const assessment = await assessTransactionRisk({
      userId,
      transactionType: 'TRANSFER',
      sourceCurrency: source,
      destinationCurrency: destination,
      sourceAmount: numericAmount,
      features: await buildPaySimFeatures({
        amount: numericAmount,
        sourceBalance: parseFloat(sourceBalance?.balance || 0),
        sourceCurrency: source,
        destinationBalance: parseFloat(destinationBalanceRecord?.balance || 0),
        destinationCurrency: destination,
        convertedAmount,
        isTransfer: true,
        hour: new Date().getHours()
      })
    });

    return res.status(200).json({
      success: true,
      assessment
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Risk pre-screening failed',
      error: error.message
    });
  }
};

/**
 * Execute transfer with fraud assessment, balance validation, and ACID database transaction
 */
const executeTransfer = async (req, res) => {
  let t;
  try {
    t = await sequelize.transaction();
    const {
      recipientEmail,
      sourceCurrency,
      destinationCurrency,
      amount,
      quoteId
    } = req.body;

    const numericAmount = parseFloat(amount);
    const senderId = req.user.id;

    if (!recipientEmail || !sourceCurrency || !destinationCurrency) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Recipient email and currencies are required'
      });
    }

    if (recipientEmail.toLowerCase() === req.user.email.toLowerCase()) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer funds to your own wallet. Use conversion instead.'
      });
    }

    const src = sourceCurrency.toUpperCase();
    const dst = destinationCurrency.toUpperCase();

    if (!SUPPORTED_CURRENCIES.includes(src) || !SUPPORTED_CURRENCIES.includes(dst)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Supported currencies are: ${SUPPORTED_CURRENCIES.join(', ')}`
      });
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Transfer amount must be a positive number'
      });
    }

    // 1. Fetch sender wallet and balance
    const senderWallet = await Wallet.findOne({
      where: { user_id: senderId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!senderWallet) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Sender wallet not found' });
    }

    let senderBalance = await WalletBalance.findOne({
      where: { wallet_id: senderWallet.id, currency: src },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!senderBalance) {
      senderBalance = await WalletBalance.create({
        wallet_id: senderWallet.id,
        currency: src,
        balance: 0
      }, { transaction: t });
    }

    // 2. KYC validation & Limits
    const senderUser = await User.findByPk(senderId, { transaction: t });
    const amountInUsd = await convertToUSD(src, numericAmount);
    const dailyLimit = senderUser?.daily_limit_usd ? parseFloat(senderUser.daily_limit_usd) : 1500.0;
    const isUnverified = senderUser?.kyc_status !== 'VERIFIED';

    if (isUnverified && amountInUsd > 200.0) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        code: 'KYC_RESTRICTION',
        message: 'KYC verification required for transfers exceeding $200 USD equivalent. Please complete verification.'
      });
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const dailyTransfers = await Transaction.findAll({
      where: {
        user_id: senderId,
        transaction_type: 'TRANSFER',
        status: { [Op.in]: ['COMPLETED', 'PENDING_REVIEW', 'FLAGGED'] },
        created_at: { [Op.gte]: startOfDay }
      },
      transaction: t
    });
    let transferredTodayUsd = 0;
    for (const dailyTransfer of dailyTransfers) {
      transferredTodayUsd += await convertToUSD(
        dailyTransfer.source_currency,
        parseFloat(dailyTransfer.source_amount)
      );
    }

    if (transferredTodayUsd + amountInUsd > dailyLimit) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        code: 'DAILY_LIMIT_EXCEEDED',
        message: `Transfer exceeds the remaining daily limit of $${Math.max(0, dailyLimit - transferredTodayUsd).toFixed(2)} USD.`
      });
    }

    const recipientUser = await User.findOne({
      where: { email: recipientEmail.trim().toLowerCase() },
      include: [{ model: Wallet, as: 'wallet', include: [{ model: WalletBalance, as: 'balances' }] }],
      transaction: t
    });

    if (!recipientUser?.wallet) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Recipient must have a registered Smart Wallet account.'
      });
    }

    let quote;
    if (quoteId) {
      const quoteCheck = validateRateQuote(quoteId, src, dst, numericAmount);
      if (!quoteCheck.valid) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          code: 'EXPIRED_QUOTE',
          message: quoteCheck.reason
        });
      }
      quote = quoteCheck.quote;
    } else {
      quote = await createRateQuote(src, dst, numericAmount);
    }
    const exchangeRate = quote.effectiveRate;
    const convertedAmount = quote.convertedAmount;
    const transaction = await Transaction.create({
      user_id: senderId,
      wallet_id: senderWallet.id,
      transaction_type: 'TRANSFER',
      source_currency: src,
      destination_currency: dst,
      source_amount: numericAmount,
      converted_amount: convertedAmount,
      exchange_rate: exchangeRate,
      fee_amount: quote.feeAmount,
      fee_currency: quote.feeCurrency,
      recipient_info: recipientEmail.trim().toLowerCase(),
      status: 'PENDING_REVIEW',
      fraud_risk_score: 0,
      fraud_risk_level: 'Low Risk',
      scoring_mode: 'heuristic_fallback',
      risk_factors: []
    }, { transaction: t });
    console.info(
      `[TransferController] Staged public.transactions id=${transaction.id} before fraud assessment`
    );

    // Score the staged transfer before applying its balance changes.
    const fraudAssessment = await assessTransactionRisk({
      userId: senderId,
      transactionType: 'TRANSFER',
      sourceCurrency: src,
      destinationCurrency: dst,
      sourceAmount: numericAmount,
      features: await buildPaySimFeatures({
        amount: numericAmount,
        sourceBalance: parseFloat(senderBalance.balance),
        sourceCurrency: src,
        destinationBalance: parseFloat(
          recipientUser.wallet.balances.find((balance) => balance.currency === dst)?.balance || 0
        ),
        destinationCurrency: dst,
        convertedAmount,
        isTransfer: true,
        hour: new Date().getHours()
      })
    });

    const decision = fraudAssessment.decision || (
      fraudAssessment.risk_score > 70 ? 'BLOCK' : fraudAssessment.risk_score >= 30 ? 'REVIEW' : 'LOW'
    );
    let transactionStatus = 'COMPLETED';

    if (decision === 'BLOCK') {
      transactionStatus = 'REJECTED';
    } else if (decision === 'REVIEW') {
      transactionStatus = 'FLAGGED';
    }

    const isReview = decision === 'REVIEW';
    const isBlocked = decision === 'BLOCK';

    transaction.status = transactionStatus;
    transaction.fraud_risk_score = fraudAssessment.risk_score;
    transaction.fraud_risk_level = fraudAssessment.risk_level;
    transaction.scoring_mode = fraudAssessment.scoring_mode || 'heuristic_fallback';
    transaction.risk_factors = fraudAssessment.risk_factors;
    await transaction.save({ transaction: t });

    if (isBlocked) {
      const fraudAlertRecord = await FraudAlert.create({
        transaction_id: transaction.id,
        risk_score: fraudAssessment.risk_score,
        risk_level: fraudAssessment.risk_level,
        reason: fraudAssessment.risk_factors.join('; '),
        review_status: 'RESOLVED',
        notes: 'Automatically blocked by the fraud-risk threshold. No balance was changed.'
      }, { transaction: t });
      await t.commit();
      console.info(`[TransferController] Persisted public.transactions id=${transaction.id} status=REJECTED`);
      console.info(`[TransferController] Persisted public.fraud_alerts id=${fraudAlertRecord.id} status=RESOLVED`);
      return res.status(200).json({
        success: true,
        message: 'Transfer blocked by the fraud-risk policy. No balance was changed.',
        transfer: {
          transactionId: transaction.id,
          status: 'REJECTED',
          riskAssessment: {
            decision,
            score: fraudAssessment.risk_score,
            level: fraudAssessment.risk_level,
            scoringMode: fraudAssessment.scoring_mode || 'heuristic_fallback',
            factors: fraudAssessment.risk_factors,
            flagged: true,
            alertId: fraudAlertRecord.id
          }
        }
      });
    }

    await fundWalletShortfall({
      userId: senderId,
      wallet: senderWallet,
      balance: senderBalance,
      currency: src,
      needed: numericAmount,
      transaction: t
    });

    // Deduct from sender balance only after fraud screening and confirmed funding.
    senderBalance.balance = parseFloat(senderBalance.balance) - numericAmount;
    await senderBalance.save({ transaction: t });

    // 5. If recipient is an existing registered user, credit their wallet
    let recipientCredited = false;
    if (recipientUser.wallet) {
      // Find or create recipient destination currency balance
      let recBalance = await WalletBalance.findOne({
        where: { wallet_id: recipientUser.wallet.id, currency: dst },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!recBalance) {
        recBalance = await WalletBalance.create({
          wallet_id: recipientUser.wallet.id,
          currency: dst,
          balance: 0.0000
        }, { transaction: t });
      }

      // If not flagged/high risk, credit immediately. If high risk, hold until review
      if (!isReview) {
        recBalance.balance = parseFloat(recBalance.balance) + convertedAmount;
        await recBalance.save({ transaction: t });
        recipientCredited = true;
      }
    }

    // Save the review alert after its transaction record has been staged.
    let fraudAlertRecord = null;
    if (isReview) {
      fraudAlertRecord = await FraudAlert.create({
        transaction_id: transaction.id,
        risk_score: fraudAssessment.risk_score,
        risk_level: fraudAssessment.risk_level,
        reason: fraudAssessment.risk_factors.join('; '),
        review_status: 'PENDING',
        notes: `Transfer of ${numericAmount.toFixed(2)} ${src} to ${recipientEmail} flagged for review.`
      }, { transaction: t });
    }

    await t.commit();
    console.info(`[TransferController] Persisted public.transactions id=${transaction.id} status=${transactionStatus}`);
    if (fraudAlertRecord) {
      console.info(`[TransferController] Persisted public.fraud_alerts id=${fraudAlertRecord.id} status=PENDING`);
    }

    return res.status(200).json({
      success: true,
      message: isReview
        ? 'Transfer submitted and held for security review due to the risk assessment.'
        : `Transfer of ${numericAmount.toFixed(2)} ${src} (${convertedAmount.toFixed(2)} ${dst}) sent successfully!`,
      transfer: {
        transactionId: transaction.id,
        status: transactionStatus,
        recipient: recipientEmail,
        sourceAmount: numericAmount,
        sourceCurrency: src,
        convertedAmount,
        destinationCurrency: dst,
        exchangeRate,
        feeAmount: quote.feeAmount,
        feeCurrency: quote.feeCurrency,
        recipientCredited,
        newBalance: parseFloat(senderBalance.balance),
        riskAssessment: {
          decision,
          score: fraudAssessment.risk_score,
          level: fraudAssessment.risk_level,
            scoringMode: fraudAssessment.scoring_mode || 'heuristic_fallback',
          factors: fraudAssessment.risk_factors,
          flagged: isReview || isBlocked,
          alertId: fraudAlertRecord ? fraudAlertRecord.id : null
        }
      }
    });
  } catch (error) {
    console.error('[TransferController] Transfer transaction failed:', error.message);
    if (t && !t.finished) await t.rollback();
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Transfer execution failed',
      ...(error.status ? {} : { error: error.message })
    });
  }
};

const buildPaySimFeatures = async ({ amount, sourceBalance, sourceCurrency, destinationBalance, destinationCurrency, convertedAmount, isTransfer, hour }) => {
  const amountUsd = await convertToUSD(sourceCurrency, amount);
  const oldbalanceOrg = await convertToUSD(sourceCurrency, sourceBalance);
  const oldbalanceDest = await convertToUSD(destinationCurrency, destinationBalance);
  const newbalanceDest = oldbalanceDest + await convertToUSD(destinationCurrency, convertedAmount);
  const newbalanceOrig = oldbalanceOrg - amountUsd;
  return {
    amount: amountUsd,
    is_transfer: isTransfer ? 1 : 0,
    oldbalanceOrg,
    newbalanceOrig,
    oldbalanceDest,
    newbalanceDest,
    hour: hour % 24,
    balance_error: newbalanceOrig + amountUsd - oldbalanceOrg
  };
};

module.exports = {
  preScreenTransferRisk,
  executeTransfer
};
