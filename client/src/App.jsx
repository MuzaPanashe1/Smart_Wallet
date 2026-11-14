import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Toast } from './components/Toast';
import { DashboardView } from './views/DashboardView';
import { api } from './services/api';
import { CURRENCY_METADATA, formatCurrency } from './utils/currency';
import { formatScoringMode } from './utils/risk';
import './App.css';

const SUPPORTED_CURRENCIES = ['USD', 'GBP', 'EUR', 'ZAR', 'ZMW', 'ZWG', 'BWP'];
const FUNDING_COUNTRIES = [
  { code: 'ZW', label: 'Zimbabwe' },
  { code: 'ZM', label: 'Zambia' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'BW', label: 'Botswana' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'EU', label: 'European Union' }
];

function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    fundingCountry: 'ZW',
    fundingProvider: '',
    accountNumber: '',
    otp: '',
    defaultCurrency: 'USD'
  });
  const [providers, setProviders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (mode !== 'register') return undefined;
    let active = true;
    api.getFundingProviders(form.fundingCountry)
      .then((response) => {
        if (!active) return;
        const nextProviders = response.providers || [];
        setProviders(nextProviders);
        setForm((current) => ({
          ...current,
          fundingProvider: nextProviders[0]?.key || ''
        }));
      })
      .catch((error) => {
        if (active) setAuthError(error.message);
      });
    return () => { active = false; };
  }, [mode, form.fundingCountry]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'fundingCountry'
        ? { fundingProvider: '', accountNumber: '', otp: '' }
        : name === 'fundingProvider'
          ? { accountNumber: '', otp: '' }
          : name === 'accountNumber'
            ? { otp: '' }
            : {})
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');

    if (mode === 'register' && form.password !== form.confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    if (mode === 'register' && (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))) {
      setAuthError('Password must be at least 8 characters and include a letter and a number.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        country: form.fundingCountry,
        defaultCurrency: form.defaultCurrency,
        fundingSource: {
          country: form.fundingCountry,
          provider: form.fundingProvider,
          accountNumber: form.accountNumber,
          otp: form.otp
        }
      };

      const result = mode === 'login'
        ? await login(form.email, form.password)
        : await register(payload);

      if (!result.success) {
        setAuthError(result.message || 'Authentication failed');
      }
    } catch (error) {
      setAuthError(error.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top left, rgba(34,197,94,0.22), transparent 26%), linear-gradient(135deg, #07130d 0%, #111827 100%)',
      padding: '24px'
    }}>
      <div className="glass-panel auth-layout" style={{ width: '100%', maxWidth: '960px', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.05fr 1fr' }}>
        <div style={{ padding: '40px 36px', background: 'linear-gradient(160deg, rgba(20,55,36,0.95), rgba(15,23,42,0.9))' }}>
          <h1 style={{ fontSize: '2.1rem', marginTop: '12px', marginBottom: '12px' }}>Smart Wallet</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.7, marginBottom: '24px' }}>
            Sign in to manage your multi-currency balances, conversions and transfers.
          </p>

          <div style={{ display: 'grid', gap: '14px', color: '#cbd5e1', fontSize: '0.9rem' }}>
            <div>USD · GBP · EUR · ZAR · ZMW · ZWG · BWP</div>
            <div>Live exchange rates for multiple currencies.</div>
            <div>Transfers are screened for suspicious activity.</div>
          </div>
        </div>

        <div style={{ padding: '36px 28px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', background: '#0f172a', borderRadius: '12px', padding: '4px' }}>
            {['login', 'register'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMode(tab)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: mode === tab ? '#166534' : 'transparent',
                  color: mode === tab ? '#fff' : '#cbd5e1',
                  fontWeight: 700
                }}
              >
                {tab === 'login' ? 'Login' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {mode === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>Full name</label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="Your full name" required />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@example.com" autoComplete="email" required />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="+263 77..." />
                </div>
                <h3 style={{ margin: '4px 0 0', fontSize: '1rem' }}>Link your local account</h3>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>Country</label>
                  <select name="fundingCountry" value={form.fundingCountry} onChange={handleChange} required>
                    {FUNDING_COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
                  </select>
                </div>
                {providers.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>Provider</label>
                    <select name="fundingProvider" value={form.fundingProvider} onChange={handleChange} required>
                      {providers.map((provider) => <option key={provider.key} value={provider.key}>{provider.label}</option>)}
                    </select>
                  </div>
                )}
                {form.fundingProvider && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>Account number</label>
                      <input name="accountNumber" value={form.accountNumber} onChange={handleChange} minLength={5} maxLength={100} autoComplete="off" required />
                    </div>
                    {form.accountNumber.trim().length >= 5 && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>Mock OTP / approval code</label>
                        <input name="otp" value={form.otp} onChange={handleChange} inputMode="numeric" required />
                        <small style={{ color: '#94a3b8' }}>Demo approval code: 123456</small>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>Default currency</label>
                  <select name="defaultCurrency" value={form.defaultCurrency} onChange={handleChange}>
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Enter password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : undefined} required />
            </div>

            {mode === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>Confirm password</label>
                <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Re-enter your password" autoComplete="new-password" required />
              </div>
            )}

            {authError && <div role="alert" style={{ color: '#fca5a5', fontSize: '0.88rem' }}>{authError}</div>}

            <button type="submit" disabled={submitting || (mode === 'register' && !form.fundingProvider)} style={{ marginTop: '8px', padding: '12px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', fontWeight: 700 }}>
              {submitting ? 'Please wait...' : mode === 'login' ? 'Access wallet' : 'Create account'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

function WalletTab() {
  const { wallet, refreshWallet, showNotification } = useAuth();
  const [settingCurrency, setSettingCurrency] = useState(false);

  const handleSetDefaultCurrency = async (currency) => {
    setSettingCurrency(true);
    try {
      const response = await api.setDefaultCurrency(currency);
      if (response.success) {
        showNotification(`Default currency updated to ${currency}`, 'success');
        await refreshWallet();
      } else {
        showNotification(response.message || 'Could not set default currency', 'error');
      }
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setSettingCurrency(false);
    }
  };

  const balances = wallet?.balances || [];
  const defaultCurrency = wallet?.defaultCurrency || 'USD';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.1rem' }}>Wallet balances</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SUPPORTED_CURRENCIES.map((currency) => (
              <button
                key={currency}
                type="button"
                disabled={settingCurrency}
                onClick={() => handleSetDefaultCurrency(currency)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  background: defaultCurrency === currency ? '#166534' : 'rgba(255,255,255,0.04)',
                  color: defaultCurrency === currency ? '#fff' : '#cbd5e1'
                }}
              >
                {currency}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {balances.map((balance) => {
            const meta = CURRENCY_METADATA[balance.currency] || { flag: '🌐', name: balance.currency, symbol: '' };
            return (
              <div key={balance.currency} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.07)', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.5rem' }}>{meta.flag}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.76rem', fontWeight: 700 }}>{balance.currency}</span>
                </div>
                <div style={{ marginTop: '18px', fontSize: '0.8rem', color: '#94a3b8' }}>{meta.name}</div>
                <div style={{ marginTop: '6px', fontSize: '1.6rem', fontWeight: 800 }}>{formatCurrency(balance.balance, balance.currency)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ConversionTab() {
  const { refreshWallet, showNotification } = useAuth();
  const [sourceCurrency, setSourceCurrency] = useState('USD');
  const [destinationCurrency, setDestinationCurrency] = useState('ZMW');
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleConvert = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const quoteResponse = await api.requestRateQuote(
        sourceCurrency,
        destinationCurrency,
        parseFloat(amount)
      );
      if (!quoteResponse.success || !quoteResponse.quote?.quoteId) {
        throw new Error(quoteResponse.message || 'Could not retrieve a conversion rate');
      }
      setPreview(quoteResponse.quote);
      const response = await api.executeConversion(
        sourceCurrency,
        destinationCurrency,
        parseFloat(amount),
        quoteResponse.quote.quoteId
      );
      if (response.success) {
        setPreview({ ...quoteResponse.quote, ...response.conversion });
        showNotification(
          response.message,
          response.conversion?.status === 'FLAGGED' ? 'warning' : 'success'
        );
        await refreshWallet();
      } else {
        showNotification(response.message || 'Conversion failed', 'error');
      }
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <h3 style={{ marginBottom: '20px', fontSize: '1.1rem' }}>Multi-currency conversion</h3>
      <form onSubmit={handleConvert} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '0.78rem' }}>From</label>
            <select value={sourceCurrency} onChange={(event) => {
              setSourceCurrency(event.target.value);
              setPreview(null);
            }}>
              {SUPPORTED_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '0.78rem' }}>To</label>
            <select value={destinationCurrency} onChange={(event) => {
              setDestinationCurrency(event.target.value);
              setPreview(null);
            }}>
              {SUPPORTED_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '0.78rem' }}>Amount</label>
            <input type="number" min="0.01" step="any" value={amount} onChange={(event) => {
              setAmount(event.target.value);
              setPreview(null);
            }} placeholder="e.g. 100" required />
        </div>

        {preview && (
          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.76rem' }}>Rate-locked preview · expires in {preview.expiresInSeconds}s</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80' }}>{formatCurrency(preview.convertedAmount, destinationCurrency)}</div>
            <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#cbd5e1' }}>
              Rate: 1 {sourceCurrency} = {preview.effectiveRate} {destinationCurrency} · Margin: {(preview.marginPercent * 100).toFixed(2)}%
            </div>
            <div style={{ marginTop: '4px', fontSize: '0.82rem', color: '#cbd5e1' }}>
              Fee: {Number(preview.feeAmount).toFixed(4)} {preview.feeCurrency}
            </div>
          </div>
        )}

        <button type="submit" disabled={busy || sourceCurrency === destinationCurrency} style={{ padding: '12px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', fontWeight: 700 }}>
          {busy ? 'Getting rate and converting...' : `Convert ${sourceCurrency} to ${destinationCurrency}`}
        </button>
      </form>
    </div>
  );
}

