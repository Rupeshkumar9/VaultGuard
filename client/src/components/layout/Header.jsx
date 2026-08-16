import { useEffect, useRef, useState } from 'react';
import { Search, Plus, Menu, User, Lock, LogOut, HelpCircle, ChevronDown, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCrypto } from '../../contexts/CryptoContext';
import ServerStatus from './ServerStatus';

export default function Header({ 
  searchQuery, 
  setSearchQuery, 
  onOpenAddEntry, 
  onToggleMobileSidebar,
  onOpenSettings
}) {
  const { user, logout } = useAuth();
  const { lock } = useCrypto();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!isProfileOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsProfileOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileOpen]);

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';

  const handleLock = async () => {
    setIsProfileOpen(false);
    await lock();
  };

  const handleLogout = async () => {
    setIsProfileOpen(false);
    await logout();
  };

  return (
    <header className="relative z-[60] h-16 bg-surface-dark/40 backdrop-blur-md border-b border-border-dark px-3 sm:px-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-4 shrink-0 overflow-visible">
      
      {/* Left side: Hamburger (Mobile) + Search Bar */}
      <div className="flex min-w-0 w-full items-center gap-2 sm:gap-3 max-w-md">
        <button 
          onClick={onToggleMobileSidebar}
          className="p-2 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover md:hidden transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative min-w-0 flex-1">
          <Search className="w-4 h-4 text-text-secondary/60 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search credentials, websites..."
            className="w-full min-w-0 pl-9 pr-4 py-2 rounded-lg bg-bg-dark border border-border-dark text-text-primary text-sm placeholder-text-secondary/40 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/30 transition-all"
          />
        </div>
      </div>

      {/* Right side: Add Entry + User Profile */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
        {/* Server Connection Status Indicator */}
        <ServerStatus />

        {/* Add Entry Button */}
        <button
          onClick={onOpenAddEntry}
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-2.5 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-accent-teal to-cyan-500 hover:opacity-90 active:scale-[0.98] text-bg-dark font-semibold text-sm transition-all shadow-md shadow-accent-teal/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Item</span>
        </button>

        {/* Profile / Account Badge */}
        <div ref={profileRef} className="relative border-l border-border-dark/60 pl-2 sm:pl-4 h-8 flex items-center">
          <button
            type="button"
            onClick={() => setIsProfileOpen((open) => !open)}
            aria-expanded={isProfileOpen}
            aria-haspopup="menu"
            className="flex items-center gap-1.5 sm:gap-2 rounded-lg p-1 -mr-1 hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center border border-border-dark shrink-0">
              <User className="w-4 h-4 text-text-secondary" />
            </div>
            <div className="hidden sm:block text-left select-none">
              <p className="text-xs font-semibold text-text-primary max-w-[120px] truncate">
                {displayName}
              </p>
              <p className="text-[10px] text-text-secondary">Owner</p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-text-secondary transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 w-[min(17rem,calc(100vw-1.5rem))] rounded-xl border border-border-dark bg-surface-dark/95 shadow-2xl backdrop-blur-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border-dark/70">
                <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
                <p className="text-xs text-text-secondary truncate">{user?.email || 'No email available'}</p>
              </div>

              <div className="p-2 space-y-1">
                <button type="button" onClick={handleLock} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors text-left cursor-pointer">
                  <Lock className="w-4 h-4 text-accent-teal" />
                  <span>Lock Vault</span>
                </button>
                <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left cursor-pointer">
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>

              <div className="border-t border-border-dark/70 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                  <HelpCircle className="w-4 h-4 text-accent-teal" />
                  <span>Help &amp; Security</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-text-secondary">
                  Your vault is encrypted locally. Keep your master password safe because it cannot be recovered.
                </p>
                {onOpenSettings && (
                  <button type="button" onClick={() => { setIsProfileOpen(false); onOpenSettings(); }} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-teal hover:text-cyan-300 transition-colors cursor-pointer">
                    <Settings className="w-3.5 h-3.5" />
                    Open Settings
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
