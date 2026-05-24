import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Key, 
  Star, 
  Folder, 
  Lock, 
  Settings, 
  LogOut,
  Globe,
  Database,
  Mail,
  CreditCard,
  ShoppingBag,
  Briefcase,
  Tv,
  Terminal,
  Gamepad2,
  MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCrypto } from '../../contexts/CryptoContext';
import { useVault } from '../../contexts/VaultContext';

// Map categories to icons
export const CATEGORY_ICONS = {
  'All': Database,
  'Favorites': Star,
  'General': Shield,
  'Social Media': Globe,
  'Email': Mail,
  'Banking': CreditCard,
  'Shopping': ShoppingBag,
  'Work': Briefcase,
  'Entertainment': Tv,
  'Development': Terminal,
  'Gaming': Gamepad2,
  'Other': MoreHorizontal
};

export default function Sidebar({ 
  activeCategory, 
  setActiveCategory, 
  showFavoritesOnly, 
  setShowFavoritesOnly,
  onOpenAddEntry,
  onOpenGenerator,
  onOpenSettings,
  onLogoClick
}) {
  const { logout } = useAuth();
  const { lock } = useCrypto();
  const { entries } = useVault();

  // Get item count helper
  const getCount = (category) => {
    if (category === 'All') return entries.length;
    if (category === 'Favorites') return entries.filter(e => e.isFavorite).length;
    return entries.filter(e => e.category === category).length;
  };

  const categories = [
    'General',
    'Social Media',
    'Email',
    'Banking',
    'Shopping',
    'Work',
    'Entertainment',
    'Development',
    'Gaming',
    'Other'
  ];

  const handleCategoryClick = (category) => {
    setShowFavoritesOnly(false);
    setActiveCategory(category);
  };

  const handleFavoritesClick = () => {
    setShowFavoritesOnly(true);
    setActiveCategory('All');
  };

  return (
    <aside className="w-64 bg-surface-dark border-r border-border-dark flex flex-col h-screen select-none shrink-0">
      {/* Brand Logo */}
      <Link
        to="/"
        onClick={onLogoClick}
        className="h-16 border-b border-border-dark/50 flex items-center px-6 gap-3 cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all select-none"
      >
        <div className="w-8 h-8 rounded-lg bg-accent-glow flex items-center justify-center border border-accent-teal/30">
          <Shield className="w-4 h-4 text-accent-teal" />
        </div>
        <span className="font-bold text-lg bg-gradient-to-r from-accent-teal to-cyan-400 bg-clip-text text-transparent tracking-tight">
          VaultGuard
        </span>
      </Link>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-7 scrollbar-thin">
        {/* Core Categories */}
        <div className="space-y-1">
          <button
            onClick={() => handleCategoryClick('All')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeCategory === 'All' && !showFavoritesOnly
                ? 'bg-accent-glow text-accent-teal border-l-2 border-accent-teal'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <div className="flex items-center gap-3">
              <Database className="w-4.5 h-4.5" />
              <span>All Items</span>
            </div>
            <span className="text-xs bg-bg-dark border border-border-dark px-2 py-0.5 rounded-full text-text-secondary font-mono">
              {getCount('All')}
            </span>
          </button>

          <button
            onClick={handleFavoritesClick}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              showFavoritesOnly
                ? 'bg-accent-glow text-accent-teal border-l-2 border-accent-teal'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <div className="flex items-center gap-3">
              <Star className="w-4.5 h-4.5" />
              <span>Favorites</span>
            </div>
            <span className="text-xs bg-bg-dark border border-border-dark px-2 py-0.5 rounded-full text-text-secondary font-mono">
              {getCount('Favorites')}
            </span>
          </button>
        </div>

        {/* Categories Group */}
        <div className="space-y-2">
          <h3 className="px-3 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Categories
          </h3>
          <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category] || Shield;
              const isActive = activeCategory === category && !showFavoritesOnly;
              return (
                <button
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-accent-glow text-accent-teal border-l-2 border-accent-teal font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4.5 h-4.5" />
                    <span>{category}</span>
                  </div>
                  <span className="text-[11px] font-mono text-text-secondary/60">
                    {getCount(category)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tools Section */}
        <div className="space-y-2">
          <h3 className="px-3 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Tools
          </h3>
          <div className="space-y-0.5">
            <button
              onClick={onOpenGenerator}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all"
            >
              <Key className="w-4.5 h-4.5 text-text-secondary/70" />
              <span>Generator</span>
            </button>
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all"
            >
              <Settings className="w-4.5 h-4.5 text-text-secondary/70" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-border-dark/50 space-y-2">
        <button
          onClick={() => lock()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-surface-hover hover:bg-border-dark border border-border-dark text-text-primary text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Lock Vault</span>
        </button>
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 text-red-400 text-xs font-medium transition-all active:scale-[0.98] cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
