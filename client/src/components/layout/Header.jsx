import React from 'react';
import { Search, Plus, Menu, User, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ServerStatus from './ServerStatus';

export default function Header({ 
  searchQuery, 
  setSearchQuery, 
  onOpenAddEntry, 
  onToggleMobileSidebar 
}) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-surface-dark/40 backdrop-blur-md border-b border-border-dark px-6 flex items-center justify-between gap-4 shrink-0">
      
      {/* Left side: Hamburger (Mobile) + Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button 
          onClick={onToggleMobileSidebar}
          className="p-2 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover md:hidden transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-text-secondary/60 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search credentials, websites..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-bg-dark border border-border-dark text-text-primary text-sm placeholder-text-secondary/40 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal/30 transition-all"
          />
        </div>
      </div>

      {/* Right side: Add Entry + User Profile */}
      <div className="flex items-center gap-4">
        {/* Server Connection Status Indicator */}
        <ServerStatus />

        {/* Add Entry Button */}
        <button
          onClick={onOpenAddEntry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent-teal to-cyan-500 hover:opacity-90 active:scale-[0.98] text-bg-dark font-semibold text-sm transition-all shadow-md shadow-accent-teal/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Item</span>
        </button>

        {/* Profile / Account Badge */}
        <div className="flex items-center gap-2 border-l border-border-dark/60 pl-4 h-8">
          <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center border border-border-dark">
            <User className="w-4 h-4 text-text-secondary" />
          </div>
          <div className="hidden lg:block text-left select-none">
            <p className="text-xs font-semibold text-text-primary max-w-[120px] truncate">
              {user?.email ? user.email.split('@')[0] : 'User'}
            </p>
            <p className="text-[10px] text-text-secondary">Owner</p>
          </div>
        </div>
      </div>
    </header>
  );
}
