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
  AlertTriangle,
  Upload,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useVault } from '../contexts/VaultContext';
import { useCrypto } from '../contexts/CryptoContext';
import { isExtension } from '../utils/platform';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { entries, addEntry, fetchEntries, deleteEntry } = useVault();
  const { isUnlocked, decryptData } = useCrypto();
  const [isExportingDecrypted, setIsExportingDecrypted] = useState(false);

  // Sync state for extensions
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncError, setSyncError] = useState('');

  const handleSyncVault = async () => {
    setIsSyncing(true);
    setSyncError('');
    setSyncSuccess(false);
    try {
      const response = await chrome.runtime.sendMessage({ action: 'SYNC_VAULT' });
      if (response && response.success) {
        await fetchEntries();
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
      } else {
        throw new Error(response?.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Failed to sync vault:', err);
      setSyncError(err.message || 'Failed to sync vault.');
    } finally {
      setIsSyncing(false);
    }
  };

  const [isExportingEncrypted, setIsExportingEncrypted] = useState(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState(() => {
    return localStorage.getItem('vaultguard_lock_timeout') || '5';
  });




  const [importStatus, setImportStatus] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

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

  const parseCSV = (text) => {
    // 1. Strip UTF-8 BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');

    // 2. Auto-detect delimiter (, or ; or \t)
    let delimiter = ',';
    const firstLine = cleanText.split(/[\r\n]+/)[0];
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    if (semicolons > commas && semicolons > tabs) {
      delimiter = ';';
    } else if (tabs > commas && tabs > semicolons) {
      delimiter = '\t';
    }

    const lines = [];
    let row = [""];
    let insideQuote = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === delimiter && !insideQuote) {
        row.push('');
      } else if ((char === '\r' || char === '\n') && !insideQuote) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(row);
    }

    if (lines.length === 0) return [];

    const headers = lines[0].map(h => h.replace(/["']/g, '').trim().toLowerCase());
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 1 && row[0] === '') continue;

      const entry = {};
      headers.forEach((header, index) => {
        let val = row[index] ? row[index].trim() : '';
        
        // Strip spaces, underscores, and dashes to normalize matching
        const normalizedHeader = header.replace(/[\s_-]/g, '');
        let fieldName = header;
        
        if (['url', 'loginuri', 'website', 'uri', 'link', 'domain'].includes(normalizedHeader)) {
          fieldName = 'website';
        } else if (['name', 'title', 'label', 'account'].includes(normalizedHeader)) {
          fieldName = 'title';
        } else if (['username', 'loginusername', 'user', 'email', 'login'].includes(normalizedHeader)) {
          fieldName = 'username';
        } else if (['password', 'loginpassword', 'pass', 'code'].includes(normalizedHeader)) {
          fieldName = 'password';
        } else if (['note', 'notes', 'comment', 'comments', 'description'].includes(normalizedHeader)) {
          fieldName = 'notes';
        } else if (normalizedHeader === 'category') {
          fieldName = 'category';
        }
        
        entry[fieldName] = val;
      });
      results.push(entry);
    }

    return results;
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus('Reading file...');
    setImportError('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        let importedEntries = [];

        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          if (!Array.isArray(data)) {
            throw new Error('JSON file must be a top-level array of credentials.');
          }
          importedEntries = data;
        } else if (file.name.endsWith('.csv')) {
          importedEntries = parseCSV(text);
        } else {
          throw new Error('Unsupported file format. Please upload a .json or .csv file.');
        }

        if (importedEntries.length === 0) {
          throw new Error('No credentials found in the uploaded file.');
        }

        // Validate that we successfully matched the minimal columns
        const hasTitle = importedEntries.some(e => e.title);
        const hasPassword = importedEntries.some(e => e.password || e.encryptedData);

        if (!hasTitle || !hasPassword) {
          throw new Error('Could not identify "title" (or "name") and "password" columns. Please verify your CSV headers.');
        }

        setImportStatus(`Importing 0 of ${importedEntries.length}...`);
        let successCount = 0;

        let skippedDuplicates = 0;

        for (let i = 0; i < importedEntries.length; i++) {
          const entry = importedEntries[i];
          
          if (!entry.title || (!entry.password && !entry.encryptedData)) {
            console.warn('Skipping invalid entry:', entry);
            continue;
          }

          try {
            let plaintextUsername = entry.username || '';
            let plaintextPassword = entry.password || '';
            let plaintextNotes = entry.notes || '';

            if (entry.encryptedData && entry.iv && entry.salt) {
              try {
                const decryptedText = await decryptData(entry.encryptedData, entry.iv, entry.salt);
                const sensitive = JSON.parse(decryptedText);
                plaintextUsername = sensitive.username || '';
                plaintextPassword = sensitive.password || '';
                plaintextNotes = sensitive.notes || '';
              } catch (decErr) {
                console.error('Failed to decrypt backup entry:', entry.title, decErr);
                throw new Error(`Failed to decrypt "${entry.title}". Make sure this backup matches your current Master Password.`);
              }
            }

            // Check if this credential already exists (De-duplication)
            const isDuplicate = entries.some(existing => 
              existing.title?.toLowerCase() === entry.title?.toLowerCase() &&
              (existing.username || '').toLowerCase() === (plaintextUsername || '').toLowerCase() &&
              (existing.website || '').replace(/\/$/, '').toLowerCase() === (entry.website || '').replace(/\/$/, '').toLowerCase()
            );

            if (isDuplicate) {
              console.log('Skipping duplicate entry:', entry.title);
              skippedDuplicates++;
              continue;
            }

            // Add the entry with skipFetch = true to prevent quadratic DB queries
            await addEntry({
              title: entry.title,
              website: entry.website || '',
              category: entry.category || 'General',
              username: plaintextUsername,
              password: plaintextPassword,
              notes: plaintextNotes
            }, true);
            
            successCount++;
            setImportStatus(`Importing ${successCount} of ${importedEntries.length}...`);
          } catch (err) {
            console.error('Error importing single entry:', entry.title, err);
          }
        }

        // Trigger a single batch fetchEntries at the very end
        await fetchEntries();

        if (skippedDuplicates > 0) {
          setImportStatus(`Successfully imported ${successCount} credentials! (Skipped ${skippedDuplicates} duplicates)`);
        } else {
          setImportStatus(`Successfully imported ${successCount} credentials!`);
        }
        e.target.value = null;
      } catch (err) {
        console.error(err);
        setImportError(err.message || 'Failed to parse file.');
        setImportStatus('');
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      setImportError('Failed to read file.');
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  const handleRemoveDuplicates = async () => {
    setIsImporting(true);
    setImportStatus('Scanning for duplicates...');
    setImportError('');

    try {
      const seen = new Map();
      const duplicatesToDelete = [];

      for (const entry of entries) {
        const key = `${(entry.title || '').toLowerCase()}|${(entry.username || '').toLowerCase()}|${(entry.website || '').replace(/\/$/, '').toLowerCase()}`;
        if (seen.has(key)) {
          duplicatesToDelete.push(entry._id);
        } else {
          seen.set(key, entry._id);
        }
      }

      if (duplicatesToDelete.length === 0) {
        setImportStatus('No duplicates found in your vault!');
        setIsImporting(false);
        return;
      }

      setImportStatus(`Removing ${duplicatesToDelete.length} duplicate entries...`);
      let deletedCount = 0;

      for (const id of duplicatesToDelete) {
        await deleteEntry(id);
        deletedCount++;
        setImportStatus(`Removed ${deletedCount} of ${duplicatesToDelete.length} duplicates...`);
      }

      // Re-fetch clean list
      await fetchEntries();
      setImportStatus(`Successfully removed all ${deletedCount} duplicates!`);
    } catch (err) {
      console.error(err);
      setImportError('Failed to remove duplicates.');
    } finally {
      setIsImporting(false);
    }
  };


  if (isExtension) {
    return (
      <div className="space-y-4 text-left">
        {/* Account Info */}
        <div className="p-3.5 rounded-xl bg-surface-dark border border-border-dark space-y-3 shadow-md">
          <div className="flex items-center gap-2 border-b border-border-dark/50 pb-2">
            <User className="w-4 h-4 text-accent-teal" />
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Account Overview</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <p className="text-[10px] text-text-secondary">Logged in Email</p>
              <p className="font-semibold text-text-primary mt-0.5 break-all">{user?.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-secondary">Vault Size</p>
              <p className="font-semibold text-text-primary mt-0.5">{entries.length} credentials stored</p>
            </div>
          </div>
        </div>

        {/* Security Preferences */}
        <div className="p-3.5 rounded-xl bg-surface-dark border border-border-dark space-y-3 shadow-md">
          <div className="flex items-center gap-2 border-b border-border-dark/50 pb-2">
            <Lock className="w-4 h-4 text-accent-teal" />
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Security Preferences</h3>
          </div>
          
          {/* Auto Lock timeout */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold text-text-secondary">Auto-lock Inactivity Timeout</label>
            <select
              value={autoLockTimeout}
              onChange={handleTimeoutChange}
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg-dark border border-border-dark text-text-primary text-xs focus:outline-none focus:border-accent-teal cursor-pointer"
            >
              <option value="1" className="bg-surface-dark">1 Minute</option>
              <option value="5" className="bg-surface-dark">5 Minutes</option>
              <option value="15" className="bg-surface-dark">15 Minutes</option>
              <option value="30" className="bg-surface-dark">30 Minutes</option>
              <option value="0" className="bg-surface-dark">Never Lock</option>
            </select>
          </div>
        </div>

        {/* Vault Actions */}
        <div className="p-3.5 rounded-xl bg-surface-dark border border-border-dark space-y-3 shadow-md">
          <div className="flex items-center gap-2 border-b border-border-dark/50 pb-2">
            <Settings className="w-4 h-4 text-accent-teal" />
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Vault Actions</h3>
          </div>
          <div className="flex flex-col gap-2">
            {/* Sync Vault Now */}
            <button
              onClick={handleSyncVault}
              disabled={isSyncing}
              className="w-full py-2 px-3 rounded-lg bg-bg-dark border border-border-dark hover:border-accent-teal/30 hover:bg-surface-hover text-left transition-all active:scale-[0.98] cursor-pointer text-xs font-semibold text-text-primary flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 text-accent-teal ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing Vault...' : 'Sync Vault Now'}</span>
              </div>
              {syncSuccess && <span className="text-[10px] text-accent-teal font-bold">Success ✓</span>}
              {syncError && <span className="text-[10px] text-red-400 font-bold truncate max-w-[120px]">Failed ⚠️</span>}
            </button>

            {/* Go to Web Dashboard */}
            <button
              onClick={() => window.open(import.meta.env.VITE_FRONTEND_URL || 'https://vault-guard-xi.vercel.app/', '_blank')}
              className="w-full py-2 px-3 rounded-lg bg-bg-dark border border-border-dark hover:border-accent-teal/30 hover:bg-surface-hover text-left transition-all active:scale-[0.98] cursor-pointer text-xs font-semibold text-text-primary flex items-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5 text-accent-teal" />
              <span>Go to Web Dashboard</span>
            </button>
          </div>
          {syncError && (
            <p className="text-[9px] text-red-400 mt-1 font-medium leading-snug">
              ⚠️ {syncError}
            </p>
          )}
        </div>

        {/* Log Out Button */}
        <button
          onClick={logout}
          className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Log Out of Vault</span>
        </button>
      </div>
    );
  }

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-text-secondary">Logged in Email</p>
            <p className="font-semibold text-text-primary mt-0.5 break-all">{user?.email || 'N/A'}</p>
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

      {/* Import Credentials */}
      <div className="p-6 rounded-2xl bg-surface-dark border border-border-dark space-y-4">
        <div className="flex items-center gap-3 border-b border-border-dark/50 pb-3">
          <Upload className="w-5 h-5 text-accent-teal" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Import Credentials</h3>
        </div>
        
        <p className="text-xs text-text-secondary">
          Import credentials from a **VaultGuard JSON export** or a **standard CSV file** (e.g. exported from Chrome or Bitwarden). All decryption and encryption is performed locally on your device for absolute privacy.
        </p>

        <div className="pt-2">
          <label className="relative flex flex-col items-center justify-center border border-dashed border-border-dark/80 hover:border-accent-teal/50 rounded-xl p-6 bg-bg-dark/40 cursor-pointer transition-all hover:bg-bg-dark/60">
            <Upload className="w-8 h-8 text-text-secondary mb-2" />
            <span className="text-xs font-semibold text-text-primary">Click to upload JSON or CSV file</span>
            <span className="text-[10px] text-text-secondary/60 mt-1">Accepts .json, .csv</span>
            <input 
              type="file" 
              accept=".json,.csv" 
              onChange={handleImportFile} 
              disabled={isImporting}
              className="hidden" 
            />
          </label>
        </div>

        {/* Extra Utilities */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleRemoveDuplicates}
            disabled={entries.length === 0 || isImporting}
            className="w-full py-3 px-4 rounded-xl bg-bg-dark hover:bg-bg-dark/80 border border-border-dark text-xs font-bold text-text-primary transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-warning-color" />
            <span>Scan & Clean Duplicate Entries</span>
          </button>
        </div>

        {importStatus && (
          <div className="p-3 bg-accent-teal/10 border border-accent-teal/20 rounded-xl flex items-center gap-2 text-xs text-accent-teal">
            <Check className="w-4 h-4 shrink-0" />
            <span>{importStatus}</span>
          </div>
        )}

        {importError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{importError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
