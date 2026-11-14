const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  wallet_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  transaction_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['CONVERSION', 'TRANSFER', 'DEPOSIT']]
    }
  },
  funding_source_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  provider_ref: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  source_currency: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  destination_currency: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  source_amount: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: false,
    get() {
      const val = this.getDataValue('source_amount');
      return val === null ? 0 : parseFloat(val);
    }
  },
  converted_amount: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: false,
    get() {
      const val = this.getDataValue('converted_amount');
      return val === null ? 0 : parseFloat(val);
    }
  },
  exchange_rate: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    defaultValue: 1.000000,
    get() {
      const val = this.getDataValue('exchange_rate');
      return val === null ? 1 : parseFloat(val);
    }
  },
  fee_amount: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: false,
    defaultValue: 0,
    get() {
      const val = this.getDataValue('fee_amount');
      return val === null ? 0 : parseFloat(val);
    }
  },
  fee_currency: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  recipient_info: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'COMPLETED',
    validate: {
      isIn: [['COMPLETED', 'PENDING_REVIEW', 'FLAGGED', 'FAILED', 'REJECTED', 'pending', 'success', 'failed']]
    }
  },
  fraud_risk_score: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00,
    get() {
      const val = this.getDataValue('fraud_risk_score');
      return val === null ? 0 : parseFloat(val);
    }
  },
  fraud_risk_level: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'Low Risk',
    validate: {
      isIn: [['Low Risk', 'Medium Risk', 'High Risk']]
    }
  },
  scoring_mode: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'heuristic_fallback'
  },
  risk_factors: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  }
}, {
  tableName: 'transactions',
  schema: 'public',
  timestamps: true,
  underscored: true
});

module.exports = Transaction;
