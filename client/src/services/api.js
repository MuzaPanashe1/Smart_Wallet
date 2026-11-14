const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/**
 * Helper to make authenticated HTTP requests
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('smart_wallet_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    throw err;
  }
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (userData) => request('/auth/register', { method: 'POST', body: userData }),
  getProfile: () => request('/auth/profile', { method: 'GET' }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Wallet
  getWallet: () => request('/wallet', { method: 'GET' }),
  setDefaultCurrency: (currency) => request('/wallet/default-currency', { method: 'POST', body: { currency } }),

  // Funding
  getFundingProviders: (country) => request(`/funding/providers?country=${encodeURIComponent(country)}`, { method: 'GET' }),
  getFundingSources: () => request('/funding/sources', { method: 'GET' }),

  // Conversions
  previewConversion: (sourceCurrency, destinationCurrency, amount) =>
    request('/conversions/preview', { method: 'POST', body: { sourceCurrency, destinationCurrency, amount } }),
  executeConversion: (sourceCurrency, destinationCurrency, amount, quoteId) =>
    request('/conversions/execute', { method: 'POST', body: { sourceCurrency, destinationCurrency, amount, ...(quoteId ? { quoteId } : {}) } }),

  // Transfers
  preScreenTransferRisk: (recipientEmail, sourceCurrency, destinationCurrency, amount) =>
    request('/transfers/pre-screen', { method: 'POST', body: { recipientEmail, sourceCurrency, destinationCurrency, amount } }),
  executeTransfer: (recipientEmail, sourceCurrency, destinationCurrency, amount, quoteId) =>
    request('/transfers/execute', { method: 'POST', body: { recipientEmail, sourceCurrency, destinationCurrency, amount, ...(quoteId ? { quoteId } : {}) } }),

  // Transactions
  getTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/transactions${query ? `?${query}` : ''}`, { method: 'GET' });
  },
  getTransactionById: (id) => request(`/transactions/${id}`, { method: 'GET' }),

  // Fraud & Reviews
  getFraudAlerts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/fraud/alerts${query ? `?${query}` : ''}`, { method: 'GET' });
  },
  getUserFraudAlerts: () => request('/fraud/my-alerts', { method: 'GET' }),
  reviewFraudAlert: (id, decision, notes) =>
    request(`/fraud/alerts/${id}/review`, { method: 'PATCH', body: { decision, notes } }),

  // Rates
  getRates: () => request('/rates', { method: 'GET' }),
  getPairRate: (from, to) => request(`/rates/${from}/${to}`, { method: 'GET' }),
  requestRateQuote: (sourceCurrency, destinationCurrency, amount) =>
    request('/rates/quote', { method: 'POST', body: { sourceCurrency, destinationCurrency, amount } })
};
