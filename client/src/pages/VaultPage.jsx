import React, { useState, useEffect } from 'react';
import { Shield, Plus } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import VaultList from '../components/vault/VaultList';
import VaultDetail from '../components/vault/VaultDetail';
import EntryForm from '../components/vault/EntryForm';
import PasswordGenerator from '../components/generator/PasswordGenerator';
import SettingsPage from './SettingsPage';
import { useVault } from '../contexts/VaultContext';
import { useAutoLock } from '../hooks/useAutoLock';

export default function VaultPage() {
  const { entries, isLoading, fetchEntries, deleteEntry } = useVault();
  
  // Activate auto-lock functionality
  useAutoLock();
  
  // View states
  const [currentView, setCurrentView] = useState('vault'); // 'vault' | 'generator' | 'settings'
  const [activeCategory, setActiveCategory] = useState('All');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleSidebarViewChange = (view) => {
    setCurrentView(view);
    setIsMobileSidebarOpen(false);
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
              {/* Category Title bar */}
              <div className="flex justify-between items-center text-left">
                <div>
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
              </div>

              {/* Grid / List of entries */}
              <VaultList 
                entries={entries}
                isLoading={isLoading}
                searchQuery={searchQuery}
                activeCategory={activeCategory}
                showFavoritesOnly={showFavoritesOnly}
                onSelectEntry={handleSelectEntry}
                onOpenAddEntry={handleOpenAddForm}
              />
            </div>
          )}

          {currentView === 'generator' && <PasswordGenerator />}
          {currentView === 'settings' && <SettingsPage />}
        </main>
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
    </div>
  );
}
