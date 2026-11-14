import React from 'react';
import { useAuth } from '../context/AuthContext';
import { IconCheck, IconAlert, IconShieldAlert } from './Icons';

export const Toast = () => {
  const { toast, closeToast } = useAuth();
  if (!toast) return null;

  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';
  const isSuccess = toast.type === 'success';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 20px',
        borderRadius: '12px',
        backgroundColor: isError ? '#1c0f13' : isWarning ? '#1f1606' : '#091d17',
        border: `1px solid ${isError ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'}`,
        color: '#fff',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        animation: 'fadeIn 0.2s ease-out forwards',
        maxWidth: '420px'
      }}
    >
      <div style={{ color: isError ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981' }}>
        {isError && <IconAlert size={22} />}
        {isWarning && <IconShieldAlert size={22} />}
        {isSuccess && <IconCheck size={22} />}
      </div>
      <div style={{ fontSize: '0.92rem', fontWeight: 500, flex: 1 }}>{toast.message}</div>
      <button
        onClick={closeToast}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          fontSize: '1.2rem',
          cursor: 'pointer',
          padding: '2px 6px'
        }}
      >
        ×
      </button>
    </div>
  );
};
