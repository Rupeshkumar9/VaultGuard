import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, X, ArrowUpDown, Calendar, Folder, Edit3 } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import VaultList from '../components/vault/VaultList';
import VaultDetail from '../components/vault/VaultDetail';
import EntryForm from '../components/vault/EntryForm';
import BulkEntryForm from '../components/vault/BulkEntryForm';
import PasswordGenerator from '../components/generator/PasswordGenerator';
import SettingsPage from './SettingsPage';
import { useVault } from '../contexts/VaultContext';
import { useAutoLock } from '../hooks/useAutoLock';

export default function VaultPage() {
  const { entries, isLoading, fetchEntries, deleteEntry, deleteEntries } = useVault();
  
  // Activate auto-lock functionality
  useAutoLock();
  
  // View states
  const [currentView, setCurrentView] = useState('vault'); // 'vault' | 'generator' | 'settings'
  const [activeCategory, setActiveCategory] = useState('All');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk actions & advanced filtering states
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortBy, setSortBy] = useState('updatedAt'); // 'updatedAt' | 'createdAt' | 'lastUsed' | 'title'
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | '30days' | '90days' | 'older6months' | 'neverUsed'

  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);

  // Mobile navigation
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modal / Detail states
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // Fetch entries on mount
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Reset selection when filters change to avoid accidental off-screen actions
  useEffect(() => {
    setSelectedIds([]);
    setIsConfirmingDelete(false);
  }, [activeCategory, showFavoritesOnly, searchQuery, dateFilter]);

  // Filter entries based on search, category, favorite, date, and site status
  const filteredEntries = entries.filter((entry) => {
    // 1. Favorite filter
    if (showFavoritesOnly && !entry.isFavorite) {
      return false;
    }

    // 2. Category filter
    if (activeCategory !== 'All' && entry.category !== activeCategory) {
      return false;
    }

    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = entry.title?.toLowerCase().includes(q);
      const websiteMatch = entry.website?.toLowerCase().includes(q);
      const usernameMatch = entry.username?.toLowerCase().includes(q);
      const notesMatch = entry.notes?.toLowerCase().includes(q);
      const categoryMatch = entry.category?.toLowerCase().includes(q);
      if (!(titleMatch || websiteMatch || usernameMatch || notesMatch || categoryMatch)) {
        return false;
      }
    }

    // 4. Date filter
    if (dateFilter !== 'all') {
      const createdDate = new Date(entry.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now - createdDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (dateFilter === '30days' && diffDays > 30) {
        return false;
      } else if (dateFilter === '90days' && diffDays > 90) {
        return false;
      } else if (dateFilter === 'older6months' && diffDays <= 180) {
        return false;
      } else if (dateFilter === 'neverUsed' && entry.lastUsed) {
        return false;
      }
    }

    return true;
  });

  // Sort entries based on sortBy setting
  const sortedAndFilteredEntries = [...filteredEntries].sort((a, b) => {
    if (sortBy === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    }
    if (sortBy === 'createdAt') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (sortBy === 'lastUsed') {
      const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      return bTime - aTime;
    }
    // Default or 'updatedAt'
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const handleSelectEntry = (entry) => {
    setSelectedEntry(entry);
  };

  const handleCloseDetail = () => {
    setSelectedEntry(null);
  };

  const handleEditEntry = (entry) => {
    setSelectedEntry(null);
    setEditingEntry(entry);
  };

  const handleCloseEditForm = () => {
    setEditingEntry(null);
  };

  const handleOpenAddForm = () => {
    setIsAddingEntry(true);
  };

  const handleCloseAddForm = () => {
    setIsAddingEntry(false);
  };

  const handleDeleteEntry = async (id) => {
    try {
      await deleteEntry(id);
      setSelectedEntry(null);
    } catch (err) {
      alert('Failed to delete entry');
    }
  };

  const handleToggleSelectEntry = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id) 
        : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const allFilteredIds = sortedAndFilteredEntries.map(e => e._id);
    const areAllSelected = allFilteredIds.every(id => selectedIds.includes(id));
    
    if (areAllSelected) {
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const union = new Set([...prev, ...allFilteredIds]);
        return Array.from(union);
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    setIsBulkDeleting(true);
    try {
      await deleteEntries(selectedIds);
      setSelectedIds([]);
      setIsConfirmingDelete(false);
    } catch (err) {
      alert('Failed to delete selected entries');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSidebarViewChange = (view) => {
    setCurrentView(view);
    setIsMobileSidebarOpen(false);
  };

  const handleLogoClick = () => {
    setActiveCategory('All');
    setShowFavoritesOnly(false);
    setSearchQuery('');
    setCurrentView('vault');
  };

  return (
    <div className="flex h-screen bg-bg-dark text-text-primary overflow-hidden">
      
      {/* 1. Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar 
          activeCategory={activeCategory}
          setActiveCategory={(cat) => {
            setActiveCategory(cat);
            setCurrentView('vault');
          }}
          showFavoritesOnly={showFavoritesOnly}
          setShowFavoritesOnly={(fav) => {
            setShowFavoritesOnly(fav);
            setCurrentView('vault');
          }}
          onOpenAddEntry={handleOpenAddForm}
          onOpenGenerator={() => handleSidebarViewChange('generator')}
          onOpenSettings={() => handleSidebarViewChange('settings')}
          onLogoClick={handleLogoClick}
        />
      </div>

      {/* 2. Mobile Sidebar Overlay & Drawer */}
      {isMobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Overlay backdrop */}
          <div 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-bg-dark/80 backdrop-blur-xs transition-opacity" 
          />
          {/* Drawer menu */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-surface-dark border-r border-border-dark animate-slideInLeft">
            <Sidebar 
              activeCategory={activeCategory}
              setActiveCategory={(cat) => {
                setActiveCategory(cat);
                setCurrentView('vault');
                setIsMobileSidebarOpen(false);
              }}
              showFavoritesOnly={showFavoritesOnly}
              setShowFavoritesOnly={(fav) => {
                setShowFavoritesOnly(fav);
                setCurrentView('vault');
                setIsMobileSidebarOpen(false);
              }}
              onOpenAddEntry={() => {
                handleOpenAddForm();
                setIsMobileSidebarOpen(false);
              }}
              onOpenGenerator={() => handleSidebarViewChange('generator')}
              onOpenSettings={() => handleSidebarViewChange('settings')}
              onLogoClick={handleLogoClick}
            />
          </div>
        </div>
      )}

      {/* 3. Main content area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <Header 
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            if (currentView !== 'vault') setCurrentView('vault');
          }}
          onOpenAddEntry={handleOpenAddForm}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Content body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin">
          {currentView === 'vault' && (
            <div className="space-y-6">
              {/* Category Title bar & Select All */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-dark/30">
                <div className="text-left">
                  <h2 className="text-xl font-extrabold text-text-primary tracking-tight">
                    {showFavoritesOnly ? 'Favorites' : `${activeCategory} Credentials`}
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {showFavoritesOnly 
                      ? 'Your starred items, synced and stored with client-side zero-knowledge encryption.'
                      : `Manage your secure credentials stored under ${activeCategory.toLowerCase()} category.`
                    }
                  </p>
                </div>
                
                {sortedAndFilteredEntries.length > 0 && (
                  <button
                    onClick={handleToggleSelectAll}
                    className="px-3.5 py-2 rounded-lg border border-border-dark bg-surface-dark/60 hover:bg-surface-hover hover:border-accent-teal/30 text-xs font-semibold text-text-primary transition-all flex items-center gap-2 cursor-pointer self-start sm:self-center"
                  >
                    <input
                      type="checkbox"
                      checked={sortedAndFilteredEntries.length > 0 && sortedAndFilteredEntries.every(e => selectedIds.includes(e._id))}
                      onChange={() => {}} // Click handled by button
                      className="w-3.5 h-3.5 rounded border-border-dark text-accent-teal focus:ring-accent-teal bg-bg-dark cursor-pointer pointer-events-none"
                    />
                    <span>
                      {sortedAndFilteredEntries.every(e => selectedIds.includes(e._id)) ? 'Deselect All' : 'Select All'}
                    </span>
                  </button>
                )}
              </div>

              {/* Sort & Filter Toolbar */}
              <div className="flex flex-wrap items-center gap-4 p-3.5 rounded-2xl bg-surface-dark/40 border border-border-dark/60 backdrop-blur-xs select-none">
                {/* Sort dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-text-secondary/70 flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3 text-accent-teal" /> Sort By
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-bg-dark border border-border-dark text-text-primary focus:outline-none focus:border-accent-teal cursor-pointer"
                  >
                    <option value="updatedAt">Recently Updated</option>
                    <option value="createdAt">Recently Created</option>
                    <option value="lastUsed">Recently Used</option>
                    <option value="title">Alphabetical (A-Z)</option>
                  </select>
                </div>

                {/* Divider on larger screens */}
                <div className="hidden sm:block h-4 w-px bg-border-dark/60 mx-1" />

                {/* Date filter dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-text-secondary/70 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-accent-teal" /> Date Filter
                  </span>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-bg-dark border border-border-dark text-text-primary focus:outline-none focus:border-accent-teal cursor-pointer"
                  >
                    <option value="all">All Dates</option>
                    <option value="30days">Created: Last 30 Days</option>
                    <option value="90days">Created: Last 90 Days</option>
                    <option value="older6months">Created: &gt; 6 Months Ago</option>
                    <option value="neverUsed">Never Used</option>
                  </select>
                </div>

                {/* Divider on larger screens */}
                <div className="hidden md:block h-4 w-px bg-border-dark/60 mx-1" />

                {/* Category filter dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-text-secondary/70 flex items-center gap-1">
                    <Folder className="w-3.5 h-3.5 text-accent-teal" /> Category Filter
                  </span>
                  <select
                    value={showFavoritesOnly ? 'Favorites' : activeCategory}
                    onChange={(e) => {
                      if (e.target.value === 'Favorites') {
                        setShowFavoritesOnly(true);
                        setActiveCategory('All');
                      } else {
                        setShowFavoritesOnly(false);
                        setActiveCategory(e.target.value);
                      }
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-bg-dark border border-border-dark text-text-primary focus:outline-none focus:border-accent-teal cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    <option value="Favorites">Favorites</option>
                    <option value="General">General</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Email">Email</option>
                    <option value="Banking">Banking</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Work">Work</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Development">Development</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Grid / List of entries */}
              <VaultList 
                filteredEntries={sortedAndFilteredEntries}
                isLoading={isLoading}
                searchQuery={searchQuery}
                onSelectEntry={handleSelectEntry}
                onOpenAddEntry={handleOpenAddForm}
                selectedIds={selectedIds}
                onToggleSelectEntry={handleToggleSelectEntry}
              />
            </div>
          )}

          {currentView === 'generator' && <PasswordGenerator />}
          {currentView === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Floating Bulk Action Bar */}
      <div 
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-4 md:gap-6 px-6 py-4 rounded-2xl border border-border-dark/80 bg-surface-dark/95 backdrop-blur-md shadow-2xl w-[95%] max-w-lg transition-all duration-300 ${
          selectedIds.length > 0 
            ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto border-accent-teal/20' 
            : 'translate-y-10 opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-lg bg-accent-glow flex items-center justify-center shrink-0 border border-accent-teal/10">
            <span className="text-xs font-bold text-accent-teal">{selectedIds.length}</span>
          </div>
          <div>
            <p className="text-xs font-bold text-text-primary">Items Selected</p>
            <p className="text-[10px] text-text-secondary">Bulk action will apply to all selected items.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSelectedIds([])}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => setIsBulkEditing(true)}
            className="px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-border-dark bg-surface-dark hover:bg-surface-hover hover:border-accent-teal/30 text-text-primary"
          >
            <Edit3 className="w-3.5 h-3.5 text-accent-teal" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={isBulkDeleting}
            onMouseLeave={() => setIsConfirmingDelete(false)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              isConfirmingDelete 
                ? 'bg-rose-600 border-rose-700 text-white hover:bg-rose-700 font-semibold' 
                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20 hover:border-rose-500/35'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {isBulkDeleting 
                ? 'Deleting...' 
                : isConfirmingDelete 
                  ? 'Confirm Delete?' 
                  : 'Delete Selected'
              }
            </span>
          </button>
        </div>
      </div>

      {/* 4. Modals */}
      {selectedEntry && (
        <VaultDetail 
          entry={selectedEntry}
          onClose={handleCloseDetail}
          onEdit={handleEditEntry}
          onDelete={handleDeleteEntry}
        />
      )}

      {isAddingEntry && (
        <EntryForm 
          onClose={handleCloseAddForm}
        />
      )}

      {editingEntry && (
        <EntryForm 
          entry={editingEntry}
          onClose={handleCloseEditForm}
        />
      )}

      {isBulkEditing && (
        <BulkEntryForm
          selectedIds={selectedIds}
          onClose={() => setIsBulkEditing(false)}
          onClearSelection={() => setSelectedIds([])}
        />
      )}
    </div>
  );
}
