const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const preferredDialect = process.env.DB_DIALECT || 'postgres';
const storagePath = process.env.SQLITE_STORAGE || path.join(__dirname, '../../../../database/smart_wallet.sqlite');

const validateDatabaseConfig = () => {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasLocalDbConfig = Boolean(
    process.env.DB_HOST &&
    process.env.DB_NAME &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD
  );

  if (!hasDatabaseUrl && !hasLocalDbConfig) {
    throw new Error(
      'Missing database configuration. Provide DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD in the server .env file.'
    );
  }

  if (!process.env.JWT_SECRET) {
    console.warn('[DatabaseConfig] JWT_SECRET is not set; the app will use the development fallback secret.');
  }

  return true;
};

let sequelize;

if (preferredDialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: false
  });
} else {
  validateDatabaseConfig();

  if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      pool: { max: 10, min: 0, acquire: 15000, idle: 10000 },
      dialectOptions: process.env.DB_SSL === 'true' ? {
        ssl: { require: true, rejectUnauthorized: false }
      } : {}
    });
  } else {
    sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        dialect: 'postgres',
        logging: false,
        pool: { max: 10, min: 0, acquire: 15000, idle: 10000 }
      }
    );
  }
}

module.exports = { sequelize, dialect: preferredDialect, storagePath, validateDatabaseConfig };
