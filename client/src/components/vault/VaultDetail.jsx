import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Trash2, 
  Edit3, 
  Calendar,
  Shield,
  Star,
  RefreshCw
} from 'lucide-react';
import { getFaviconUrl, getDomain, formatDate } from '../../utils/helpers';
import { useClipboard } from '../../hooks/useClipboard';
import { useVault } from '../../contexts/VaultContext';
import { isExtension } from '../../utils/platform';

export default function VaultDetail({ entry, onClose, onEdit, onDelete, onRestore }) {
  const { toggleFavorite, updateLastUsed } = useVault();
  const { copy: copyUsername, isCopied: isUsernameCopied } = useClipboard(10000);
  const { copy: copyPassword, isCopied: isPasswordCopied } = useClipboard(10000);
  
  const [showPassword, setShowPassword] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [imageError, setImageError] = useState(false);

  const domain = entry.website ? getDomain(entry.website) : '';
  const favicon = domain ? getFaviconUrl(entry.website) : null;

  const handleCopyUsername = () => {
    copyUsername(entry.username);
  };

  const handleCopyPassword = () => {
    copyPassword(entry.password);
    updateLastUsed(entry._id);
  };

  const handleDeleteClick = () => {
    if (isConfirmingDelete) {
      onDelete(entry._id);
    } else {
      setIsConfirmingDelete(true);
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
      <div className={`relative w-full max-w-lg bg-surface-dark border border-border-dark rounded-2xl shadow-2xl overflow-hidden transition-all transform scale-100 flex flex-col ${isExtension ? 'max-h-[95vh]' : 'max-h-[90vh]'}`}>
        
        {/* Modal Header */}
        <div className={`${isExtension ? 'px-4 py-2.5' : 'px-6 py-4'} border-b border-border-dark/60 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            {favicon && !imageError ? (
              <img 
                src={favicon} 
                alt="" 
                onError={() => setImageError(true)}
                className="w-8 h-8 rounded-lg bg-bg-dark border border-border-dark p-1 object-contain"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-bg-dark border border-border-dark flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-accent-teal" />
              </div>
            )}
            <h3 className="font-bold text-text-primary text-base truncate max-w-[280px]">
              {entry.title}
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            {!entry.isInTrash && (
              <button
                onClick={() => toggleFavorite(entry._id)}
                className={`p-1.5 rounded-lg border transition-all ${
                  entry.isFavorite
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'border-border-dark text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <Star className="w-4 h-4 fill-current" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className={`${isExtension ? 'p-4 space-y-3.5 scrollbar-none' : 'p-6 space-y-5 scrollbar-thin'} overflow-y-auto flex-1 text-left`}>
          
          {/* Category & Website */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-text-secondary/60">Category</p>
              <span className="inline-block mt-1 text-xs px-2.5 py-1 bg-surface-hover border border-border-dark text-text-primary rounded-lg font-medium">
                {entry.category}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-text-secondary/60">Website</p>
              {entry.website ? (
                <a 
                  href={entry.website.startsWith('http') ? entry.website : `https://${entry.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent-teal hover:underline font-medium mt-1 truncate max-w-full"
                >
                  <span className="truncate">{domain}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-xs text-text-secondary/50 italic mt-1.5">none</p>
              )}
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary/60">
              Username
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={entry.username || ''}
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-border-dark text-text-primary text-sm focus:outline-none"
                placeholder="No username"
              />
              {entry.username && (
                <button
                  onClick={handleCopyUsername}
                  className={`px-3 py-2 rounded-lg border transition-all active:scale-95 flex items-center justify-center cursor-pointer shrink-0 ${
                    isUsernameCopied 
                      ? 'bg-accent-glow border-accent-teal/30 text-accent-teal'
                      : 'bg-bg-dark border-border-dark text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  {isUsernameCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary/60">
              Password
            </label>
            <div className="flex gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                readOnly
                value={entry.password || ''}
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-border-dark text-text-primary text-sm font-mono tracking-wider focus:outline-none"
                placeholder="No password"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="px-3 py-2 rounded-lg border border-border-dark bg-bg-dark text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors shrink-0"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={handleCopyPassword}
                className={`px-3 py-2 rounded-lg border transition-all active:scale-95 flex items-center justify-center cursor-pointer shrink-0 ${
                  isPasswordCopied 
                    ? 'bg-accent-glow border-accent-teal/30 text-accent-teal'
                    : 'bg-bg-dark border-border-dark text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                {isPasswordCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary/60">
              Notes
            </label>
            <textarea
              readOnly
              value={entry.notes || ''}
              rows={isExtension ? 3 : 4}
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-border-dark text-text-primary text-xs focus:outline-none resize-none scrollbar-thin"
              placeholder="No additional notes"
            />
          </div>

          {/* Timestamps */}
          <div className="pt-2 border-t border-border-dark/30 grid grid-cols-2 gap-4 text-[10px] font-mono text-text-secondary/50">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Created: {formatDate(entry.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Updated: {formatDate(entry.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer (Edit/Delete Actions) */}
        <div className={`${isExtension ? 'px-4 py-2.5' : 'px-6 py-4'} border-t border-border-dark/60 bg-bg-dark/20 flex items-center justify-between gap-3 shrink-0`}>
          {/* Delete Button with inline confirmation */}
          <button
            onClick={handleDeleteClick}
            onMouseLeave={() => setIsConfirmingDelete(false)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-all active:scale-[0.98] cursor-pointer ${
              isConfirmingDelete
                ? 'bg-red-500 border-red-600 text-white hover:bg-red-600 shadow-md shadow-red-500/10'
                : 'bg-red-500/5 hover:bg-red-500/10 border-red-500/10 hover:border-red-500/20 text-red-400'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {isConfirmingDelete
                ? (entry.isInTrash ? 'Confirm Permanent Delete?' : 'Are you sure?')
                : (entry.isInTrash ? 'Delete Permanently' : 'Delete')
              }
            </span>
          </button>

          {/* Edit or Restore Button */}
          {entry.isInTrash ? (
            <button
              onClick={() => onRestore(entry._id)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/35 text-emerald-400 font-semibold text-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restore Entry</span>
            </button>
          ) : (
            <button
              onClick={() => onEdit(entry)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-hover hover:bg-border-dark border border-border-dark text-text-primary font-semibold text-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-accent-teal" />
              <span>Edit Entry</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
