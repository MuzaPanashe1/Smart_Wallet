const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Wallet, WalletBalance, LinkedAccount, sequelize } = require('../models');
const { JWT_SECRET } = require('../middleware/auth');
const { SUPPORTED_CURRENCIES } = require('../services/exchangeRateService');
const { COUNTRY_NAMES, getProvider, normalizeCountry } = require('../config/providers');

/**
 * Register a new user and initialize a multi-currency wallet with balances
 */
const register = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, email, password, country, phone, defaultCurrency, fundingSource } = req.body;
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedCountry = normalizeCountry(fundingSource?.country || country);
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : null;

    if (!normalizedName || normalizedName.length < 2 || !normalizedEmail || !password) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters and include a letter and a number'
      });
    }

    const providerKey = String(fundingSource?.provider || '').trim().toLowerCase();
    const accountNumber = String(fundingSource?.accountNumber || '').trim();
    const provider = getProvider(normalizedCountry, providerKey);
    if (!COUNTRY_NAMES[normalizedCountry] || !provider) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Select a supported country and provider for your local account'
      });
    }
    if (accountNumber.length < 5 || accountNumber.length > 100) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Enter a valid local account number' });
    }
    if (String(fundingSource?.otp || '').trim() !== '123456') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'The mock account approval code is invalid' });
    }

    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists'
      });
    }

    const preferredCurrency = (defaultCurrency && SUPPORTED_CURRENCIES.includes(String(defaultCurrency).toUpperCase()))
      ? String(defaultCurrency).toUpperCase()
      : 'USD';

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password_hash,
      role: 'user',
      country: normalizedCountry,
      phone: normalizedPhone || null
    }, { transaction: t });

    const wallet = await Wallet.create({
      user_id: user.id,
      default_currency: preferredCurrency
    }, { transaction: t });

    const initialBalances = SUPPORTED_CURRENCIES.map((currency) => ({
      currency,
      balance: 0.0000
    }));

    for (const balance of initialBalances) {
      await WalletBalance.create({
        wallet_id: wallet.id,
        currency: balance.currency,
        balance: balance.balance
      }, { transaction: t });
    }

    await LinkedAccount.create({
      user_id: user.id,
      country: normalizedCountry,
      provider: providerKey,
      account_number: accountNumber,
      currency: provider.currencies[0],
      simulated_balance: 10000,
      status: 'ACTIVE'
    }, { transaction: t });

    await t.commit();

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account registered, wallet initialized, and local account linked successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country,
        defaultCurrency: preferredCurrency,
        wallet: {
          id: wallet.id,
          userId: wallet.user_id,
          defaultCurrency: preferredCurrency,
          balances: initialBalances.map((balance) => ({
            currency: balance.currency,
            balance: balance.balance,
            valueInDefaultCurrency: 0
          }))
        }
      }
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({
      success: false,
      message: 'Registration failed due to internal server error',
      error: error.message
    });
  }
};

/**
 * User login with credential validation
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({
      where: { email: normalizedEmail },
      include: [
        {
          model: Wallet,
          as: 'wallet',
          include: [{ model: WalletBalance, as: 'balances' }]
        }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.validatePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country,
        wallet: user.wallet
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Login failed due to internal server error',
      error: error.message
    });
  }
};

/**
 * Get current authenticated user profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'role', 'country', 'phone', 'kyc_status', 'kyc_tier', 'daily_limit_usd', 'id_document_type', 'id_document_number', 'created_at'],
      include: [
        {
          model: Wallet,
          as: 'wallet',
          include: [{ model: WalletBalance, as: 'balances' }]
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

/**
 * Get user KYC status and limits
 */
const getKycStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'kyc_status', 'kyc_tier', 'daily_limit_usd', 'id_document_type', 'id_document_number', 'updated_at']
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      kyc: {
        status: user.kyc_status || 'TIER_1_PENDING',
        tier: user.kyc_tier || 1,
        dailyLimitUsd: parseFloat(user.daily_limit_usd || 1500.0),
        documentType: user.id_document_type,
        documentNumber: user.id_document_number,
        lastUpdated: user.updated_at
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve KYC status',
      error: error.message
    });
  }
};

/**
 * Verify or upgrade account KYC status
 */
const verifyKyc = async (req, res) => {
  try {
    const { documentType, documentNumber } = req.body;
    if (!documentType || !documentNumber) {
      return res.status(400).json({
        success: false,
        message: 'Identity document type and document number are required'
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.kyc_status = 'VERIFIED';
    user.kyc_tier = 2;
    user.daily_limit_usd = 5000.0000;
    user.id_document_type = String(documentType).trim();
    user.id_document_number = String(documentNumber).trim();
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Account identity verified successfully! Daily transfer limit upgraded to $5,000.00 USD equivalent.',
      kyc: {
        status: user.kyc_status,
        tier: user.kyc_tier,
        dailyLimitUsd: parseFloat(user.daily_limit_usd)
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'KYC submission failed',
      error: error.message
    });
  }
};

/**
 * Logout
 */
const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

module.exports = {
  register,
  login,
  getProfile,
  getKycStatus,
  verifyKyc,
  logout
};
