import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { CURRENCY_METADATA, formatCurrency } from '../utils/currency';
import { formatScoringMode } from '../utils/risk';
import {
  IconExchange,
  IconSend,
  IconShield,
  IconTrendingUp,
  IconHistory,
  IconCheck,
  IconAlert
} from '../components/Icons';

export const DashboardView = ({ setActiveTab }) => {
  const { user, wallet, refreshWallet, showNotification } = useAuth();
  const [rates, setRates] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [fundingSource, setFundingSource] = useState(null);
  const [pendingAlertsCount, setPendingAlertsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Quick Conversion state
  const [convSource, setConvSource] = useState('USD');
  const [convDest, setConvDest] = useState('ZMW');
  const [convAmount, setConvAmount] = useState('');
  const [convPreview, setConvPreview] = useState(null);
  const [converting, setConverting] = useState(false);

  // Quick Transfer state
  const [txRecipient, setTxRecipient] = useState('');
  const [txCurrency, setTxCurrency] = useState('USD');
  const [txDestinationCurrency, setTxDestinationCurrency] = useState('ZMW');
  const [txAmount, setTxAmount] = useState('');
  const [txPreview, setTxPreview] = useState(null);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [rateRes, txRes, fundingRes] = await Promise.all([
        api.getRates().catch(() => null),
        api.getTransactions({ limit: 5 }).catch(() => null),
        api.getFundingSources().catch(() => null)
      ]);

      if (rateRes?.success) setRates(rateRes);
      if (txRes?.success) setRecentTransactions(txRes.transactions || []);
      if (fundingRes?.success) {
        setFundingSource((fundingRes.sources || []).find((source) => source.status === 'ACTIVE') || null);
      }

      // Check alerts
      const alertsRes = await api.getUserFraudAlerts().catch(() => null);
      if (alertsRes?.success) {
        const pending = alertsRes.alerts.filter(a => a.review_status === 'PENDING').length;
        setPendingAlertsCount(pending);
      }
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickConvert = async (e) => {
    e.preventDefault();
    const num = parseFloat(convAmount);
    if (!num || num <= 0) return;

    setConverting(true);
    try {
      const quoteResponse = await api.requestRateQuote(convSource, convDest, num);
      if (!quoteResponse.success || !quoteResponse.quote?.quoteId) {
        throw new Error(quoteResponse.message || 'Could not retrieve a conversion rate');
      }
      setConvPreview(quoteResponse.quote);
      const res = await api.executeConversion(convSource, convDest, num, quoteResponse.quote.quoteId);
      if (res.success) {
        setConvPreview({ ...quoteResponse.quote, ...res.conversion });
        showNotification(
          res.message,
          res.conversion?.status === 'FLAGGED' ? 'warning' : 'success'
        );
        await refreshWallet();
        loadDashboardData();
        setConvAmount('');
      } else {
        showNotification(res.message || 'Conversion failed', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setConverting(false);
    }
  };

  const handleQuickTransfer = async (e) => {
    e.preventDefault();
    const num = parseFloat(txAmount);
    if (!txRecipient || !num || num <= 0) {
      showNotification('Please enter recipient email and valid amount', 'error');
      return;
    }

    setTransferring(true);
    try {
      const quoteResponse = await api.requestRateQuote(txCurrency, txDestinationCurrency, num);
      if (!quoteResponse.success || !quoteResponse.quote?.quoteId) {
        throw new Error(quoteResponse.message || 'Could not retrieve a transfer rate');
      }
      setTxPreview(quoteResponse.quote);
      const res = await api.executeTransfer(
        txRecipient,
        txCurrency,
        txDestinationCurrency,
        num,
        quoteResponse.quote.quoteId
      );
      if (res.success) {
        setTxPreview({ ...quoteResponse.quote, ...res.transfer });
        const assessment = res.transfer?.riskAssessment;
        if (res.transfer.status === 'REJECTED') {
          showNotification(`BLOCK · ${assessment?.score ?? '—'}% · ${formatScoringMode(assessment?.scoringMode)}. No balance was changed.`, 'error', 7000);
        } else if (res.transfer.status === 'FLAGGED') {
          showNotification(`REVIEW · ${assessment?.score ?? '—'}% · ${formatScoringMode(assessment?.scoringMode)}. Transfer held for analyst review.`, 'warning', 7000);
        } else {
          showNotification(`LOW · ${assessment?.score ?? '—'}% · ${formatScoringMode(assessment?.scoringMode)}. ${res.message}`, 'success', 7000);
        }
        await refreshWallet();
        loadDashboardData();
        setTxRecipient('');
        setTxAmount('');
      } else {
        showNotification(res.message || 'Transfer failed', 'error');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setTransferring(false);
    }
  };

  const handleSetDefaultCurrency = async (curr) => {
    try {
      const res = await api.setDefaultCurrency(curr);
      if (res.success) {
        showNotification(`Default currency updated to ${curr}`, 'success');
        await refreshWallet();
      }
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  const defaultCurr = wallet?.defaultCurrency || 'USD';
  const totalBalance = wallet?.totalBalanceInDefault || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="glass-panel" style={{ padding: '16px 20px', border: '1px solid rgba(34,197,94,.22)' }}>
        {fundingSource ? (
          <>
            <strong>
              Funded from: {fundingSource.providerName} {fundingSource.accountNumber} ({fundingSource.countryName})
            </strong>
            <div style={{ marginTop: 5, color: '#94a3b8', fontSize: '.82rem' }}>
              Status: {fundingSource.status} · Source balance: {formatCurrency(fundingSource.simulatedBalance, fundingSource.currency)}
            </div>
          </>
        ) : (
          <strong>Local account: Not linked</strong>
        )}
      </div>
      {/* 1. Hero Portfolio Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '32px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Total Multi-Currency Portfolio
              </span>
              <span className="badge badge-low">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                Risk-screened transactions
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <h1 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {formatCurrency(totalBalance, defaultCurr)}
              </h1>
              <span style={{ fontSize: '1.15rem', color: '#94a3b8', fontWeight: 600 }}>{defaultCurr}</span>
            </div>
            <p style={{ marginTop: '10px', fontSize: '0.88rem', color: '#94a3b8' }}>
              Portfolio estimate based on the latest available exchange rates
            </p>
          </div>

          {/* Quick Default Currency Switcher */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '220px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
              Display Portfolio In:
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['USD', 'ZAR', 'BWP', 'ZMW', 'ZWG', 'GBP', 'EUR'].map(c => (
                <button
                  key={c}
                  onClick={() => handleSetDefaultCurrency(c)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: defaultCurr === c ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.06)',
                    color: '#fff',
                    border: defaultCurr === c ? '1px solid #4ade80' : '1px solid transparent'
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Supported Currencies Balance Grid */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.15rem' }}>Active Currency Balances</h3>
          <button
            onClick={() => setActiveTab('wallet')}
            style={{ background: 'none', color: '#4ade80', fontSize: '0.86rem', fontWeight: 600 }}
          >
            Manage Balances →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {(wallet?.balances || []).map(b => {
            const meta = CURRENCY_METADATA[b.currency] || { flag: '🌐', name: b.currency, symbol: '' };
            const isZero = parseFloat(b.balance) === 0;

            return (
              <div
                key={b.currency}
                className="glass-panel"
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--bg-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.15s, border-color 0.15s'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '1.7rem' }}>{meta.flag}</span>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#94a3b8'
                      }}
                    >
                      {b.currency}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{meta.name}</div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800, color: isZero ? '#64748b' : '#fff' }}>
                    {formatCurrency(b.balance, b.currency)}
                  </div>
                </div>

                <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    ≈ {formatCurrency(b.valueInDefaultCurrency || 0, defaultCurr)}
                  </span>
                  <button
                    onClick={() => {
                      setConvSource(b.currency);
                      setActiveTab('convert');
                    }}
                    style={{ background: 'none', color: '#4ade80', fontSize: '0.74rem', fontWeight: 600 }}
                  >
                    Exchange
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Action Hub: Quick Conversion & Quick Transfer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Quick Exchange Widget */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80' }}>
              <IconExchange size={18} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', margin: 0 }}>Quick Currency Conversion</h4>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Rates appear when you convert</p>
            </div>
          </div>

          <form onSubmit={handleQuickConvert}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>From</label>
                <select
                  value={convSource}
                  onChange={e => {
                    setConvSource(e.target.value);
                    setConvPreview(null);
                  }}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.9rem' }}
                >
                  {['USD', 'GBP', 'EUR', 'ZAR', 'ZMW', 'ZWG', 'BWP'].map(c => (
                    <option key={c} value={c}>{CURRENCY_METADATA[c]?.flag} {c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>To</label>
                <select
                  value={convDest}
                  onChange={e => {
                    setConvDest(e.target.value);
                    setConvPreview(null);
                  }}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.9rem' }}
                >
                  {['ZMW', 'ZWG', 'BWP', 'ZAR', 'USD', 'GBP', 'EUR'].map(c => (
                    <option key={c} value={c}>{CURRENCY_METADATA[c]?.flag} {c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Amount ({convSource})</label>
              <input
                type="number"
                min="0.1"
                step="any"
                value={convAmount}
                onChange={e => {
                  setConvAmount(e.target.value);
                  setConvPreview(null);
                }}
                placeholder="e.g. 100"
                style={{ width: '100%', fontSize: '1rem', fontWeight: 600 }}
                required
              />
            </div>

            {convPreview && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Calculated Amount</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#4ade80' }}>
                    {formatCurrency(convPreview.convertedAmount, convDest)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Rate: 1 {convSource} = {convPreview.effectiveRate} {convDest}
                  <br />
                  Fee: {formatCurrency(convPreview.feeAmount, convDest)}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={converting || convSource === convDest}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem'
              }}
            >
              {converting ? 'Getting rate and converting...' : `Convert ${convSource} to ${convDest}`}
            </button>
          </form>
        </div>

        {/* Quick Send Transfer Widget */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <IconSend size={18} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', margin: 0 }}>Quick Cross-Border Transfer</h4>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Internal wallet transfer with risk screening</p>
            </div>
          </div>

          <form onSubmit={handleQuickTransfer}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Recipient Email</label>
              <input
                type="email"
                placeholder="e.g. recipient@example.com"
                value={txRecipient}
                onChange={e => setTxRecipient(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>From</label>
                <select
                  value={txCurrency}
                  onChange={e => {
                    setTxCurrency(e.target.value);
                    setTxPreview(null);
                  }}
                  style={{ width: '100%', padding: '9px 10px' }}
                >
                  {['USD', 'ZAR', 'BWP', 'ZMW', 'ZWG', 'GBP', 'EUR'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>To</label>
                <select
                  value={txDestinationCurrency}
                  onChange={e => {
                    setTxDestinationCurrency(e.target.value);
                    setTxPreview(null);
                  }}
                  style={{ width: '100%', padding: '9px 10px' }}
                >
                  {['USD', 'ZAR', 'BWP', 'ZMW', 'ZWG', 'GBP', 'EUR'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Amount</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={txAmount}
                  onChange={e => {
                    setTxAmount(e.target.value);
                    setTxPreview(null);
                  }}
                  placeholder="e.g. 50"
                  style={{ width: '100%' }}
                  required
                />
              </div>
            </div>

            {txPreview && (
              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(34,197,94,.08)', marginBottom: '14px' }}>
                <strong>
                  {formatCurrency(txPreview.convertedAmount || txPreview.converted_amount, txDestinationCurrency)}
                </strong>
                <div style={{ color: '#94a3b8', fontSize: '.78rem', marginTop: 4 }}>
                  Rate: 1 {txCurrency} = {Number(txPreview.effectiveRate || txPreview.exchangeRate).toFixed(4)} {txDestinationCurrency}
                  {' · '}Fee: {formatCurrency(
                    txPreview.feeAmount ?? txPreview.fee_amount ?? 0,
                    txPreview.feeCurrency || txPreview.fee_currency || txDestinationCurrency
                  )}
                </div>
              </div>
            )}

            <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', marginBottom: '14px', fontSize: '0.76rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconShield size={16} />
              <span>Transactions are screened for suspicious activity before they are sent.</span>
            </div>

            <button
              type="submit"
              disabled={transferring}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem'
              }}
            >
              {transferring ? 'Getting rate, screening & sending...' : 'Send Transfer Now'}
            </button>
          </form>
        </div>
      </div>

      {/* 4. Live Exchange Rates Corridor Ticker */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconTrendingUp size={18} style={{ color: '#4ade80' }} />
            <h4 style={{ fontSize: '0.95rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Exchange Rates (USD base)
            </h4>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {rates?.source === 'exchange_rate_api'
                ? 'Live ExchangeRate-API'
                : rates?.source === 'open_er_api'
                  ? 'Live ExchangeRate-API Open Access'
                  : rates?.source === 'database_cache'
                    ? 'Last stored API rates'
                    : 'Rate source unavailable'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {[
            { pair: 'USD / ZMW', rate: rates?.ratesVsUSD?.ZMW, region: 'Zambia' },
            { pair: 'USD / ZWG', rate: rates?.ratesVsUSD?.ZWG, region: 'Zimbabwe' },
            { pair: 'USD / BWP', rate: rates?.ratesVsUSD?.BWP, region: 'Botswana' },
            { pair: 'USD / ZAR', rate: rates?.ratesVsUSD?.ZAR, region: 'South Africa' },
            { pair: 'USD / EUR', rate: rates?.ratesVsUSD?.EUR, region: 'Europe' },
            { pair: 'USD / GBP', rate: rates?.ratesVsUSD?.GBP, region: 'United Kingdom' }
          ].map(item => (
            <div
              key={item.pair}
              style={{
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{item.region}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>{item.pair}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                {item.rate == null ? '—' : parseFloat(item.rate).toFixed(4)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, color: '#64748b', fontSize: '.75rem' }}>
          Last updated: {rates?.lastUpdated ? new Date(rates.lastUpdated).toLocaleString() : 'unavailable'}
        </div>
      </div>

      {/* 5. Recent Activity Ledger */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconHistory size={18} style={{ color: '#94a3b8' }} />
            <h3 style={{ fontSize: '1.1rem' }}>Recent Wallet Transactions</h3>
          </div>
          <button
            onClick={() => setActiveTab('transactions')}
            style={{ background: 'none', color: '#4ade80', fontSize: '0.85rem', fontWeight: 600 }}
          >
            View Full Ledger ({recentTransactions.length}) →
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
            No transactions yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#94a3b8', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 14px' }}>Type</th>
                  <th style={{ padding: '12px 14px' }}>Corridor</th>
                  <th style={{ padding: '12px 14px' }}>Amount</th>
                  <th style={{ padding: '12px 14px' }}>Converted</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Risk assessment</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map(tx => {
                  const riskLevel = tx.fraud_risk_level || 'Low Risk';
                  const isFlagged = tx.status === 'FLAGGED';

                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px', fontWeight: 600 }}>
                        <span style={{ color: tx.transaction_type === 'CONVERSION' ? '#4ade80' : tx.transaction_type === 'TRANSFER' ? '#34d399' : '#a78bfa' }}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td style={{ padding: '14px', color: '#cbd5e1' }}>
                        {tx.source_currency} → {tx.destination_currency}
                      </td>
                      <td style={{ padding: '14px', fontWeight: 700 }}>
                        {formatCurrency(tx.source_amount, tx.source_currency)}
                      </td>
                      <td style={{ padding: '14px', color: '#94a3b8' }}>
                        {formatCurrency(tx.converted_amount, tx.destination_currency)}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span className={`badge badge-${tx.status.toLowerCase()}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span
                          className={`badge ${riskLevel === 'High Risk' ? 'badge-high' : riskLevel === 'Medium Risk' ? 'badge-medium' : 'badge-low'}`}
                        >
                          {Number(tx.fraud_risk_score) > 70 ? 'BLOCK' : Number(tx.fraud_risk_score) >= 30 ? 'REVIEW' : 'LOW'} · {tx.fraud_risk_score}% · {formatScoringMode(tx.scoring_mode)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
