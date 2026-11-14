const { Wallet, WalletBalance, Transaction, FraudAlert, sequelize } = require('../models');
const {
  SUPPORTED_CURRENCIES,
  createRateQuote,
  validateRateQuote
} = require('../services/exchangeRateService');
const { assessTransactionRisk } = require('../services/fraudServiceClient');
const { fundWalletShortfall } = require('../services/automaticFunding');

/**
 * Preview conversion calculation without committing
 */
const previewConversion = async (req, res) => {
  try {
    const { sourceCurrency, destinationCurrency, amount } = req.body;
    const numericAmount = parseFloat(amount);

    if (!sourceCurrency || !destinationCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Both source and destination currencies are required'
      });
    }

    const src = sourceCurrency.toUpperCase();
    const dst = destinationCurrency.toUpperCase();

    if (!SUPPORTED_CURRENCIES.includes(src) || !SUPPORTED_CURRENCIES.includes(dst)) {
      return res.status(400).json({
        success: false,
        message: `Currencies must be among: ${SUPPORTED_CURRENCIES.join(', ')}`
      });
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    const quote = await createRateQuote(src, dst, numericAmount);

    return res.status(200).json({
      success: true,
      data: {
        ...quote,
        exchangeRate: quote.effectiveRate,
        fee: quote.feeAmount
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Conversion preview failed',
      error: error.message
    });
  }
};

/**
 * Execute multi-currency conversion with ACID database transaction
 */
const executeConversion = async (req, res) => {
  let t;
  try {
    t = await sequelize.transaction();
    const { sourceCurrency, destinationCurrency, amount, quoteId } = req.body;
    const numericAmount = parseFloat(amount);
    const userId = req.user.id;

    if (!sourceCurrency || !destinationCurrency) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Source and destination currencies are required'
      });
    }

    const src = sourceCurrency.toUpperCase();
    const dst = destinationCurrency.toUpperCase();

    if (!SUPPORTED_CURRENCIES.includes(src) || !SUPPORTED_CURRENCIES.includes(dst)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Currencies must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`
      });
    }

    if (src === dst) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Source and destination currencies cannot be identical'
      });
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than zero'
      });
    }

    // Find user's wallet
    const wallet = await Wallet.findOne({
      where: { user_id: userId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!wallet) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // Find source balance
    let sourceBalanceRecord = await WalletBalance.findOne({
      where: { wallet_id: wallet.id, currency: src },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!sourceBalanceRecord) {
      sourceBalanceRecord = await WalletBalance.create({
        wallet_id: wallet.id,
        currency: src,
        balance: 0
      }, { transaction: t });
    }

    // Find or create destination balance record
    let destBalanceRecord = await WalletBalance.findOne({
      where: { wallet_id: wallet.id, currency: dst },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!destBalanceRecord) {
      destBalanceRecord = await WalletBalance.create({
        wallet_id: wallet.id,
        currency: dst,
        balance: 0.0000
      }, { transaction: t });
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
    const rate = quote.effectiveRate;
    const convertedAmount = quote.convertedAmount;
    const feeAmount = quote.feeAmount;

    // Optional fraud assessment on conversion
    const fraudAssessment = await assessTransactionRisk({
      userId,
      transactionType: 'CONVERSION',
      sourceCurrency: src,
      destinationCurrency: dst,
      sourceAmount: numericAmount
    });
    const isFlagged = ['Medium Risk', 'High Risk'].includes(fraudAssessment.risk_level);

    await fundWalletShortfall({
      userId,
      wallet,
      balance: sourceBalanceRecord,
      currency: src,
      needed: numericAmount,
      transaction: t
    });

    // Reserve source funds while a high-risk conversion waits for review.
    sourceBalanceRecord.balance = parseFloat(sourceBalanceRecord.balance) - numericAmount;
    await sourceBalanceRecord.save({ transaction: t });

    if (!isFlagged) {
      destBalanceRecord.balance = parseFloat(destBalanceRecord.balance) + convertedAmount;
      await destBalanceRecord.save({ transaction: t });
    }

    // Record transaction
    const transaction = await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      transaction_type: 'CONVERSION',
      source_currency: src,
      destination_currency: dst,
      source_amount: numericAmount,
      converted_amount: convertedAmount,
      exchange_rate: rate,
      fee_amount: feeAmount,
      fee_currency: dst,
      recipient_info: 'Self (Multi-Currency Conversion)',
      status: isFlagged ? 'FLAGGED' : 'COMPLETED',
      fraud_risk_score: fraudAssessment.risk_score,
      fraud_risk_level: fraudAssessment.risk_level,
      scoring_mode: fraudAssessment.scoring_mode || 'heuristic_fallback',
      risk_factors: fraudAssessment.risk_factors
    }, { transaction: t });

    let fraudAlert = null;
    if (isFlagged) {
      fraudAlert = await FraudAlert.create({
        transaction_id: transaction.id,
        risk_score: fraudAssessment.risk_score,
        risk_level: fraudAssessment.risk_level,
        reason: fraudAssessment.risk_factors.join('; '),
        review_status: 'PENDING',
        notes: 'Source funds are reserved until this conversion is approved or rejected.'
      }, { transaction: t });
    }

    await t.commit();
    console.info(`[ConversionController] Persisted public.transactions id=${transaction.id} type=CONVERSION`);
    if (fraudAlert) {
      console.info(`[ConversionController] Persisted public.fraud_alerts id=${fraudAlert.id}`);
    }

    return res.status(200).json({
      success: true,
      message: isFlagged
        ? 'Conversion reserved and flagged for security review. Destination funds will be released after approval.'
        : `Successfully converted ${numericAmount.toFixed(2)} ${src} to ${convertedAmount.toFixed(2)} ${dst}`,
      conversion: {
        transactionId: transaction.id,
        status: transaction.status,
        fraudAlertId: fraudAlert?.id || null,
        sourceCurrency: src,
        destinationCurrency: dst,
        sourceAmount: numericAmount,
        convertedAmount,
        exchangeRate: rate,
        rawExchangeRate: quote.rawRate,
        feeAmount,
        feeCurrency: quote.feeCurrency,
        marginPercent: quote.marginPercent,
        newSourceBalance: parseFloat(sourceBalanceRecord.balance),
        newDestinationBalance: parseFloat(destBalanceRecord.balance),
        riskAssessment: {
          score: fraudAssessment.risk_score,
          level: fraudAssessment.risk_level,
          flagged: isFlagged
        }
      }
    });
  } catch (error) {
    console.error('[ConversionController] Conversion transaction failed:', error.message);
    if (t && !t.finished) await t.rollback();
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Conversion failed',
      ...(error.status ? {} : { error: error.message })
    });
  }
};

module.exports = {
  previewConversion,
  executeConversion
};
