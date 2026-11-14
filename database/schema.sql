-- ====================================================================
-- SMART WALLET - RELATIONAL DATABASE SCHEMA (POSTGRESQL)
-- Target: Cross-Border Travellers (USD, GBP, EUR, ZAR, ZMW, ZWG, BWP)
-- ====================================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 1. USERS TABLE
-- Stores traveller credentials, roles, and timestamps
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'reviewer')),
    phone VARCHAR(50),
    country VARCHAR(100) DEFAULT 'Zimbabwe',
    kyc_status VARCHAR(50) NOT NULL DEFAULT 'TIER_1_PENDING',
    kyc_tier INTEGER NOT NULL DEFAULT 1,
    daily_limit_usd NUMERIC(18, 4) NOT NULL DEFAULT 1500.0000,
    id_document_type VARCHAR(50),
    id_document_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) NOT NULL DEFAULT 'TIER_1_PENDING';
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_tier INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_limit_usd NUMERIC(18, 4) NOT NULL DEFAULT 1500.0000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_document_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_document_number VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- --------------------------------------------------------------------
-- 2. WALLETS TABLE
-- Each user owns a multi-currency wallet container
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    default_currency VARCHAR(10) NOT NULL DEFAULT 'USD' CHECK (default_currency IN ('USD', 'GBP', 'EUR', 'ZAR', 'ZMW', 'ZWG', 'BWP')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_wallet UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- --------------------------------------------------------------------
-- 2A. LINKED FUNDING SOURCES
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS linked_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    country VARCHAR(2) NOT NULL CHECK (country IN ('ZW', 'ZM', 'ZA', 'BW', 'GB', 'EU')),
    provider VARCHAR(40) NOT NULL CHECK (provider IN (
        'ecocash', 'onemoney', 'bank', 'mtn_momo', 'airtel_money',
        'bank_eft', 'card', 'orange_money', 'myzaka', 'bank_transfer'
    )),
    account_number VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('USD', 'GBP', 'EUR', 'ZAR', 'ZMW', 'ZWG', 'BWP')),
    simulated_balance NUMERIC(18, 4) NOT NULL DEFAULT 10000.0000,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
END $migration$;

CREATE INDEX IF NOT EXISTS idx_linked_accounts_user_id ON linked_accounts(user_id);
ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'ZW';
ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS simulated_balance NUMERIC(18, 4) NOT NULL DEFAULT 10000.0000;
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

-- --------------------------------------------------------------------
-- 3. WALLET BALANCES TABLE
-- Normalized separate storage for each currency balance per wallet
-- Supported: USD, GBP, EUR, ZAR, ZMW, ZWG, BWP
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallet_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('USD', 'GBP', 'EUR', 'ZAR', 'ZMW', 'ZWG', 'BWP')),
    balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (balance >= 0.0000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_wallet_currency UNIQUE (wallet_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_balances_wallet_currency ON wallet_balances(wallet_id, currency);
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_default_currency_check;
ALTER TABLE wallets ADD CONSTRAINT wallets_default_currency_check
    CHECK (default_currency IN ('USD', 'GBP', 'EUR', 'ZAR', 'ZMW', 'ZWG', 'BWP'));
ALTER TABLE wallet_balances DROP CONSTRAINT IF EXISTS wallet_balances_currency_check;
ALTER TABLE wallet_balances ADD CONSTRAINT wallet_balances_currency_check
    CHECK (currency IN ('USD', 'GBP', 'EUR', 'ZAR', 'ZMW', 'ZWG', 'BWP'));

-- --------------------------------------------------------------------
-- 4. TRANSACTIONS TABLE
-- Auditable ledger for conversions, peer transfers, and deposits
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('CONVERSION', 'TRANSFER', 'DEPOSIT')),
    source_currency VARCHAR(10) NOT NULL,
    destination_currency VARCHAR(10) NOT NULL,
    source_amount NUMERIC(18, 4) NOT NULL CHECK (source_amount > 0),
    converted_amount NUMERIC(18, 4) NOT NULL CHECK (converted_amount >= 0),
    exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1.000000,
    fee_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (fee_amount >= 0),
    fee_currency VARCHAR(10),
    recipient_info VARCHAR(255),
    funding_source_id UUID,
    provider_ref VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'PENDING_REVIEW', 'FLAGGED', 'FAILED', 'REJECTED', 'pending', 'success', 'failed')),
    fraud_risk_score NUMERIC(5, 2) DEFAULT 0.00,
    fraud_risk_level VARCHAR(20) DEFAULT 'Low Risk' CHECK (fraud_risk_level IN ('Low Risk', 'Medium Risk', 'High Risk')),
    scoring_mode VARCHAR(40) NOT NULL DEFAULT 'heuristic_fallback',
    risk_factors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS scoring_mode VARCHAR(40) NOT NULL DEFAULT 'heuristic_fallback';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS funding_source_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider_ref VARCHAR(100);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fee_currency VARCHAR(10);
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('COMPLETED', 'PENDING_REVIEW', 'FLAGGED', 'FAILED', 'REJECTED', 'pending', 'success', 'failed'));

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'transactions_funding_source_id_fkey'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_funding_source_id_fkey
            FOREIGN KEY (funding_source_id) REFERENCES linked_accounts(id) ON DELETE SET NULL;
    END IF;
END $migration$;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_provider_ref ON transactions(provider_ref) WHERE provider_ref IS NOT NULL;

-- --------------------------------------------------------------------
-- 5. FRAUD ALERTS & REVIEWS TABLE
-- Stores risk evaluation details, flagged alerts, and admin decisions
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fraud_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    risk_score NUMERIC(5, 2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('Low Risk', 'Medium Risk', 'High Risk')),
    reason TEXT NOT NULL,
    review_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED', 'RESOLVED')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_transaction ON fraud_alerts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_review_status ON fraud_alerts(review_status);

-- --------------------------------------------------------------------
-- 6. EXCHANGE RATE SNAPSHOTS
-- Stores the latest live or sandbox rate snapshot relative to USD
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    currency VARCHAR(10) NOT NULL,
    rate NUMERIC(18, 8) NOT NULL CHECK (rate > 0),
    source VARCHAR(40) NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_exchange_rate_pair UNIQUE (base_currency, currency)
);
 