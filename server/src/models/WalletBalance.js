const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WalletBalance = sequelize.define('WalletBalance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  wallet_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: {
      isIn: [['USD', 'ZMW', 'ZWG', 'ZAR', 'EUR', 'GBP', 'BWP']]
    }
  },
  balance: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: false,
    defaultValue: 0.0000,
    validate: {
      min: 0.0000
    },
    get() {
      const val = this.getDataValue('balance');
      return val === null ? 0 : parseFloat(val);
    }
  }
}, {
  tableName: 'wallet_balances',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['wallet_id', 'currency']
    }
  ]
});

module.exports = WalletBalance;
