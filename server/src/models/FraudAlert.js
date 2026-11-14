const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FraudAlert = sequelize.define('FraudAlert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  transaction_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  risk_score: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    get() {
      const val = this.getDataValue('risk_score');
      return val === null ? 0 : parseFloat(val);
    }
  },
  risk_level: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['Low Risk', 'Medium Risk', 'High Risk']]
    }
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  review_status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'PENDING',
    validate: {
      isIn: [['PENDING', 'APPROVED', 'REJECTED', 'RESOLVED']]
    }
  },
  reviewed_by: {
    type: DataTypes.UUID,
    allowNull: true
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'fraud_alerts',
  schema: 'public',
  timestamps: true,
  underscored: true
});

module.exports = FraudAlert;
