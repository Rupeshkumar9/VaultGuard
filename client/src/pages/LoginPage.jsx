import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCrypto } from '../contexts/CryptoContext';

export default function LoginPage() {
  const { login } = useAuth();
  const { unlock } = useCrypto();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Log in to the Express backend (receives JWT token)
      const res = await login(email, password);
      
      if (res && res.success) {
        // 2. Cache master password in CryptoContext to enable client-side encryption
        unlock(password);
        
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
        <div className="text-center pt-4 border-t border-border-dark/50">
          <p className="text-xs text-text-secondary">
            Setting up for the first time?{' '}
            <Link to="/register" className="text-accent-teal hover:underline font-medium">
              Create master account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
