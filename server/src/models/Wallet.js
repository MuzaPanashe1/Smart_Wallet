const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true
  },
  default_currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'USD',
    validate: {
      isIn: [['USD', 'ZMW', 'ZWG', 'ZAR', 'EUR', 'GBP', 'BWP']]
    }
  }
}, {
  tableName: 'wallets',
  timestamps: true,
  underscored: true
});

module.exports = Wallet;
