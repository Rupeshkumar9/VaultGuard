import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCrypto } from '../../contexts/CryptoContext';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { isUnlocked, unlock } = useCrypto();
  const [unlockPassword, setUnlockPassword] = useState('');
  const [error, setError] = useState('');

  // 1. If auth is loading, show a full screen pulsing shield spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-accent-teal/20 border-t-accent-teal animate-spin"></div>
        <p className="mt-4 text-text-secondary text-sm font-medium tracking-wide">Securing connection...</p>
      </div>
    );
  }

  // 2. If not logged in, redirect to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. If logged in but the vault is locked (e.g. after a page reload), show the unlock screen
  if (!isUnlocked) {
    const handleUnlockSubmit = async (e) => {
      e.preventDefault();
      setError('');
      try {
        // Unlock caches password in context memory
        const success = await unlock(unlockPassword);
        if (!success) {
          setError('Failed to unlock vault. Check your master password.');
        }
      } catch (err) {
        setError('Failed to unlock vault.');
      }
    };

    return (
      <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-surface-dark border border-border-dark shadow-2xl backdrop-blur-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-accent-glow items-center justify-center border border-accent-teal/20 mb-2">
              <span className="text-2xl">🔒</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">Vault Locked</h2>
            <p className="text-text-secondary text-xs">
              Your session is active, but your vault keys are cleared from memory. Enter your master password to unlock.
            </p>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Master Password
              </label>
              <input
                type="password"
                required
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-sm"
                placeholder="••••••••••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 font-medium bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-gradient-to-r from-accent-teal to-cyan-500 text-bg-dark font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-accent-teal/10"
            >
              Unlock Vault
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 4. If logged in and unlocked, allow access to children
  return children;
};
