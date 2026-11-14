const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});
const axios = require('axios');
const app = require('./app');
const {
  sequelize,
  User,
  WalletBalance,
  Transaction,
  FraudAlert,
  LinkedAccount
} = require('./models');
const { validateDatabaseConfig } = require('./config/database');
const { dialect } = require('./config/database');

const PORT = process.env.PORT || 5000;

const validateRuntimeServices = async () => {
  validateDatabaseConfig();

  const fraudServiceUrl = (process.env.FRAUD_SERVICE_URL || 'http://127.0.0.1:5001').replace(/\/$/, '');

  try {
    const response = await axios.get(`${fraudServiceUrl}/api/health`, { timeout: 3000 });
    if (response.data && response.data.status === 'healthy') {
      console.log('[Server] Fraud detection service is reachable at', fraudServiceUrl);
    } else {
      console.warn('[Server] Fraud detection service health check returned unexpected data:', response.data);
    }
  } catch (error) {
    console.warn('[Server] Fraud detection service is unavailable or not running yet. Continuing in fallback mode.', error.message);
  }
};

const ensureModelColumns = async (model, attributeNames) => {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = model.getTableName();
  const columns = await queryInterface.describeTable(tableName);

  for (const attributeName of attributeNames) {
    const attribute = model.rawAttributes[attributeName];
    const columnName = attribute.field || attributeName;
    if (!columns[columnName]) {
      const definition = {
        type: attribute.type,
        allowNull: attribute.allowNull
      };
      if (attribute.defaultValue !== undefined) {
        definition.defaultValue = attribute.defaultValue;
      } else if (!attribute.allowNull && columnName.endsWith('_at')) {
        definition.defaultValue = sequelize.literal('CURRENT_TIMESTAMP');
      }
      await queryInterface.addColumn(tableName, columnName, definition);
      console.log(
        `[Server] Added missing column ${tableName.schema || 'public'}.` +
        `${tableName.tableName || tableName}.${columnName}`
      );
    }
  }
};

const startServer = async () => {
  try {
    console.log('[Server] Validating runtime configuration...');
    await validateRuntimeServices();

    console.log('[Server] Connecting to database...');
    await sequelize.authenticate();
    const [databaseIdentity] = await sequelize.query(
      `SELECT current_database() AS database, current_schema() AS schema, current_user AS role`
    );
    console.log(
      `[Server] PostgreSQL connection verified: database=${databaseIdentity[0].database}, ` +
      `schema=${databaseIdentity[0].schema}, host=${sequelize.config.host}, ` +
      `port=${sequelize.config.port}, role=${databaseIdentity[0].role}`
    );

    await sequelize.sync();
    console.log('[Server] Database models synchronized.');
    await ensureModelColumns(User, [
      'kyc_status',
      'kyc_tier',
      'daily_limit_usd',
      'id_document_type',
      'id_document_number'
    ]);
    await ensureModelColumns(WalletBalance, ['createdAt']);
    await ensureModelColumns(LinkedAccount, ['country', 'simulated_balance']);
    await ensureModelColumns(Transaction, [
      'scoring_mode',
      'updatedAt',
      'funding_source_id',
      'provider_ref',
      'fee_amount',
      'fee_currency'
    ]);
    await ensureModelColumns(FraudAlert, ['updatedAt']);
    if (dialect === 'postgres') {
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_provider_ref
        ON transactions(provider_ref) WHERE provider_ref IS NOT NULL;
      `);
      await sequelize.query(`
        ALTER TABLE linked_accounts ALTER COLUMN provider TYPE VARCHAR(40);
        ALTER TABLE linked_accounts DROP CONSTRAINT IF EXISTS linked_accounts_provider_check;
        ALTER TABLE linked_accounts DROP CONSTRAINT IF EXISTS linked_accounts_country_check;
        ALTER TABLE linked_accounts ADD CONSTRAINT linked_accounts_provider_check
          CHECK (provider IN (
            'ecocash', 'onemoney', 'bank', 'mtn_momo', 'airtel_money',
            'bank_eft', 'card', 'orange_money', 'myzaka', 'bank_transfer'
          ));
        ALTER TABLE linked_accounts ADD CONSTRAINT linked_accounts_country_check
          CHECK (country IN ('ZW', 'ZM', 'ZA', 'BW', 'GB', 'EU'));
        ALTER TABLE linked_accounts DROP CONSTRAINT IF EXISTS linked_accounts_currency_check;
        ALTER TABLE linked_accounts ADD CONSTRAINT linked_accounts_currency_check
          CHECK (currency IN ('USD', 'GBP', 'EUR', 'ZAR', 'ZMW', 'ZWG', 'BWP'));
      `);
      await sequelize.query(`
        DO $migration$
        DECLARE user_id_type TEXT;
        BEGIN
          SELECT format_type(attribute.atttypid, attribute.atttypmod)
          INTO user_id_type
          FROM pg_attribute AS attribute
          WHERE attribute.attrelid = 'public.users'::regclass
            AND attribute.attname = 'id'
            AND NOT attribute.attisdropped;

          EXECUTE format(
            'ALTER TABLE linked_accounts ALTER COLUMN user_id TYPE %s USING user_id::text::%s',
            user_id_type,
            user_id_type
          );

          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'linked_accounts_user_id_fkey'
              AND conrelid = 'public.linked_accounts'::regclass
          ) THEN
            ALTER TABLE linked_accounts ADD CONSTRAINT linked_accounts_user_id_fkey
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'transactions_funding_source_id_fkey'
              AND conrelid = 'public.transactions'::regclass
          ) THEN
            ALTER TABLE transactions ADD CONSTRAINT transactions_funding_source_id_fkey
              FOREIGN KEY (funding_source_id) REFERENCES linked_accounts(id) ON DELETE SET NULL;
          END IF;
        END $migration$;
      `);
      await sequelize.query(`
        ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_default_currency_check;
        ALTER TABLE wallets ADD CONSTRAINT wallets_default_currency_check
          CHECK (default_currency IN ('USD', 'GBP', 'EUR', 'ZAR', 'ZMW', 'ZWG', 'BWP'));
        ALTER TABLE wallet_balances DROP CONSTRAINT IF EXISTS wallet_balances_currency_check;
        ALTER TABLE wallet_balances ADD CONSTRAINT wallet_balances_currency_check
          CHECK (currency IN ('USD', 'GBP', 'EUR', 'ZAR', 'ZMW', 'ZWG', 'BWP'));
        ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
        ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
          CHECK (status IN ('COMPLETED', 'PENDING_REVIEW', 'FLAGGED', 'FAILED', 'REJECTED', 'pending', 'success', 'failed'));
      `);
    }

    app.listen(PORT, () => {
      console.log(`[Server] ==============================================`);
      console.log(`[Server] Smart Travel Wallet API running on port ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Server] Health Check: http://localhost:${PORT}/api/health`);
      console.log(`[Server] ==============================================`);
    });
  } catch (error) {
    console.error('[Server] Failed to connect to database or start server:', error.message);
    process.exit(1);
  }
};

startServer();
