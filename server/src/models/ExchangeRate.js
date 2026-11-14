const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExchangeRate = sequelize.define('ExchangeRate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  base_currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'USD'
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  rate: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false
  },
  source: {
    type: DataTypes.STRING(40),
    allowNull: false
  },
  fetched_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'exchange_rates',
  timestamps: true,
  underscored: true,
  indexes: [{ unique: true, fields: ['base_currency', 'currency'] }]
});

module.exports = ExchangeRate;