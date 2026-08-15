import React from 'react';
import VaultCard from './VaultCard';
import { Shield, Plus } from 'lucide-react';
import { isExtension } from '../../utils/platform';

export default function VaultList({ 
  filteredEntries, 
  isLoading, 
  searchQuery, 
  onSelectEntry, 
  onOpenAddEntry,
  selectedIds = [],
  onToggleSelectEntry,
  onClone
}) {
  
  if (isLoading && filteredEntries.length === 0) {
    if (isExtension) {
      return (
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[60px] rounded-xl bg-surface-dark/40 border border-border-dark/60 p-3 flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-surface-hover/80 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 bg-surface-hover/80 rounded w-1/3" />
                <div className="h-2.5 bg-surface-hover/80 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-44 rounded-2xl bg-surface-dark/40 border border-border-dark/60 p-5 space-y-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-hover/80 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-surface-hover/80 rounded w-2/3" />
                <div className="h-3 bg-surface-hover/80 rounded w-1/2" />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-2 bg-surface-hover/80 rounded w-1/4" />
              <div className="h-3 bg-surface-hover/80 rounded w-1/2" />
            </div>
            <div className="h-8 bg-surface-hover/80 rounded w-full pt-2" />
          </div>
        ))}
      </div>
    );
  }


  if (filteredEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-border-dark/60 bg-surface-dark/10 backdrop-blur-sm max-w-xl mx-auto mt-6">
        <div className="w-16 h-16 rounded-full bg-accent-glow border border-accent-teal/15 flex items-center justify-center mb-5">
          <Shield className="w-7 h-7 text-accent-teal" />
        </div>
        
        <h3 className="text-lg font-bold text-text-primary">
          {searchQuery ? 'No matching items' : 'Your Vault is Empty'}
        </h3>
        
        <p className="text-text-secondary text-sm max-w-sm mt-2">
          {searchQuery 
            ? 'We couldn\'t find any password credentials matching your search query. Try another keyword.'
            : 'Get started by creating your first secure client-side encrypted password credential.'
          }
        </p>

        {!searchQuery && (
          <div className="text-[10px] text-text-secondary/40 mt-4 font-semibold tracking-wide uppercase select-none">
            Protected by VaultGuard • Developed by Rupesh
          </div>
        )}

        {!searchQuery && (
          <button
            onClick={onOpenAddEntry}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent-teal to-cyan-500 hover:opacity-90 active:scale-[0.98] text-bg-dark font-semibold text-sm transition-all shadow-lg shadow-accent-teal/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add First Item
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={isExtension ? "flex flex-col gap-2.5" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"}>
      {filteredEntries.map((entry) => (
        <VaultCard 
          key={entry._id} 
          entry={entry} 
          onSelect={onSelectEntry} 
          isSelected={selectedIds.includes(entry._id)}
          onToggleSelect={onToggleSelectEntry}
          onClone={onClone}
        />
      ))}
    </div>
  );
}
