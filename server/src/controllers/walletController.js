const { Wallet, WalletBalance } = require('../models');
const { SUPPORTED_CURRENCIES, convertCurrency, getDirectRate } = require('../services/exchangeRateService');

/**
 * Get user wallet with all multi-currency balances and total portfolio value in default currency
 */
const getWallet = async (req, res) => {
  try {
    const userId = req.user.id;

    let wallet = await Wallet.findOne({
      where: { user_id: userId },
      include: [
        {
          model: WalletBalance,
          as: 'balances'
        }
      ]
    });

    // If wallet doesn't exist for some reason, auto-initialize
    if (!wallet) {
      wallet = await Wallet.create({ user_id: userId, default_currency: 'USD' });
      for (const curr of SUPPORTED_CURRENCIES) {
        await WalletBalance.create({
          wallet_id: wallet.id,
          currency: curr,
          balance: 0.0000
        });
      }
      wallet = await Wallet.findByPk(wallet.id, {
        include: [{ model: WalletBalance, as: 'balances' }]
      });
    }

    // Ensure all supported currencies are represented in balances
    const existingCurrencies = wallet.balances.map(b => b.currency);
    for (const curr of SUPPORTED_CURRENCIES) {
      if (!existingCurrencies.includes(curr)) {
        const newBal = await WalletBalance.create({
          wallet_id: wallet.id,
          currency: curr,
          balance: 0.0000
        });
        wallet.balances.push(newBal);
      }
    }

    // Calculate total converted balance in user's default currency
    const defaultCurr = wallet.default_currency || 'USD';
    let totalInDefaultCurrency = 0;

    const balancesWithValues = [];
    for (const bal of wallet.balances) {
      const numBal = parseFloat(bal.balance);
      let convertedValue = numBal;
      if (bal.currency !== defaultCurr && numBal > 0) {
        const rate = await getDirectRate(bal.currency, defaultCurr);
        convertedValue = parseFloat((numBal * rate).toFixed(2));
      }
      totalInDefaultCurrency += convertedValue;
      balancesWithValues.push({
        id: bal.id,
        currency: bal.currency,
        balance: numBal,
        valueInDefaultCurrency: convertedValue,
        updatedAt: bal.updated_at
      });
    }

    return res.status(200).json({
      success: true,
      wallet: {
        id: wallet.id,
        userId: wallet.user_id,
        defaultCurrency: defaultCurr,
        totalBalanceInDefault: parseFloat(totalInDefaultCurrency.toFixed(2)),
        balances: balancesWithValues,
        supportedCurrencies: SUPPORTED_CURRENCIES
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve wallet',
      error: error.message
    });
  }
};

/**
 * Set user's preferred default currency (e.g. USD, ZAR, BWP, etc.)
 */
const setDefaultCurrency = async (req, res) => {
  try {
    const { currency } = req.body;
    if (!currency || !SUPPORTED_CURRENCIES.includes(currency.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`
      });
    }

    const wallet = await Wallet.findOne({ where: { user_id: req.user.id } });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    wallet.default_currency = currency.toUpperCase();
    await wallet.save();

    return res.status(200).json({
      success: true,
      message: `Default currency updated to ${wallet.default_currency}`,
      defaultCurrency: wallet.default_currency
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update default currency',
      error: error.message
    });
  }
};

module.exports = {
  getWallet,
  setDefaultCurrency
};
