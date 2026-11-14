const { PROVIDER_REGISTRY, getProvidersForCountry } = require('../config/providers');

const createMockAdapter = (provider) => ({
  provider,
  async pullFunds({ amount, currency, availableBalance }) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (
      process.env.MOCK_PAYMENT_FORCE_FAILURE === 'true' ||
      Number(amount) > Number(availableBalance)
    ) {
      return { status: 'failed' };
    }
    return {
      status: 'success',
      amount: Number(amount),
      currency: String(currency).toUpperCase()
    };
  }
});

const adapters = new Map();
for (const country of Object.keys(PROVIDER_REGISTRY)) {
  for (const { key } of (getProvidersForCountry(country) || [])) {
    if (!adapters.has(key)) adapters.set(key, createMockAdapter(key));
  }
}

const getAdapter = (provider) => {
  const adapter = adapters.get(String(provider || '').trim().toLowerCase());
  if (!adapter) throw new Error(`No payment gateway adapter is registered for ${provider}`);
  return adapter;
};

const pullFunds = async (provider, details) => getAdapter(provider).pullFunds(details);

module.exports = { pullFunds };
