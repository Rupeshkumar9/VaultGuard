import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCrypto } from '../contexts/CryptoContext';
import { isExtension } from '../utils/platform';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { unlock } = useCrypto();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => {
    return localStorage.getItem('vaultguard_api_base') || import.meta.env.VITE_API_URL || 'https://vaultguard-qi2y.onrender.com';
  });
  const [serverSaveSuccess, setServerSaveSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, isAuthLoading, navigate]);

  const handleSaveServer = (e) => {
    e.preventDefault();
    let cleanUrl = serverUrl.trim();
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    localStorage.setItem('vaultguard_api_base', cleanUrl);
    setServerUrl(cleanUrl);
    setServerSaveSuccess(true);
    setTimeout(() => {
      setServerSaveSuccess(false);
      setShowServerConfig(false);
    }, 1500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Log in to the Express backend (receives JWT token)
      const res = await login(email, password);
      
      if (res && res.success) {
        // 2. Cache master password in CryptoContext to enable client-side encryption
        await unlock(password);
        
        // 3. Redirect to the main vault page
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Invalid email or master password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isExtension) {
    return (
      <div className="h-screen w-full bg-bg-dark flex flex-col items-center justify-center p-3 select-none">
        <div className="w-full p-5 rounded-xl bg-surface-dark border border-border-dark shadow-2xl space-y-4 backdrop-blur-xl text-left">
          
          {/* Logo and title */}
          <div className="text-center space-y-1">
            <div className="inline-flex w-10 h-10 rounded-xl bg-accent-glow items-center justify-center border border-accent-teal/20 mb-1">
              <span className="text-xl">🔐</span>
            </div>
            <h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-accent-teal to-cyan-400 bg-clip-text text-transparent">
              VaultGuard
            </h2>
            <p className="text-text-secondary text-[10px]">
              Access your secure personal vault
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-xs"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-xs pr-10"
                  placeholder="••••••••••••••••"
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

            {error && (
              <p className="text-[10px] text-red-500 font-medium bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent-teal to-cyan-500 text-bg-dark font-bold text-xs hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-teal/10 cursor-pointer"
            >
              {isLoading ? 'Decrypting Vault...' : 'Log In & Decrypt'}
            </button>
          </form>

          {/* Footer links */}
          <div className="text-center pt-3 border-t border-border-dark/50 space-y-2">
            <p className="text-[10px] text-text-secondary">
              First time?{' '}
              <Link to="/register" className="text-accent-teal hover:underline font-bold">
                Create master account
              </Link>
            </p>

            <div className="pt-2 border-t border-border-dark/30">
              <button
                type="button"
                onClick={() => setShowServerConfig(!showServerConfig)}
                className="text-[9px] text-text-secondary hover:text-accent-teal transition-colors cursor-pointer font-bold uppercase tracking-wider"
              >
                {showServerConfig ? 'Hide Server URL' : 'Configure Server Connection'}
              </button>

              {showServerConfig && (
                <div className="mt-2 p-3 rounded-lg bg-bg-dark border border-border-dark text-left space-y-2">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-semibold text-text-secondary uppercase tracking-wider">
                      Vault Server URL
                    </label>
                    <input
                      type="url"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="https://vaultguard-qi2y.onrender.com"
                      className="w-full px-2.5 py-1.5 rounded bg-surface-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/30 text-[10px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveServer}
                    className="w-full py-1.5 rounded bg-surface-hover hover:bg-border-dark border border-border-dark text-text-primary font-bold text-[10px] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {serverSaveSuccess ? 'Saved ✓' : 'Save Configuration'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full p-8 rounded-2xl bg-surface-dark border border-border-dark shadow-2xl space-y-8 backdrop-blur-xl">
        
        {/* Logo and title */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-accent-glow items-center justify-center border border-accent-teal/20 mb-2">
            <span className="text-3xl">🔐</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-accent-teal to-cyan-400 bg-clip-text text-transparent">
            VaultGuard
          </h2>
          <p className="text-text-secondary text-sm">
            Access your secure personal vault
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
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
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Master Password
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/50 transition-all text-sm pr-10"
                placeholder="••••••••••••••••"
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
            {isLoading ? 'Decrypting Vault...' : 'Log In & Decrypt'}
          </button>
        </form>

        {/* Footer links */}
        <div className="text-center pt-4 border-t border-border-dark/50 space-y-4">
          <p className="text-xs text-text-secondary">
            Setting up for the first time?{' '}
            <Link to="/register" className="text-accent-teal hover:underline font-medium">
              Create master account
            </Link>
          </p>

          <div className="pt-2 border-t border-border-dark/30">
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="text-xs text-text-secondary hover:text-accent-teal transition-colors cursor-pointer font-medium"
            >
              {showServerConfig ? 'Hide Server Configuration' : 'Configure Server Connection'}
            </button>

            {showServerConfig && (
              <div className="mt-3 p-4 rounded-xl bg-bg-dark border border-border-dark text-left space-y-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                    Vault Server URL
                  </label>
                  <input
                    type="url"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="https://vaultguard-qi2y.onrender.com"
                    className="w-full px-3 py-2 rounded-lg bg-surface-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/30 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveServer}
                  className="w-full py-2 rounded-lg bg-surface-hover hover:bg-border-dark border border-border-dark text-text-primary font-semibold text-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  {serverSaveSuccess ? 'Saved ✓' : 'Save Configuration'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
