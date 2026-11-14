const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'user',
    validate: {
      isIn: [['user', 'admin', 'reviewer']]
    }
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  country: {
    type: DataTypes.STRING(100),
    defaultValue: 'Zimbabwe'
  },
  kyc_status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'TIER_1_PENDING',
    validate: {
      isIn: [['UNVERIFIED', 'TIER_1_PENDING', 'VERIFIED', 'REJECTED']]
    }
  },
  kyc_tier: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  daily_limit_usd: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: false,
    defaultValue: 1500.0000
  },
  id_document_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  id_document_number: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true
});

User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password_hash);
};

module.exports = User;
