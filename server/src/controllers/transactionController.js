const { Transaction, FraudAlert, LinkedAccount } = require('../models');
const { Op } = require('sequelize');
const { getProvider } = require('../config/providers');

const serializeTransaction = (transaction) => {
  const result = transaction.toJSON();
  const source = result.fundingSource;
  if (source) {
    result.fundingSource = {
      provider: source.provider,
      providerName: getProvider(source.country, source.provider)?.label || source.provider,
      accountNumber: `••${String(source.account_number || '').slice(-4)}`
    };
  }
  return result;
};

/**
 * Get user transaction history with filtering and pagination
 */
const getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, currency, status, limit = 50, page = 1 } = req.query;

    const where = { user_id: userId };

    if (type) {
      where.transaction_type = type.toUpperCase();
    }

    if (status) {
      const requestedStatus = status.toLowerCase();
      where.status = ['pending', 'success', 'failed'].includes(requestedStatus)
        ? requestedStatus
        : status.toUpperCase();
    }

    if (currency) {
      where[Op.or] = [
        { source_currency: currency.toUpperCase() },
        { destination_currency: currency.toUpperCase() }
      ];
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      include: [
        {
          model: FraudAlert,
          as: 'fraudAlert',
          required: false
        },
        {
          model: LinkedAccount,
          as: 'fundingSource',
          attributes: ['provider', 'account_number', 'country'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset
    });

    return res.status(200).json({
      success: true,
      totalCount: count,
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(count / parseInt(limit, 10)),
      transactions: rows.map(serializeTransaction)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve transactions',
      error: error.message
    });
  }
};

/**
 * Get detailed transaction by ID
 */
const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const transaction = await Transaction.findOne({
      where: {
        id,
        // Admins can view any transaction, regular users only their own
        ...(req.user.role === 'admin' || req.user.role === 'reviewer' ? {} : { user_id: userId })
      },
      include: [
        {
          model: FraudAlert,
          as: 'fraudAlert'
        },
        {
          model: LinkedAccount,
          as: 'fundingSource',
          attributes: ['provider', 'account_number', 'country'],
          required: false
        }
      ]
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    return res.status(200).json({
      success: true,
      transaction: serializeTransaction(transaction)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction details',
      error: error.message
    });
  }
};

module.exports = {
  getTransactions,
  getTransactionById
};
