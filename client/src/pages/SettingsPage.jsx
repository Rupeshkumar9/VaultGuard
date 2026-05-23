import React, { useState } from 'react';
import { 
  Settings, 
  ShieldAlert, 
  Download, 
  Lock, 
  User, 
  FileJson,
  Info,
  Check,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useVault } from '../contexts/VaultContext';
import { useCrypto } from '../contexts/CryptoContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const { entries } = useVault();
  const { isUnlocked } = useCrypto();
  const [isExportingDecrypted, setIsExportingDecrypted] = useState(false);
  const [isExportingEncrypted, setIsExportingEncrypted] = useState(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState(() => {
    return localStorage.getItem('vaultguard_lock_timeout') || '5';
  });

  const handleTimeoutChange = (e) => {
    const val = e.target.value;
    setAutoLockTimeout(val);
    localStorage.setItem('vaultguard_lock_timeout', val);
    // Dispatch an event to let the hook know the timeout changed
    window.dispatchEvent(new Event('vaultguard_timeout_changed'));
  };

  const handleExportDecrypted = () => {
    if (!isUnlocked || entries.length === 0) return;
    setIsExportingDecrypted(true);

    try {
      // Create clean decrypted payload for user download
      const cleanData = entries.map(e => ({
        title: e.title,
        website: e.website,
        category: e.category,
        username: e.username,
        password: e.password,
        notes: e.notes,
        isFavorite: e.isFavorite,
        createdAt: e.createdAt
      }));

      const blob = new Blob([JSON.stringify(cleanData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vaultguard_decrypted_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsExportingDecrypted(false), 1500);
    }
  };

  const handleExportEncrypted = () => {
    if (entries.length === 0) return;
    setIsExportingEncrypted(true);

    try {
      // Create encrypted payload (directly raw from server parameters)
      const encryptedData = entries.map(e => ({
        title: e.title,
        website: e.website,
        category: e.category,
        encryptedData: e.encryptedData,
        iv: e.iv,
        salt: e.salt,
        notes: e.notes,
        isFavorite: e.isFavorite,
        createdAt: e.createdAt
      }));

      const blob = new Blob([JSON.stringify(encryptedData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vaultguard_encrypted_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsExportingEncrypted(false), 1500);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left">
      <div>
        <h2 className="text-xl font-bold text-text-primary">System Settings</h2>
        <p className="text-xs text-text-secondary mt-1">
          Manage your security preferences, session timeouts, and data backups.
        </p>
      </div>

      {/* Account Info */}
      <div className="p-6 rounded-2xl bg-surface-dark border border-border-dark space-y-4">
        <div className="flex items-center gap-3 border-b border-border-dark/50 pb-3">
          <User className="w-5 h-5 text-accent-teal" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Account Overview</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-text-secondary">Logged in Email</p>
            <p className="font-semibold text-text-primary mt-0.5">{user?.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Vault Size</p>
            <p className="font-semibold text-text-primary mt-0.5">{entries.length} credentials stored</p>
          </div>
        </div>
      </div>

      {/* Security Preferences */}
      <div className="p-6 rounded-2xl bg-surface-dark border border-border-dark space-y-4">
        <div className="flex items-center gap-3 border-b border-border-dark/50 pb-3">
          <Lock className="w-5 h-5 text-accent-teal" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Security Preferences</h3>
        </div>
        
        {/* Auto Lock timeout */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-text-secondary">Auto-lock Inactivity Timeout</label>
          <select
            value={autoLockTimeout}
            onChange={handleTimeoutChange}
            className="w-full max-w-xs px-3 py-2 rounded-lg bg-bg-dark border border-border-dark text-text-primary text-sm focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/30 cursor-pointer"
          >
            <option value="1" className="bg-surface-dark">1 Minute</option>
            <option value="5" className="bg-surface-dark">5 Minutes</option>
            <option value="15" className="bg-surface-dark">15 Minutes</option>
            <option value="30" className="bg-surface-dark">30 Minutes</option>
            <option value="0" className="bg-surface-dark">Never Lock</option>
          </select>
          <p className="text-[10px] text-text-secondary/60">
            Automatically lock the vault (clearing keys from memory) if there is no keyboard, mouse or touch activity.
          </p>
        </div>
      </div>

      {/* Cryptography Specifications */}
      <div className="p-6 rounded-2xl bg-surface-dark border border-border-dark space-y-3.5">
        <div className="flex items-center gap-3 border-b border-border-dark/50 pb-3">
          <Info className="w-5 h-5 text-accent-teal" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Cryptography Specification</h3>
        </div>
        <div className="text-xs space-y-2 text-text-secondary">
          <p className="flex justify-between">
            <span className="font-semibold text-text-primary/80">Key Derivation Function:</span>
            <span className="font-mono">PBKDF2 (HMAC-SHA256)</span>
          </p>
          <p className="flex justify-between">
            <span className="font-semibold text-text-primary/80">PBKDF2 Iteration Count:</span>
            <span className="font-mono">600,000 iterations</span>
          </p>
          <p className="flex justify-between">
            <span className="font-semibold text-text-primary/80">Encryption Cipher:</span>
            <span className="font-mono">AES-256-GCM (Galois/Counter Mode)</span>
          </p>
          <p className="flex justify-between">
            <span className="font-semibold text-text-primary/80">Decryption Location:</span>
            <span className="font-mono text-accent-teal">Local Browser Engine (Zero-Knowledge)</span>
          </p>
        </div>
      </div>

      {/* Import / Export Backups */}
      <div className="p-6 rounded-2xl bg-surface-dark border border-border-dark space-y-4">
        <div className="flex items-center gap-3 border-b border-border-dark/50 pb-3">
          <FileJson className="w-5 h-5 text-accent-teal" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Data Backups & Export</h3>
        </div>
        
        <p className="text-xs text-text-secondary">
          Back up your vault credentials. We recommend exporting the **encrypted backup** so that your credentials remain secure even if stored in plain sight.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Encrypted Export */}
          <button
            onClick={handleExportEncrypted}
            disabled={entries.length === 0 || isExportingEncrypted}
            className="flex items-center justify-between p-4 rounded-xl bg-bg-dark border border-border-dark hover:border-accent-teal/30 hover:bg-bg-dark/80 text-left transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <div className="space-y-1">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                Encrypted Backup
              </span>
              <p className="text-[10px] text-text-secondary/70">Safe to store anywhere. Needs master password to unlock.</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-surface-hover border border-border-dark flex items-center justify-center shrink-0 ml-3">
              {isExportingEncrypted ? <Check className="w-4 h-4 text-accent-teal" /> : <Download className="w-4 h-4 text-text-secondary" />}
            </div>
          </button>

          {/* Decrypted Export */}
          <button
            onClick={handleExportDecrypted}
            disabled={entries.length === 0 || isExportingDecrypted}
            className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/20 hover:bg-red-500/10 text-left transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <div className="space-y-1">
              <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                Decrypted JSON Export
              </span>
              <p className="text-[10px] text-text-secondary/70">⚠️ Highly Unsafe! Outputs all credentials in plaintext.</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 ml-3">
              {isExportingDecrypted ? <Check className="w-4 h-4 text-red-400" /> : <Download className="w-4 h-4 text-red-400/80" />}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
