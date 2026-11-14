const COUNTRY_NAMES = {
  ZW: 'Zimbabwe',
  ZM: 'Zambia',
  ZA: 'South Africa',
  BW: 'Botswana',
  GB: 'United Kingdom',
  EU: 'European Union'
};

const PROVIDER_REGISTRY = {
  ZW: [
    { key: 'ecocash', label: 'EcoCash', currencies: ['USD', 'ZWG'] },
    { key: 'onemoney', label: 'OneMoney', currencies: ['USD', 'ZWG'] },
    { key: 'bank', label: 'Bank account', currencies: ['USD', 'ZWG', 'ZMW'] }
  ],
  ZM: [
    { key: 'mtn_momo', label: 'MTN MoMo', currencies: ['ZMW'] },
    { key: 'airtel_money', label: 'Airtel Money', currencies: ['ZMW'] },
    { key: 'bank', label: 'Bank account', currencies: ['USD', 'ZMW'] }
  ],
  ZA: [
    { key: 'bank_eft', label: 'Bank EFT', currencies: ['USD', 'ZAR'] },
    { key: 'card', label: 'Card', currencies: ['USD'] }
  ],
  BW: [
    { key: 'orange_money', label: 'Orange Money', currencies: ['BWP'] },
    { key: 'myzaka', label: 'MyZaka', currencies: ['BWP'] },
    { key: 'bank', label: 'Bank account', currencies: ['USD', 'BWP'] }
  ],
  GB: [
    { key: 'bank_transfer', label: 'Bank transfer', currencies: ['USD', 'GBP'] },
    { key: 'card', label: 'Card', currencies: ['USD', 'GBP'] }
  ],
  EU: [
    { key: 'bank_transfer', label: 'Bank transfer', currencies: ['USD', 'EUR'] },
    { key: 'card', label: 'Card', currencies: ['USD', 'EUR'] }
  ]
};

const normalizeCountry = (country) => String(country || '').trim().toUpperCase();

const getProvidersForCountry = (country) => {
  const code = normalizeCountry(country);
  const providers = PROVIDER_REGISTRY[code];
  if (!providers) return null;

  if (providers.some((provider) => provider.key === 'card')) return providers;
  return [...providers, { key: 'card', label: 'Card', currencies: ['USD'] }];
};

const getProvider = (country, providerKey) => {
  const providers = getProvidersForCountry(country);
  return providers?.find((provider) => provider.key === String(providerKey || '').trim().toLowerCase()) || null;
};

const isProviderCurrencySupported = (country, providerKey, currency) => {
  const provider = getProvider(country, providerKey);
  return Boolean(provider && provider.currencies.includes(String(currency || '').trim().toUpperCase()));
};

module.exports = {
  COUNTRY_NAMES,
  PROVIDER_REGISTRY,
  normalizeCountry,
  getProvidersForCountry,
  getProvider,
  isProviderCurrencySupported
};
