const { sequelize } = require('../config/database');
const User = require('./User');
const Wallet = require('./Wallet');
const WalletBalance = require('./WalletBalance');
const Transaction = require('./Transaction');
const FraudAlert = require('./FraudAlert');
const ExchangeRate = require('./ExchangeRate');
const LinkedAccount = require('./LinkedAccount');

// User <-> Wallet (1:1)
User.hasOne(Wallet, { foreignKey: 'user_id', as: 'wallet', onDelete: 'CASCADE' });
Wallet.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Wallet <-> WalletBalance (1:N)
Wallet.hasMany(WalletBalance, { foreignKey: 'wallet_id', as: 'balances', onDelete: 'CASCADE' });
WalletBalance.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'wallet' });

// User <-> Transaction (1:N)
User.hasMany(Transaction, { foreignKey: 'user_id', as: 'transactions', onDelete: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
LinkedAccount.hasMany(Transaction, { foreignKey: 'funding_source_id', as: 'transactions', onDelete: 'SET NULL' });
Transaction.belongsTo(LinkedAccount, { foreignKey: 'funding_source_id', as: 'fundingSource' });

// Wallet <-> Transaction (1:N)
Wallet.hasMany(Transaction, { foreignKey: 'wallet_id', as: 'transactions', onDelete: 'CASCADE' });
Transaction.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'wallet' });

// Transaction <-> FraudAlert (1:1)
Transaction.hasOne(FraudAlert, { foreignKey: 'transaction_id', as: 'fraudAlert', onDelete: 'CASCADE' });
FraudAlert.belongsTo(Transaction, { foreignKey: 'transaction_id', as: 'transaction' });

// User (Reviewer) <-> FraudAlert (1:N)
User.hasMany(FraudAlert, { foreignKey: 'reviewed_by', as: 'reviewedAlerts', onDelete: 'SET NULL' });
FraudAlert.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

module.exports = {
  sequelize,
  User,
  Wallet,
  WalletBalance,
  Transaction,
  FraudAlert,
  ExchangeRate,
  LinkedAccount
};
