import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('smart_wallet_token'));
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showNotification = (message, type = 'info', duration = 4000) => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, duration);
  };

  const loadUserData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const profileRes = await api.getProfile();
      if (profileRes.success && profileRes.user) {
        setUser(profileRes.user);
        if (profileRes.user.wallet) {
          setWallet(profileRes.user.wallet);
        }
      }
      // Also fetch full wallet breakdown
      const walletRes = await api.getWallet();
      if (walletRes.success && walletRes.wallet) {
        setWallet(walletRes.wallet);
      }
    } catch (err) {
      console.warn('Failed to load user session:', err.message);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await api.login(email, password);
      if (res.success && res.token) {
        localStorage.setItem('smart_wallet_token', res.token);
        setToken(res.token);
        setUser(res.user);
        if (res.user.wallet) setWallet(res.user.wallet);
        showNotification(`Welcome back, ${res.user.name}!`, 'success');
        return { success: true };
      }
      return { success: false, message: res.message || 'Login failed' };
    } catch (err) {
      showNotification(err.message || 'Login failed', 'error');
      return { success: false, message: err.message };
    }
  };

  const register = async (userData) => {
    try {
      const res = await api.register(userData);
      if (res.success && res.token) {
        localStorage.setItem('smart_wallet_token', res.token);
        setToken(res.token);
        setUser(res.user);
        if (res.user?.wallet) {
          setWallet(res.user.wallet);
        }
        showNotification(`Account registered successfully! Multi-currency balances initialized.`, 'success');
        return { success: true };
      }
      return { success: false, message: res.message || 'Registration failed' };
    } catch (err) {
      showNotification(err.message || 'Registration failed', 'error');
      return { success: false, message: err.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('smart_wallet_token');
    setToken(null);
    setUser(null);
    setWallet(null);
    showNotification('Logged out successfully', 'info');
  };

  const refreshWallet = async () => {
    try {
      const walletRes = await api.getWallet();
      if (walletRes.success && walletRes.wallet) {
        setWallet(walletRes.wallet);
      }
    } catch (err) {
      console.warn('Error refreshing wallet:', err.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        wallet,
        token,
        loading,
        toast,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.role === 'admin' || user?.role === 'reviewer',
        login,
        register,
        logout,
        refreshWallet,
        showNotification,
        closeToast: () => setToast(null)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
