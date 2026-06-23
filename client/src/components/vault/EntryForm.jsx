import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Key, Eye, EyeOff, RefreshCw, Check } from 'lucide-react';
import { useVault } from '../../contexts/VaultContext';
import { isExtension } from '../../utils/platform';

const CATEGORIES = [
  'General',
  'Social Media',
  'Email',
  'Banking',
  'Shopping',
  'Work',
  'Entertainment',
  'Development',
  'Gaming',
  'Other',
];

export default function EntryForm({ entry, onClose }) {
  const { addEntry, updateEntry } = useVault();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('General');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const isEditMode = !!entry;

  // Inline Password Generator states
  const [showGenerator, setShowGenerator] = useState(false);
  const [genLength, setGenLength] = useState(20);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);

  // Populate form if editing
  useEffect(() => {
    if (entry) {
      setTitle(entry.title || '');
      setWebsite(entry.website || '');
      setCategory(entry.category || 'General');
      setUsername(entry.username || '');
      setPassword(entry.password || '');
      setNotes(entry.notes || '');
    }
  }, [entry]);

  // Simple random character password generator helper
  const generatePassword = () => {
    let charset = '';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!charset) {
      setError('Please select at least one character set for password generation.');
      return;
    }

    let result = '';
    // Use Web Crypto API secure random values
    const randomValues = new Uint32Array(genLength);
    window.crypto.getRandomValues(randomValues);

    for (let i = 0; i < genLength; i++) {
      result += charset[randomValues[i] % charset.length];
    }

    setPassword(result);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('Title is required.');
    if (!password) return setError('Password is required.');

    setIsLoading(true);
    setError('');

    const entryData = {
      title: title.trim(),
      website: website.trim(),
      category,
      username: username.trim(),
      password,
      notes: notes.trim(),
      isFavorite: entry?.isFavorite || false,
    };

    try {
      if (isEditMode) {
        await updateEntry(entry._id, entryData);
      } else {
        await addEntry(entryData);
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save vault entry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-bg-dark/80 backdrop-blur-sm transition-opacity" 
      />

      {/* Form Container */}
      <div className={`relative w-full max-w-lg bg-surface-dark border border-border-dark rounded-2xl shadow-2xl overflow-hidden transition-all transform scale-100 flex flex-col ${isExtension ? 'max-h-[95vh]' : 'max-h-[90vh]'}`}>
        
        {/* Form Header */}
        <div className={`${isExtension ? 'px-4 py-2.5' : 'px-6 py-4'} border-b border-border-dark/60 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-glow flex items-center justify-center border border-accent-teal/30">
              <Shield className="w-4.5 h-4.5 text-accent-teal" />
            </div>
            <h3 className="font-bold text-text-primary text-base">
              {isEditMode ? 'Edit Credential' : 'Add New Credential'}
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className={`flex-1 overflow-y-auto ${isExtension ? 'p-4 space-y-3.5 scrollbar-none' : 'p-6 space-y-4 scrollbar-thin'} text-left`}>
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. My Google Account"
              className="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/30 transition-all text-sm"
            />
          </div>

          {/* Website URL & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Website URL
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. https://google.com"
                className="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/30 transition-all text-sm"
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-text-primary focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/30 transition-all text-sm cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-surface-dark">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Username / Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. john@example.com"
              className="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/30 transition-all text-sm"
            />
          </div>

          {/* Password with Generator Integration */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Password <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowGenerator(!showGenerator)}
                className="text-xs text-accent-teal hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                {showGenerator ? 'Hide Generator' : 'Generate Password'}
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password or generate one"
                className="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/30 transition-all text-sm pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-text-secondary hover:text-text-primary transition-colors text-xs"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Inline Generator Panel */}
          {showGenerator && (
            <div className="p-4 rounded-xl bg-bg-dark border border-border-dark space-y-3 animate-fadeIn">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-text-primary">Custom Password Generator</span>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-glow text-accent-teal hover:opacity-90 active:scale-95 text-xs font-semibold border border-accent-teal/20 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Generate
                </button>
              </div>

              {/* Length Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-text-secondary">
                  <span>Length:</span>
                  <span className="font-mono font-bold text-text-primary">{genLength} characters</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={64}
                  value={genLength}
                  onChange={(e) => setGenLength(parseInt(e.target.value))}
                  className="w-full h-1 bg-border-dark rounded-lg appearance-none cursor-pointer accent-accent-teal"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 text-text-secondary cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={includeUppercase}
                    onChange={(e) => setIncludeUppercase(e.target.checked)}
                    className="rounded border-border-dark bg-bg-dark text-accent-teal focus:ring-accent-teal/30"
                  />
                  <span>A-Z (Uppercase)</span>
                </label>
                <label className="flex items-center gap-2 text-text-secondary cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={includeLowercase}
                    onChange={(e) => setIncludeLowercase(e.target.checked)}
                    className="rounded border-border-dark bg-bg-dark text-accent-teal focus:ring-accent-teal/30"
                  />
                  <span>a-z (Lowercase)</span>
                </label>
                <label className="flex items-center gap-2 text-text-secondary cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={includeNumbers}
                    onChange={(e) => setIncludeNumbers(e.target.checked)}
                    className="rounded border-border-dark bg-bg-dark text-accent-teal focus:ring-accent-teal/30"
                  />
                  <span>0-9 (Numbers)</span>
                </label>
                <label className="flex items-center gap-2 text-text-secondary cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={includeSymbols}
                    onChange={(e) => setIncludeSymbols(e.target.checked)}
                    className="rounded border-border-dark bg-bg-dark text-accent-teal focus:ring-accent-teal/30"
                  />
                  <span>!@#$ (Symbols)</span>
                </label>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Store secure verification keys, recovery codes, or hints here..."
              rows={isExtension ? 2 : 4}
              className={`w-full ${isExtension ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'} rounded-lg bg-bg-dark border border-border-dark text-text-primary placeholder-text-secondary/30 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/30 transition-all resize-none scrollbar-thin`}
            />
          </div>

          {/* Footer Submit Button */}
          <div className={`pt-3 border-t border-border-dark/60 flex items-center justify-end gap-3 shrink-0 ${isExtension ? 'mt-3' : 'mt-6'}`}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-surface-hover hover:bg-border-dark text-text-primary text-xs font-semibold transition-all cursor-pointer border border-border-dark"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent-teal to-cyan-500 hover:opacity-90 active:scale-[0.98] text-bg-dark font-bold text-xs transition-all shadow-md shadow-accent-teal/10 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'Update Credential' : 'Save Credential'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
