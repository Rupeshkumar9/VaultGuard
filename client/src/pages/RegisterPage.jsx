import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCrypto } from '../contexts/CryptoContext';
import { isExtension } from '../utils/platform';

export default function RegisterPage() {
  const { register, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { unlock } = useCrypto();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [masterPasswordHint, setMasterPasswordHint] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, isAuthLoading, navigate]);



  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 1. Password confirmations check
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    if (password.length < 8) {
      return setError('Master password must be at least 8 characters long.');
    }

    setIsLoading(true);

    try {
      // 2. Register the master account on the backend
      const res = await register(email, password, masterPasswordHint);
      
      if (res && res.success) {
        // 3. Unlock the client-side cryptosystem using the same password
        await unlock(password, true);
        
        // 4. Navigate to vault dashboard
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message || 
        'Registration failed. (Note: Only one account can be registered per instance.)'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isExtension) {
    return (
      <div className="h-screen w-full bg-bg-dark flex flex-col items-center justify-center p-3 select-none">
        <div className="w-full p-4 rounded-xl bg-surface-dark border border-border-dark shadow-2xl space-y-3.5 backdrop-blur-xl text-left overflow-y-auto max-h-[95vh] scrollbar-none">
          
          {/* Title */}
          <div className="text-center space-y-0.5">
            <div className="inline-flex w-8 h-8 rounded-lg bg-accent-glow items-center justify-center border border-accent-teal/20 mb-1">
              <span className="text-lg">🛡️</span>
            </div>
            <h2 className="text-lg font-black tracking-tight bg-gradient-to-r from-accent-teal to-cyan-400 bg-clip-text text-transparent">
              Create Master Account
            </h2>
            <p className="text-text-secondary text-[9px]">
              Set up your VaultGuard manager
            </p>
          </div>

          {/* Warning Badge */}
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[9px] leading-snug">
            <strong>⚠️ Critical:</strong> Derives local keys. If lost, your vault data is unrecoverable.
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div className="space-y-0.5">
              <label className="block text-[9px] font-semibold text-text-secondary uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-xs"
                placeholder="admin@vaultguard.local"
              />
            </div>

            <div className="space-y-0.5">
              <label className="block text-[9px] font-semibold text-text-secondary uppercase tracking-wider">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-xs pr-10"
                  placeholder="Choose a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors text-[10px]"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="space-y-0.5">
              <label className="block text-[9px] font-semibold text-text-secondary uppercase tracking-wider">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-xs"
                placeholder="Verify master password"
              />
            </div>

            <div className="space-y-0.5">
              <label className="block text-[9px] font-semibold text-text-secondary uppercase tracking-wider">
                Password Hint <span className="text-text-secondary/40 lowercase">(optional)</span>
              </label>
              <input
                type="text"
                value={masterPasswordHint}
                onChange={(e) => setMasterPasswordHint(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-xs"
                placeholder="e.g. My childhood pet"
                maxLength={255}
              />
            </div>

            {error && (
              <p className="text-[10px] text-red-500 font-medium bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-accent-teal to-cyan-500 text-bg-dark font-bold text-xs hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-teal/10 cursor-pointer"
            >
              {isLoading ? 'Creating Account...' : 'Initialize & Encrypt'}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center pt-2.5 border-t border-border-dark/50 space-y-1.5">
            <p className="text-[10px] text-text-secondary">
              Already have an account?{' '}
              <Link to="/login" className="text-accent-teal hover:underline font-bold">
                Log in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full p-8 rounded-2xl bg-surface-dark border border-border-dark shadow-2xl space-y-8 backdrop-blur-xl">
        
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-accent-glow items-center justify-center border border-accent-teal/20 mb-2">
            <span className="text-3xl">🛡️</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-accent-teal to-cyan-400 bg-clip-text text-transparent">
            Create Master Account
          </h2>
          <p className="text-text-secondary text-sm">
            Set up your VaultGuard manager
          </p>
        </div>

        {/* Warning Badge */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs space-y-1">
          <p className="font-semibold">⚠️ Critical Security Warning:</p>
          <p>
            Your master password is used to derive your local encryption key. 
            <strong> If you lose this password, your vault data cannot be recovered.</strong>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-sm"
              placeholder="admin@vaultguard.local"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Master Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-sm pr-10"
                placeholder="Choose a strong password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors text-xs"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Confirm Master Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-sm"
              placeholder="Verify master password"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Password Hint <span className="text-text-secondary/40 lowercase">(optional)</span>
              </label>
            </div>
            <input
              type="text"
              value={masterPasswordHint}
              onChange={(e) => setMasterPasswordHint(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-sm"
              placeholder="e.g. My childhood pet's nickname"
              maxLength={255}
            />
            <p className="text-[10px] text-text-secondary/70">
              * This hint is stored in plain text and can be sent to you if requested.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-accent-teal to-cyan-500 text-bg-dark font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-teal/10 cursor-pointer"
          >
            {isLoading ? 'Creating Account...' : 'Initialize & Encrypt'}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-border-dark/50 space-y-4">
          <p className="text-xs text-text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-teal hover:underline font-medium">
              Log in here
            </Link>
          </p>


        </div>
      </div>
    </div>
  );
}
