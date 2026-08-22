import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCrypto } from '../../contexts/CryptoContext';
import { isNative, isExtension } from '../../utils/platform';
import { mobileAuth } from '../../services/android/mobileAuth';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { isUnlocked, isUnlockStateLoading, unlock } = useCrypto();
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState('');
  const [hasBiometric, setHasBiometric] = useState(false);
  const [isBiometricPrompting, setIsBiometricPrompting] = useState(false);

  // Auto-unlock and Biometric check on mount
  useEffect(() => {
    if (!isNative || isUnlocked || !isAuthenticated || !user?.email) return;

    const attemptAutoUnlock = async () => {
      // Biometric unlock must always be backed by native authentication.
      const available = await mobileAuth.checkBiometricAvailable();
      setHasBiometric(available);

      if (available) {
        // Automatically trigger biometric unlock on screen load
        triggerBiometricUnlock();
      }
    };

    attemptAutoUnlock();
  }, [isAuthenticated, isUnlocked, user]);

  const triggerBiometricUnlock = async () => {
    if (isBiometricPrompting || !user?.email) return;
    setIsBiometricPrompting(true);
    try {
      const password = await mobileAuth.loadSecureCredentials(user.email);
      if (password) {
        const success = await unlock(password);
        if (!success) {
          setError('Failed to decrypt vault with stored biometric credentials.');
        }
      }
    } catch (err) {
      console.error('Biometric authentication failed:', err);
    } finally {
      setIsBiometricPrompting(false);
    }
  };

  // 1. If auth is loading, show a full screen pulsing shield spinner
  if (isLoading || isUnlockStateLoading) {
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
      if (isUnlocking) return;

      setError('');
      setIsUnlocking(true);
      try {
        // Unlock caches password in context memory
        const success = await unlock(unlockPassword);
        if (!success) {
          setError('Failed to unlock vault. Check your master password.');
        }
      } catch (err) {
        setError('Failed to unlock vault.');
      } finally {
        setIsUnlocking(false);
      }
    };

    return (
      <div className={`min-h-screen bg-bg-dark flex flex-col items-center justify-center px-4 ${isExtension ? 'w-[380px] h-[600px] min-h-0 p-3 select-none' : ''}`}>
        <div className={`max-w-md w-full rounded-2xl bg-surface-dark border border-border-dark shadow-2xl backdrop-blur-xl space-y-6 ${isExtension ? 'p-5 space-y-4' : 'p-8 space-y-6'}`}>
          <div className="text-center space-y-2">
            <div className={`inline-flex rounded-2xl bg-accent-glow items-center justify-center border border-accent-teal/20 ${isExtension ? 'w-10 h-10 mb-1' : 'w-14 h-14 mb-2'}`}>
              <span className={isExtension ? 'text-lg' : 'text-2xl'}>🔒</span>
            </div>
            <h2 className={`${isExtension ? 'text-lg' : 'text-2xl'} font-bold tracking-tight text-text-primary`}>Vault Locked</h2>
            <p className="text-text-secondary text-xs">
              {isExtension 
                ? `Enter master password for ${user?.email || 'your account'} to unlock.`
                : 'Your session is active, but your vault keys are cleared from memory. Enter your master password to unlock.'}
            </p>
          </div>

          <form onSubmit={handleUnlockSubmit} className={isExtension ? 'space-y-3' : 'space-y-4'}>
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showUnlockPassword ? 'text' : 'password'}
                  required
                  disabled={isUnlocking}
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className={`w-full pl-4 pr-12 py-3 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isExtension ? 'text-xs py-2' : 'text-sm'}`}
                  placeholder="••••••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowUnlockPassword((visible) => !visible)}
                  disabled={isUnlocking}
                  aria-label={showUnlockPassword ? 'Hide master password' : 'Show master password'}
                  title={showUnlockPassword ? 'Hide master password' : 'Show master password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showUnlockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 font-medium bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isUnlocking}
              aria-busy={isUnlocking}
              className={`w-full py-3 rounded-lg bg-gradient-to-r from-accent-teal to-cyan-500 text-bg-dark font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-lg shadow-accent-teal/10 ${isExtension ? 'py-2 text-xs mb-1' : 'mb-2'}`}
            >
              {isUnlocking ? 'Unlocking...' : 'Unlock Vault'}
            </button>

            {hasBiometric && (
              <button
                type="button"
                onClick={triggerBiometricUnlock}
                className="w-full py-2.5 rounded-lg border border-border-dark bg-surface-dark hover:bg-surface-hover text-text-primary font-semibold text-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🔑</span>
                <span>Unlock with Biometrics / System Lock</span>
              </button>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={logout}
                className="text-xs text-accent-teal hover:underline font-semibold cursor-pointer"
              >
                Log out / Switch account
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 4. If logged in and unlocked, allow access to children
  return children;
};
