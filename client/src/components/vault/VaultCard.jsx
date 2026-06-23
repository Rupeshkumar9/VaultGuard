import React, { useState } from 'react';
import { Star, Copy, Check, ExternalLink, Shield, Globe, RefreshCw, Info, MoreHorizontal } from 'lucide-react';
import { getFaviconUrl, getDomain, formatRelativeTime } from '../../utils/helpers';
import { useClipboard } from '../../hooks/useClipboard';
import { useVault } from '../../contexts/VaultContext';
import { isExtension } from '../../utils/platform';

export default function VaultCard({ entry, onSelect, isSelected, onToggleSelect }) {
  const { toggleFavorite, updateLastUsed, restoreEntry } = useVault();
  const { copy: copyUsername, isCopied: isUsernameCopied } = useClipboard(10000);
  const { copy: copyPassword, isCopied: isPasswordCopied } = useClipboard(10000);
  const [imageError, setImageError] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);

  const domain = entry.website ? getDomain(entry.website) : '';
  const favicon = domain ? getFaviconUrl(entry.website) : null;

  const handleCopyUsername = (e) => {
    e.stopPropagation();
    copyUsername(entry.username);
    setShowCopyFeedback(true);
    setTimeout(() => setShowCopyFeedback(false), 2000);
  };

  const handleCopyPassword = (e) => {
    e.stopPropagation();
    copyPassword(entry.password);
    updateLastUsed(entry._id);
    setShowCopyFeedback(true);
    setTimeout(() => setShowCopyFeedback(false), 2000);
  };

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    toggleFavorite(entry._id);
  };

  const handleRestore = async (e) => {
    e.stopPropagation();
    try {
      await restoreEntry(entry._id);
    } catch (err) {
      alert('Failed to restore entry');
    }
  };

  const handleLinkClick = (e) => {
    e.stopPropagation();
  };

  if (isExtension) {
    return (
      <div 
        onClick={() => onSelect(entry)}
        className="flex items-center justify-between p-3 rounded-xl bg-surface-dark border border-border-dark hover:border-accent-teal/30 hover:bg-surface-hover/80 transition-all duration-200 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
          {/* Avatar circle / icon */}
          {favicon && !imageError ? (
            <img 
              src={favicon} 
              alt=""
              onError={() => setImageError(true)}
              className="w-8 h-8 rounded-lg bg-bg-dark border border-border-dark p-1 shrink-0 object-contain"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-bg-dark border border-border-dark flex items-center justify-center shrink-0">
              {entry.title ? (
                <span className="text-xs font-bold text-accent-teal uppercase">
                  {entry.title.charAt(0)}
                </span>
              ) : (
                <Shield className="w-4 h-4 text-accent-teal/70" />
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-text-primary text-xs truncate">
              {entry.title}
            </h4>
            <p className="text-[10px] text-text-secondary truncate mt-0.5">
              {entry.username || <span className="italic opacity-40">none</span>}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {entry.isInTrash ? (
            <button
              onClick={handleRestore}
              title="Restore Entry"
              className="p-1.5 rounded-lg border border-border-dark bg-bg-dark text-accent-teal hover:bg-accent-teal/10 hover:border-accent-teal/30 transition-all active:scale-90 flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                title="Copy Options"
                className={`p-1.5 rounded-lg border transition-all active:scale-90 flex items-center justify-center cursor-pointer ${
                  isDropdownOpen 
                    ? 'bg-accent-glow border-accent-teal/30 text-accent-teal'
                    : 'bg-bg-dark border-border-dark text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                {showCopyFeedback ? (
                  <Check className="w-3.5 h-3.5 text-accent-teal" />
                ) : (
                  <MoreHorizontal className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <>
                  {/* Invisible backdrop to close the dropdown */}
                  <div 
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownOpen(false);
                    }}
                  />
                  <div className="absolute right-0 mt-1 w-32 rounded-lg bg-surface-dark border border-border-dark shadow-xl z-50 py-1 animate-fadeIn">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyUsername(e);
                        setIsDropdownOpen(false);
                      }}
                      disabled={!entry.username}
                      className="w-full px-3 py-1.5 text-[10px] font-semibold text-left text-text-primary hover:bg-surface-hover hover:text-accent-teal transition-colors flex items-center justify-between disabled:opacity-40 disabled:hover:text-text-primary disabled:hover:bg-transparent"
                    >
                      <span>Copy Email</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyPassword(e);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-[10px] font-semibold text-left text-text-primary hover:bg-surface-hover hover:text-accent-teal transition-colors flex items-center justify-between"
                    >
                      <span>Copy Password</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(entry);
            }}
            title="View Details"
            className="p-1.5 rounded-lg border border-border-dark bg-bg-dark text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all active:scale-90 flex items-center justify-center cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

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
            {!entry.isInTrash && (
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
            )}
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
          {entry.isInTrash ? (
            <button
              onClick={handleRestore}
              title="Restore Entry"
              className="p-1.5 px-2.5 rounded-lg border border-border-dark bg-bg-dark text-accent-teal hover:bg-accent-teal/10 hover:border-accent-teal/30 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">Restore</span>
            </button>
          ) : (
            <>
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
                    <Check className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