function TransferTab() {
  const { wallet, refreshWallet, showNotification } = useAuth();
  const [form, setForm] = useState({ recipientEmail: '', sourceCurrency: 'USD', destinationCurrency: 'ZMW', amount: '' });
  const [riskPreview, setRiskPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setRiskPreview(null);
  };

  const setDemoAmount = () => {
    const available = wallet?.balances?.find((balance) => balance.currency === form.sourceCurrency)?.balance || 0;
    if (available <= 0) {
      showNotification(`No ${form.sourceCurrency} balance available for the demo transfer`, 'error');
      return;
    }
    setForm((current) => ({ ...current, amount: Number(available).toFixed(2) }));
    setRiskPreview(null);
    showNotification('Full balance filled only. Screening does not move funds; confirming a LOW result will transfer the entire selected-currency balance.', 'warning', 9000);
  };

  const handlePreScreen = async () => {
    try {
      const response = await api.preScreenTransferRisk(form.recipientEmail, form.sourceCurrency, form.destinationCurrency, parseFloat(form.amount));
      if (response.success) {
        setRiskPreview(response.assessment);
      }
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!riskPreview || riskPreview.decision === 'BLOCK') return;
    setBusy(true);
    try {
      const response = await api.executeTransfer(form.recipientEmail, form.sourceCurrency, form.destinationCurrency, parseFloat(form.amount));
      if (response.success) {
        const risk = response.transfer?.riskAssessment;
        const blocked = response.transfer?.status === 'REJECTED';
        showNotification(
          `${risk?.decision || 'LOW'} · ${risk?.score ?? '—'}% · ${formatScoringMode(risk?.scoringMode)}. ${response.message}`,
          blocked ? 'error' : response.transfer?.status === 'FLAGGED' ? 'warning' : 'success'
        );
        await refreshWallet();
      } else {
        showNotification(response.message || 'Transfer failed', 'error');
      }
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <h3 style={{ marginBottom: '20px', fontSize: '1.1rem' }}>Send transfer</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '0.78rem' }}>Recipient email</label>
          <input type="email" name="recipientEmail" value={form.recipientEmail} onChange={handleChange} placeholder="recipient@example.com" autoComplete="email" required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '0.78rem' }}>From currency</label>
            <select name="sourceCurrency" value={form.sourceCurrency} onChange={handleChange}>
              {SUPPORTED_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '0.78rem' }}>To currency</label>
            <select name="destinationCurrency" value={form.destinationCurrency} onChange={handleChange}>
              {SUPPORTED_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '0.78rem' }}>Amount</label>
          <input type="number" min="0.01" step="any" name="amount" value={form.amount} onChange={handleChange} placeholder="e.g. 50" required />
          <button type="button" onClick={setDemoAmount} style={{ marginTop: '8px', padding: '7px 10px', borderRadius: '8px', background: '#1e293b', color: '#fbbf24', fontSize: '0.78rem', fontWeight: 700 }}>
            Fill full balance demo amount
          </button>
        </div>

        {riskPreview && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '6px' }}>AI risk screen</div>
            <div style={{ color: '#f8fafc', fontWeight: 700 }}>{riskPreview.decision} · {riskPreview.risk_level}</div>
            <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '4px' }}>
              Score: {riskPreview.risk_score}% · {formatScoringMode(riskPreview.scoring_mode)}
            </div>
            {(riskPreview.risk_factors || []).map((reason) => (
              <div key={reason} style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '4px' }}>{reason}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="button" onClick={handlePreScreen} disabled={!form.recipientEmail || !form.amount || busy} style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', background: '#1e293b', color: '#fff', fontWeight: 700 }}>
            Screen risk
          </button>
          <button type="submit" disabled={busy || !riskPreview || riskPreview.decision === 'BLOCK'} style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 700 }}>
            {busy ? 'Sending...' : riskPreview?.decision === 'BLOCK' ? 'Blocked' : 'Send transfer'}
          </button>
        </div>
      </form>
    </div>
  );
}

