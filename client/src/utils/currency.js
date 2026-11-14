export const CURRENCY_METADATA = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    flag: '🇺🇸',
    region: 'Global / Regional Benchmark',
    gradient: 'from-blue-600 to-indigo-800'
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    flag: '🇬🇧',
    region: 'United Kingdom',
    gradient: 'from-purple-600 to-indigo-900'
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    flag: '🇪🇺',
    region: 'European Union',
    gradient: 'from-blue-700 to-cyan-900'
  },
  ZAR: {
    code: 'ZAR',
    name: 'South African Rand',
    symbol: 'R',
    flag: '🇿🇦',
    region: 'Southern Africa Corridor',
    gradient: 'from-emerald-600 to-teal-900'
  },
  ZMW: {
    code: 'ZMW',
    name: 'Zambian Kwacha',
    symbol: 'K',
    flag: '🇿🇲',
    region: 'Zambia Corridor',
    gradient: 'from-amber-600 to-orange-900'
  },
  ZWG: {
    code: 'ZWG',
    name: 'Zimbabwe Gold',
    symbol: 'ZiG',
    flag: '🇿🇼',
    region: 'Zimbabwe',
    gradient: 'from-amber-500 to-yellow-800'
  },
  BWP: {
    code: 'BWP',
    name: 'Botswana Pula',
    symbol: 'P',
    flag: '🇧🇼',
    region: 'Botswana Corridor',
    gradient: 'from-cyan-600 to-blue-900'
  }
};

export const formatCurrency = (amount, currency = 'USD') => {
  const meta = CURRENCY_METADATA[currency] || { symbol: '', code: currency };
  const num = typeof amount === 'number' ? amount : parseFloat(amount || 0);
  return `${meta.symbol} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
