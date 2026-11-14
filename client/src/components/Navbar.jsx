import React from 'react';
import { useAuth } from '../context/AuthContext';
import { IconLogOut } from './Icons';

export const Navbar = ({ activeTab }) => {
  const { user, logout, isAdmin } = useAuth();

  return (
    <header
      style={{
        height: '72px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(15, 21, 35, 0.75)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'capitalize' }}>
          {activeTab === 'dashboard' && 'Executive Travel Dashboard'}
          {activeTab === 'wallet' && 'Multi-Currency Wallet Balances'}
          {activeTab === 'convert' && 'Instant Currency Exchange'}
          {activeTab === 'transfer' && 'Cross-Border Funds Transfer'}
          {activeTab === 'transactions' && 'Ledger & Transaction History'}
          {activeTab === 'fraud' && 'AI Fraud Risk Analysis & Alerts'}
          {activeTab === 'reviewer' && 'Compliance & Reviewer Command Center'}
        </h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '4px 10px',
            borderRadius: '16px',
            fontSize: '0.78rem',
            color: '#10b981',
            fontWeight: 600
          }}
        >
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
          Risk screening
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* User Profile Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '24px'
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: isAdmin ? 'linear-gradient(135deg, #f43f5e, #be123c)' : 'linear-gradient(135deg, #16a34a, #15803d)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}
          >
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f8fafc' }}>{user?.name || 'Wallet user'}</div>
            <div style={{ fontSize: '0.72rem', color: isAdmin ? '#f43f5e' : '#4ade80', fontWeight: 500 }}>
              {isAdmin ? 'Fraud Analyst / Reviewer' : `Cross-Border Traveller (${user?.country || 'ZW'})`}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            color: '#94a3b8',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <IconLogOut size={17} />
        </button>
      </div>
    </header>
  );
};
