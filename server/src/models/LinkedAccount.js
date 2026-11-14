const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LinkedAccount = sequelize.define('LinkedAccount', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  country: {
    type: DataTypes.STRING(2),
    allowNull: false,
    defaultValue: 'ZW'
  },
  provider: {
    type: DataTypes.STRING(40),
    allowNull: false
  },
  account_number: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: {
      isIn: [['USD', 'ZMW', 'ZWG', 'ZAR', 'BWP', 'GBP', 'EUR']]
    }
  },
  simulated_balance: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: false,
    defaultValue: 10000,
    get() {
      return Number(this.getDataValue('simulated_balance') || 0);
    }
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'ACTIVE',
    validate: {
      isIn: [['ACTIVE', 'INACTIVE']]
    }
  }
}, {
  tableName: 'linked_accounts',
  timestamps: true,
  underscored: true
});

module.exports = LinkedAccount;
