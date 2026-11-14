const { FraudAlert, Transaction, User, Wallet, WalletBalance, sequelize } = require('../models');

/**
 * Get all fraud alerts for admin/reviewer dashboard
 */
const getFraudAlerts = async (req, res) => {
  try {
    const { status, riskLevel } = req.query;
    const where = {};

    if (status) {
      where.review_status = status.toUpperCase();
    }

    if (riskLevel) {
      where.risk_level = riskLevel;
    }

    const alerts = await FraudAlert.findAll({
      where,
      include: [
        {
          model: Transaction,
          as: 'transaction',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'email', 'country']
            }
          ]
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve fraud alerts',
      error: error.message
    });
  }
};

/**
 * Get fraud alerts relevant to current user
 */
const getUserFraudAlerts = async (req, res) => {
  try {
    const userId = req.user.id;

    const alerts = await FraudAlert.findAll({
      include: [
        {
          model: Transaction,
          as: 'transaction',
          where: { user_id: userId },
          attributes: ['id', 'transaction_type', 'source_currency', 'destination_currency', 'source_amount', 'converted_amount', 'status', 'fraud_risk_score', 'fraud_risk_level', 'scoring_mode', 'created_at']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      alerts
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve your fraud alerts',
      error: error.message
    });
  }
};

/**
 * Admin / Reviewer review action: Approve, Reject, or Resolve
 */
const reviewFraudAlert = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { decision, notes } = req.body; // decision: 'APPROVED' or 'REJECTED' or 'RESOLVED'
    const reviewerId = req.user.id;

    if (!['APPROVED', 'REJECTED', 'RESOLVED'].includes(decision)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be APPROVED, REJECTED, or RESOLVED'
      });
    }

    const alert = await FraudAlert.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!alert) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Fraud alert record not found' });
    }

    if (alert.review_status !== 'PENDING') {
      await t.rollback();
      return res.status(409).json({ success: false, message: 'This fraud alert has already been reviewed' });
    }

    const transaction = await Transaction.findByPk(alert.transaction_id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!transaction) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Transaction for fraud alert was not found' });
    }

    alert.review_status = decision;
    alert.reviewed_by = reviewerId;
    alert.reviewed_at = new Date();
    alert.notes = notes || alert.notes;
    await alert.save({ transaction: t });

    // Update corresponding transaction status
    if (decision === 'APPROVED' || decision === 'RESOLVED') {
        if (transaction.transaction_type === 'DEPOSIT' && transaction.funding_source_id) {
          transaction.status = 'FLAGGED';
          alert.notes = [
            alert.notes,
            'A linked-account credit cannot be released by review; the gateway must confirm the pull before wallet credit.'
          ].filter(Boolean).join(' ');
          await alert.save({ transaction: t });
        } else {
        transaction.status = 'COMPLETED';

        if (transaction.transaction_type === 'CONVERSION') {
          const wallet = await Wallet.findByPk(transaction.wallet_id, {
            include: [{ model: WalletBalance, as: 'balances' }],
            transaction: t
          });

          if (!wallet) throw new Error('Wallet for held conversion was not found');

          let destinationBalance = wallet.balances.find((balance) => balance.currency === transaction.destination_currency);
          if (!destinationBalance) {
            destinationBalance = await WalletBalance.create({
              wallet_id: wallet.id,
              currency: transaction.destination_currency,
              balance: 0
            }, { transaction: t });
          }

          destinationBalance.balance = parseFloat(destinationBalance.balance) + parseFloat(transaction.converted_amount);
          await destinationBalance.save({ transaction: t });
        }

        // If a registered transfer recipient was waiting, credit their wallet now.
        if (transaction.transaction_type === 'TRANSFER' && transaction.recipient_info) {
          const recipientUser = await User.findOne({
            where: { email: transaction.recipient_info.toLowerCase() },
            include: [{ model: Wallet, as: 'wallet', include: [{ model: WalletBalance, as: 'balances' }] }],
            transaction: t
          });

          if (recipientUser && recipientUser.wallet) {
            let recBal = recipientUser.wallet.balances.find(b => b.currency === transaction.destination_currency);
            if (!recBal) {
              recBal = await WalletBalance.create({
                wallet_id: recipientUser.wallet.id,
                currency: transaction.destination_currency,
                balance: 0.0000
              }, { transaction: t });
            }
            recBal.balance = parseFloat(recBal.balance) + parseFloat(transaction.converted_amount);
            await recBal.save({ transaction: t });
          }
        }
        }
    } else if (decision === 'REJECTED') {
        if (transaction.transaction_type === 'DEPOSIT' && transaction.funding_source_id) {
          transaction.status = 'failed';
        } else {
        transaction.status = 'REJECTED';

        // Refund sender source balance
        const senderWallet = await Wallet.findByPk(transaction.wallet_id, {
          include: [{ model: WalletBalance, as: 'balances' }],
          transaction: t
        });

        if (senderWallet) {
          const senderBal = senderWallet.balances.find(b => b.currency === transaction.source_currency);
          if (senderBal) {
            senderBal.balance = parseFloat(senderBal.balance) + parseFloat(transaction.source_amount);
            await senderBal.save({ transaction: t });
          }
        }
        }
    }

    await transaction.save({ transaction: t });

    await t.commit();

    return res.status(200).json({
      success: true,
      message: `Fraud alert #${id} has been marked as ${decision}`,
      alert: {
        id: alert.id,
        reviewStatus: alert.review_status,
        reviewedBy: alert.reviewed_by,
        reviewedAt: alert.reviewed_at,
        notes: alert.notes,
        transactionStatus: transaction ? transaction.status : null
      }
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({
      success: false,
      message: 'Failed to update review status',
      error: error.message
    });
  }
};

module.exports = {
  getFraudAlerts,
  getUserFraudAlerts,
  reviewFraudAlert
};
