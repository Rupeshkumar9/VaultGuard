import React, { useState } from 'react';
import { Star, Copy, Check, ExternalLink, Shield, Globe } from 'lucide-react';
import { getFaviconUrl, getDomain, formatRelativeTime } from '../../utils/helpers';
import { useClipboard } from '../../hooks/useClipboard';
import { useVault } from '../../contexts/VaultContext';

export default function VaultCard({ entry, onSelect, isSelected, onToggleSelect }) {
  const { toggleFavorite, updateLastUsed } = useVault();
  const { copy: copyUsername, isCopied: isUsernameCopied } = useClipboard(10000);
  const { copy: copyPassword, isCopied: isPasswordCopied } = useClipboard(10000);
  const [imageError, setImageError] = useState(false);

  const domain = entry.website ? getDomain(entry.website) : '';
  const favicon = domain ? getFaviconUrl(entry.website) : null;

  const handleCopyUsername = (e) => {
    e.stopPropagation();
    copyUsername(entry.username);
  };

  const handleCopyPassword = (e) => {
    e.stopPropagation();
    copyPassword(entry.password);
    updateLastUsed(entry._id);
  };

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    toggleFavorite(entry._id);
  };

  const handleLinkClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div 
      onClick={() => onSelect(entry)}
      className="p-5 rounded-2xl bg-surface-dark border border-border-dark hover:border-accent-teal/30 hover:bg-surface-hover/80 hover:shadow-xl hover:shadow-accent-teal/2 transition-all duration-300 flex flex-col justify-between h-44 cursor-pointer relative group overflow-hidden"
    >
      {/* Background radial glow on hover */}
      <div className="absolute -inset-px bg-gradient-to-r from-accent-teal/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />

      <div className="relative z-10 space-y-3">
        {/* Card Header (Favicon + Title + Checkbox + Star) */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {favicon && !imageError ? (
              <img 
                src={favicon} 
                alt={entry.title}
                onError={() => setImageError(true)}
                className="w-10 h-10 rounded-xl bg-bg-dark border border-border-dark p-1.5 shrink-0 object-contain"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-bg-dark border border-border-dark flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-accent-teal/70" />
              </div>
            )}
            
            <div className="text-left">
              <h4 className="font-bold text-text-primary text-sm line-clamp-1 group-hover:text-accent-teal transition-colors">
                {entry.title}
              </h4>
              {domain ? (
                <a 
                  href={entry.website.startsWith('http') ? entry.website : `https://${entry.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleLinkClick}
                  className="text-xs text-text-secondary hover:text-accent-teal inline-flex items-center gap-1 mt-0.5"
                >
                  <span className="truncate max-w-[130px]">{domain}</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                </a>
              ) : (
                <span className="text-xs text-text-secondary">No Website</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <input 
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(entry._id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-border-dark text-accent-teal focus:ring-accent-teal bg-bg-dark cursor-pointer"
            />
            <button
              onClick={handleFavoriteClick}
              className={`p-1.5 rounded-lg border transition-all ${
                entry.isFavorite
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-dark'
              }`}
            >
              <Star className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>

        {/* Username Preview */}
        <div className="text-left">
          <p className="text-[10px] uppercase font-bold tracking-wider text-text-secondary/60">Username</p>
          <p className="text-xs text-text-secondary truncate mt-0.5">
            {entry.username || <span className="italic opacity-40">none</span>}
          </p>
        </div>
      </div>

      {/* Card Footer (Actions & Timestamp) */}
      <div className="relative z-10 pt-3 border-t border-border-dark/30 flex items-center justify-between gap-2 mt-auto">
        <span className="text-[10px] text-text-secondary/50 font-mono">
          {entry.lastUsed ? `Used ${formatRelativeTime(entry.lastUsed)}` : 'Never used'}
        </span>

        <div className="flex gap-1.5">
          {entry.username && (
            <button
              onClick={handleCopyUsername}
              title="Copy Username"
              className={`p-2 rounded-lg border transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
                isUsernameCopied 
                  ? 'bg-accent-glow border-accent-teal/30 text-accent-teal'
                  : 'bg-bg-dark border-border-dark text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              {isUsernameCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={handleCopyPassword}
            title="Copy Password"
            className={`p-2 rounded-lg border transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
              isPasswordCopied 
                ? 'bg-accent-glow border-accent-teal/30 text-accent-teal font-medium'
                : 'bg-bg-dark border-border-dark text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            {isPasswordCopied ? (
              <span className="text-[10px] font-bold px-0.5 flex items-center gap-1">
                <Check className="w-3 h-3" />
              </span>
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