function TransactionsTab() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.getTransactions({ limit: 20 });
        if (response.success) setTransactions(response.transactions || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <h3 style={{ marginBottom: '18px', fontSize: '1.1rem' }}>Transaction history</h3>
      {loading ? (
        <div style={{ color: '#94a3b8' }}>Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div style={{ color: '#94a3b8' }}>No transactions yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '10px 8px' }}>Type</th>
                <th style={{ padding: '10px 8px' }}>Pair</th>
                <th style={{ padding: '10px 8px' }}>Amount</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}>Risk assessment</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '10px 8px' }}>
                    {tx.transaction_type}
                    {tx.transaction_type === 'DEPOSIT' && tx.fundingSource && (
                      <div style={{ marginTop: 4, color: '#94a3b8', fontSize: '.78rem' }}>
                        Funded from {tx.fundingSource.providerName || tx.fundingSource.provider}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px' }}>{tx.source_currency} → {tx.destination_currency}</td>
                  <td style={{ padding: '10px 8px' }}>
                    {tx.transaction_type === 'DEPOSIT'
                      ? formatCurrency(tx.converted_amount, tx.destination_currency)
                      : formatCurrency(tx.source_amount, tx.source_currency)}
                  </td>
                  <td style={{ padding: '10px 8px' }}><span className={`badge badge-${(tx.status || 'completed').toLowerCase()}`}>{tx.status}</span></td>
                  <td style={{ padding: '10px 8px' }}>
                    <span className={`badge badge-${(tx.fraud_risk_level || 'Low Risk').toLowerCase().replace(/\s+/g, '-')}`}>
                      {Number(tx.fraud_risk_score) > 70 ? 'BLOCK' : Number(tx.fraud_risk_score) >= 30 ? 'REVIEW' : 'LOW'} · {tx.fraud_risk_score}% · {formatScoringMode(tx.scoring_mode)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FraudTab() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = user?.role === 'admin' || user?.role === 'reviewer'
        ? await api.getFraudAlerts({ limit: 20 })
        : await api.getUserFraudAlerts();
      if (response.success) setAlerts(response.alerts || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleReview = async (id, decision) => {
    try {
      const response = await api.reviewFraudAlert(id, decision, 'Reviewed from wallet dashboard');
      if (response.success) {
        fetchAlerts();
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'reviewer') {
    return (
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ marginBottom: '10px' }}>Fraud alerts</h3>
        {loading ? (
          <div style={{ color: '#94a3b8' }}>Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>No risk alerts for your transactions.</div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {alerts.map((alert) => (
              <div key={alert.id} style={{ padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <strong>{alert.transaction?.status === 'REJECTED' ? 'BLOCK' : 'REVIEW'} · {alert.risk_level}</strong>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{alert.review_status}</span>
                </div>
                <p style={{ marginTop: '8px', color: '#cbd5e1' }}>{alert.reason}</p>
                <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '0.8rem' }}>
                  Score: {alert.risk_score}% · {formatScoringMode(alert.transaction?.scoring_mode)} · {alert.transaction?.transaction_type} · {alert.transaction?.status} · {alert.created_at ? new Date(alert.created_at).toLocaleString() : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <h3 style={{ marginBottom: '18px', fontSize: '1.1rem' }}>Reviewer dashboard</h3>
      {loading ? (
        <div style={{ color: '#94a3b8' }}>Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div style={{ color: '#94a3b8' }}>No flagged alerts.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {alerts.map((alert) => (
            <div key={alert.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', background: 'rgba(15,23,42,0.8)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{alert.transaction?.user?.name || 'Traveller'}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{alert.transaction?.user?.email}</div>
                </div>
                <div className={`badge badge-${alert.risk_level === 'High Risk' ? 'high' : alert.risk_level === 'Medium Risk' ? 'medium' : 'low'}`}>
                  {alert.transaction?.status === 'REJECTED' ? 'BLOCK' : 'REVIEW'} · {alert.risk_level} · {alert.risk_score}%
                </div>
              </div>
              <div style={{ marginTop: '12px', color: '#cbd5e1' }}>{alert.reason}</div>
              <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '0.8rem' }}>
                Assessment: {formatScoringMode(alert.transaction?.scoring_mode)} · Status: {alert.transaction?.status}
              </div>
              {alert.review_status === 'PENDING' && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => handleReview(alert.id, 'APPROVED')} style={{ padding: '8px 12px', borderRadius: '8px', background: '#0f766e', color: '#fff', fontWeight: 700 }}>Approve</button>
                  <button type="button" onClick={() => handleReview(alert.id, 'REJECTED')} style={{ padding: '8px 12px', borderRadius: '8px', background: '#374151', color: '#fff', fontWeight: 700 }}>Reject</button>
                  <button type="button" onClick={() => handleReview(alert.id, 'RESOLVED')} style={{ padding: '8px 12px', borderRadius: '8px', background: '#047857', color: '#fff', fontWeight: 700 }}>Resolve</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AppShell() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', color: '#94a3b8' }}>Loading Smart Wallet...</div>;
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'wallet':
        return <WalletTab />;
      case 'convert':
        return <ConversionTab />;
      case 'transfer':
        return <TransferTab />;
      case 'transactions':
        return <TransactionsTab />;
      case 'fraud':
        return <FraudTab />;
      case 'reviewer':
        return <FraudTab />;
      default:
        return <DashboardView setActiveTab={setActiveTab} />;
    }
  };

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e17' }}>
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Navbar activeTab={activeTab} />
          <main style={{ padding: '24px 28px 36px' }}>{renderTab()}</main>
        </div>
      </div>
      <Toast />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
