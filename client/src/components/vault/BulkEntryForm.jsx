import React, { useState } from 'react';
import { X, Save, Folder } from 'lucide-react';
import { useVault } from '../../contexts/VaultContext';

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

export default function BulkEntryForm({ selectedIds, onClose, onClearSelection }) {
  const { updateEntries } = useVault();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Toggles for which fields to update
  const [updateTitleFlag, setUpdateTitleFlag] = useState(false);
  const [updateCategoryFlag, setUpdateCategoryFlag] = useState(false);
  const [updateWebsiteFlag, setUpdateWebsiteFlag] = useState(false);

  // Field values
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [website, setWebsite] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation: must select at least one field to update
    if (!updateTitleFlag && !updateCategoryFlag && !updateWebsiteFlag) {
      setError('Please select at least one field to update.');
      return;
    }

    if (updateTitleFlag && !title.trim()) {
      setError('Title cannot be empty if "Update Title" is selected.');
      return;
    }

    const updates = {};
    if (updateTitleFlag) updates.title = title.trim();
    if (updateCategoryFlag) updates.category = category;
    if (updateWebsiteFlag) updates.website = website.trim();

    setIsLoading(true);
    try {
      await updateEntries(selectedIds, updates);
      onClearSelection();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to apply bulk updates.');
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

      {/* Modal Container */}
      <form 
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-surface-dark border border-border-dark rounded-2xl shadow-2xl overflow-hidden transition-all transform scale-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-dark/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-glow flex items-center justify-center border border-accent-teal/10">
              <Folder className="w-4.5 h-4.5 text-accent-teal" />
            </div>
            <h3 className="font-bold text-text-primary text-base">
              Bulk Edit ({selectedIds.length} Items)
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

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin text-left">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
              {error}
            </div>
          )}

          <p className="text-xs text-text-secondary leading-relaxed">
            Select the fields you want to update across all {selectedIds.length} credentials. Unchecked fields will remain unchanged.
          </p>

          {/* Title Edit */}
          <div className="space-y-2 p-3.5 rounded-xl bg-bg-dark/40 border border-border-dark/40">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={updateTitleFlag}
                onChange={(e) => setUpdateTitleFlag(e.target.checked)}
                className="w-4 h-4 rounded border border-border-dark text-accent-teal focus:ring-accent-teal bg-bg-dark cursor-pointer"
              />
              <span className="text-xs font-bold text-text-primary">Update Title</span>
            </label>
            <input
              type="text"
              disabled={!updateTitleFlag}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter new title for all items"
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-dark border border-border-dark text-text-primary focus:outline-none focus:border-accent-teal disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            />
          </div>

          {/* Category Edit */}
          <div className="space-y-2 p-3.5 rounded-xl bg-bg-dark/40 border border-border-dark/40">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={updateCategoryFlag}
                onChange={(e) => setUpdateCategoryFlag(e.target.checked)}
                className="w-4 h-4 rounded border-border-dark text-accent-teal focus:ring-accent-teal bg-bg-dark cursor-pointer"
              />
              <span className="text-xs font-bold text-text-primary">Update Category</span>
            </label>
            <select
              disabled={!updateCategoryFlag}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-dark border border-border-dark text-text-primary focus:outline-none focus:border-accent-teal disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Website URL Edit */}
          <div className="space-y-2 p-3.5 rounded-xl bg-bg-dark/40 border border-border-dark/40">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={updateWebsiteFlag}
                onChange={(e) => setUpdateWebsiteFlag(e.target.checked)}
                className="w-4 h-4 rounded border-border-dark text-accent-teal focus:ring-accent-teal bg-bg-dark cursor-pointer"
              />
              <span className="text-xs font-bold text-text-primary">Update Website URL</span>
            </label>
            <input
              type="text"
              disabled={!updateWebsiteFlag}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="e.g. https://google.com"
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-dark border border-border-dark text-text-primary focus:outline-none focus:border-accent-teal disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-dark/60 bg-bg-dark/20 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-xs font-semibold border border-border-dark text-text-primary bg-surface-hover hover:bg-border-dark transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent-teal to-cyan-500 hover:opacity-90 active:scale-[0.98] text-bg-dark font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Saving...' : 'Apply Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
