const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { ExchangeRate } = require('../models');

const SUPPORTED_CURRENCIES = ['USD', 'ZMW', 'ZWG', 'ZAR', 'EUR', 'GBP', 'BWP'];
const CACHE_TTL_MS = 60 * 60 * 1000;
const QUOTE_TTL_MS = 60 * 1000;
const activeQuotes = new Map();
let cachedRates = null;
let cachedSource = null;
let cachedTimestamp = null;
let lastFetchTime = 0;

const normalizeCurrency = (code) => {
  if (!code) return 'USD';
  return String(code).trim().toUpperCase();
};

const persistRates = async (rates, source, timestamp) => {
  await ExchangeRate.bulkCreate(SUPPORTED_CURRENCIES.map((currency) => ({
    base_currency: 'USD',
    currency,
    rate: rates[currency],
    source,
    fetched_at: timestamp
  })), {
    updateOnDuplicate: ['rate', 'source', 'fetched_at', 'updated_at']
  });
};

const requestLiveRates = async (url, source, now) => {
  const response = await axios.get(url, { timeout: 8000 });
  const payload = response.data;
  const apiRates = payload?.conversion_rates || payload?.rates;
  if (
    (payload?.result && payload.result !== 'success') ||
    !apiRates ||
    (source === 'exchange_rate_api' && payload?.result !== 'success')
  ) {
    throw new Error(payload?.['error-type'] || 'Exchange-rate provider returned an invalid response');
  }

  const rates = { USD: 1 };
  for (const currency of SUPPORTED_CURRENCIES) {
    const rate = Number(apiRates[currency]);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Exchange-rate response is missing a valid ${currency} rate`);
    }
    rates[currency] = rate;
  }

  const timestamp = payload.time_last_update_unix
    ? new Date(payload.time_last_update_unix * 1000).toISOString()
    : new Date(now).toISOString();
  return { rates, source, timestamp };
};

const loadPersistedRates = async () => {
  const rows = await ExchangeRate.findAll({ where: { base_currency: 'USD' } });
  if (!rows.length) return null;

  const rates = { USD: 1 };
  for (const row of rows) {
    const rate = Number(row.rate);
    if (SUPPORTED_CURRENCIES.includes(row.currency) && Number.isFinite(rate) && rate > 0) {
      rates[row.currency] = rate;
    }
  }
  if (!SUPPORTED_CURRENCIES.every((currency) => Number.isFinite(rates[currency]))) return null;

  const fetchedAt = rows.reduce((latest, row) => Math.max(latest, new Date(row.fetched_at).getTime()), 0);
  return {
    rates,
    source: 'database_cache',
    timestamp: fetchedAt ? new Date(fetchedAt).toISOString() : null
  };
};

const fetchLatestRates = async () => {
  const now = Date.now();
  if (cachedRates && now - lastFetchTime < CACHE_TTL_MS) {
    return { rates: cachedRates, source: cachedSource, timestamp: cachedTimestamp };
  }

  let liveError;
  try {
    const apiKey = process.env.EXCHANGE_API_KEY;
    if (apiKey) {
      try {
        const live = await requestLiveRates(
          `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/USD`,
          'exchange_rate_api',
          now
        );
        cachedRates = live.rates;
        cachedSource = live.source;
        cachedTimestamp = live.timestamp;
        lastFetchTime = now;
        try {
          await persistRates(live.rates, live.source, live.timestamp);
        } catch (error) {
          console.error('[ExchangeRateService] Could not persist live rates:', error.message);
        }
        return live;
      } catch (error) {
        liveError = error;
      }
    }

    const live = await requestLiveRates(
      'https://open.er-api.com/v6/latest/USD',
      'open_er_api',
      now
    );
    cachedRates = live.rates;
    cachedSource = live.source;
    cachedTimestamp = live.timestamp;
    lastFetchTime = now;
    try {
      await persistRates(live.rates, live.source, live.timestamp);
    } catch (error) {
      console.error('[ExchangeRateService] Could not persist live rates:', error.message);
    }
    return live;
  } catch (error) {
    console.warn(
      '[ExchangeRateService] Live rate providers unavailable; checking stored rates.',
      liveError?.code || error.code || `HTTP ${liveError?.response?.status || error.response?.status || 'unknown'}`
    );
  }

  const persisted = await loadPersistedRates();
  if (!persisted) {
    const error = new Error(
      'Live exchange-rate providers are unavailable and no complete stored rate snapshot exists.'
    );
    error.status = 503;
    throw error;
  }

  cachedRates = persisted.rates;
  cachedSource = persisted.source;
  cachedTimestamp = persisted.timestamp;
  lastFetchTime = now;
  return { rates: cachedRates, source: cachedSource, timestamp: cachedTimestamp };
};

const getDirectRate = async (fromCurrency, toCurrency) => {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (!SUPPORTED_CURRENCIES.includes(from) || !SUPPORTED_CURRENCIES.includes(to)) {
    throw new Error(`Unsupported currency pair: ${from}/${to}`);
  }
  if (from === to) return 1;

  const { rates } = await fetchLatestRates();
  const fromUsdRate = rates[from];
  const toUsdRate = rates[to];
  if (!fromUsdRate || !toUsdRate) throw new Error(`No exchange rate available for ${from} or ${to}`);
  return Number((toUsdRate / fromUsdRate).toFixed(6));
};

const convertCurrency = async (fromCurrency, toCurrency, amount) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Conversion amount must be a positive number');
  }
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  const rate = await getDirectRate(from, to);
  return {
    sourceCurrency: from,
    destinationCurrency: to,
    sourceAmount: numericAmount,
    convertedAmount: Number((numericAmount * rate).toFixed(4)),
    exchangeRate: rate
  };
};

const createRateQuote = async (fromCurrency, toCurrency, amount, marginPercent = 0.005) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Valid conversion amount is required for a quote');
  }
  if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent >= 1) {
    throw new Error('Margin must be between 0 and 1');
  }

  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  const rawRate = await getDirectRate(from, to);
  const effectiveRate = Number((rawRate * (from === to ? 1 : 1 - marginPercent)).toFixed(6));
  const createdAt = Date.now();
  const expiresAt = createdAt + QUOTE_TTL_MS;
  const quote = {
    quoteId: uuidv4(),
    sourceCurrency: from,
    destinationCurrency: to,
    sourceAmount: numericAmount,
    rawRate,
    marginPercent,
    effectiveRate,
    convertedAmount: Number((numericAmount * effectiveRate).toFixed(4)),
    feeAmount: Number((numericAmount * (rawRate - effectiveRate)).toFixed(4)),
    feeCurrency: to,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    expiresInSeconds: Math.round(QUOTE_TTL_MS / 1000),
    expiresTimestamp: expiresAt
  };
  activeQuotes.set(quote.quoteId, quote);
  for (const [id, activeQuote] of activeQuotes.entries()) {
    if (Date.now() > activeQuote.expiresTimestamp) activeQuotes.delete(id);
  }
  return quote;
};

const validateRateQuote = (quoteId, fromCurrency, toCurrency, amount) => {
  const quote = activeQuotes.get(quoteId);
  if (!quote) return { valid: false, reason: 'Quote not found or has expired. Please obtain a fresh quote.' };
  if (Date.now() > quote.expiresTimestamp) {
    activeQuotes.delete(quoteId);
    return { valid: false, reason: 'Quote lock has expired. Please refresh your quote.' };
  }
  if (
    quote.sourceCurrency !== normalizeCurrency(fromCurrency) ||
    quote.destinationCurrency !== normalizeCurrency(toCurrency)
  ) {
    return { valid: false, reason: 'Quote currency pair does not match conversion request.' };
  }
  if (Math.abs(quote.sourceAmount - Number(amount)) > 0.00000001) {
    return { valid: false, reason: 'Quote amount does not match conversion request.' };
  }
  return { valid: true, quote };
};

const convertToUSD = async (currency, amount) => {
  const curr = normalizeCurrency(currency);
  if (!SUPPORTED_CURRENCIES.includes(curr)) throw new Error(`Unsupported currency: ${curr}`);
  if (curr === 'USD') return Number(amount);
  const { rates } = await fetchLatestRates();
  const rate = rates[curr];
  if (!rate) throw new Error(`No exchange rate available for ${curr}`);
  return Number((Number(amount) / rate).toFixed(4));
};

module.exports = {
  SUPPORTED_CURRENCIES,
  normalizeCurrency,
  fetchLatestRates,
  getDirectRate,
  convertCurrency,
  createRateQuote,
  validateRateQuote,
  convertToUSD
};
