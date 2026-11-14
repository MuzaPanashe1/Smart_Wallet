import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  IconDashboard,
  IconWallet,
  IconExchange,
  IconSend,
  IconHistory,
  IconShield,
  IconShieldAlert
} from './Icons';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { isAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
    { id: 'wallet', label: 'Multi-Currency Wallet', icon: IconWallet },
    { id: 'convert', label: 'Convert Currencies', icon: IconExchange },
    { id: 'transfer', label: 'Send Transfer', icon: IconSend },
    { id: 'transactions', label: 'Transaction History', icon: IconHistory },
    { id: 'fraud', label: 'Fraud Alerts & Risk', icon: IconShield }
  ];

  if (isAdmin) {
    navItems.push({
      id: 'reviewer',
      label: 'Admin Reviewer',
      icon: IconShieldAlert,
      badge: 'Admin'
    });
  }

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        position: 'sticky',
        top: 0
      }}
    >
      {/* Brand Header */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 16px rgba(22, 163, 74, 0.4)'
          }}
        >
          <IconWallet size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.08rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc', margin: 0 }}>
            SMART WALLET
          </h1>
          <div style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 600, letterSpacing: '0.04em' }}>
            MULTI-CURRENCY WALLET
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px 8px' }}>
          Travel FinTech
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isReviewer = item.id === 'reviewer';

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 14px',
                borderRadius: 'var(--radius-sm)',
                background: isActive
                  ? isReviewer
                    ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.18), rgba(239, 68, 68, 0.05))'
                    : 'linear-gradient(90deg, rgba(34, 197, 94, 0.18), rgba(34, 197, 94, 0.05))'
                  : 'transparent',
                border: isActive
                  ? isReviewer
                    ? '1px solid rgba(239, 68, 68, 0.35)'
                    : '1px solid var(--border-highlight)'
                  : '1px solid transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.9rem',
                textAlign: 'left',
                width: '100%'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon
                  size={19}
                  className={isActive ? (isReviewer ? 'text-red-400' : 'text-green-400') : ''}
                  style={{ color: isActive ? (isReviewer ? '#f87171' : '#4ade80') : '#64748b' }}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    fontSize: '0.68rem',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    fontWeight: 700
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Corridor Information Card */}
      <div style={{ padding: '16px', margin: '14px', borderRadius: '12px', background: 'rgba(12, 18, 30, 0.8)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#4ade80', marginBottom: '4px' }}>
          PRIMARY CORRIDORS
        </div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
          🇿🇼 Zimbabwe (USD) <br />
          🇿🇲 Zambia (ZMW) <br />
          🇧🇼 Botswana (BWP) <br />
          🇿🇦 South Africa (ZAR)
        </div>
        <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#64748b' }}>
          Secure cross-border payments
        </div>
      </div>
    </aside>
  );
};
