import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { useCrypto } from './CryptoContext';
import { localDb } from '../services/localDb';
import { vaultBridge } from '../services/vaultBridge';

const VaultContext = createContext(null);

export const VaultProvider = ({ children }) => {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { encryptData, decryptData, isUnlocked } = useCrypto();

  // Helper to decrypt a single raw entry from the API
  const decryptEntry = useCallback(async (entry) => {
    try {
      if (!entry.encryptedData || !entry.iv || !entry.salt) {
        return {
          ...entry,
          username: '',
          password: '',
          notes: entry.notes || '',
        };
      }
      
      const plaintext = await decryptData(entry.encryptedData, entry.iv, entry.salt);
      const sensitive = JSON.parse(plaintext);
      
      return {
        ...entry,
        username: sensitive.username || '',
        password: sensitive.password || '',
        notes: sensitive.notes || '',
      };
    } catch (err) {
      console.error(`Failed to decrypt entry ${entry._id || entry.title}:`, err);
      // Return with placeholder values instead of crashing
      return {
        ...entry,
        username: '[Decryption Error]',
        password: '[Decryption Error]',
        notes: '[Decryption Error]',
        decryptionError: true,
      };
    }
  }, [decryptData]);

  // Load and decrypt cached entries from IndexedDB immediately upon unlock
  useEffect(() => {
    const loadCachedEntries = async () => {
      if (isUnlocked) {
        try {
          const cachedCiphers = await localDb.getAllEntries();
          if (cachedCiphers && cachedCiphers.length > 0) {
            const decryptedCached = await Promise.all(
              cachedCiphers.map(entry => decryptEntry(entry))
            );
            setEntries(decryptedCached);
          }
        } catch (err) {
          console.error('Failed to load cached entries from IndexedDB:', err);
        }
      } else {
        setEntries([]);
      }
    };
    loadCachedEntries();
  }, [isUnlocked, decryptEntry]);

  // Automatically sync active entries to the Capacitor native bridge when entries update
  useEffect(() => {
    const syncAndVerify = async () => {
      if (isUnlocked) {
        if (entries.length > 0) {
          const activeEntries = entries.filter(e => !e.isInTrash);
          await vaultBridge.updateVault(activeEntries);
          // Verify the sync worked
          const diag = await vaultBridge.diagnose();
          console.log('[VaultSync] Diagnosis after sync:', diag);
        }
      } else {
        vaultBridge.clearVault();
      }
    };
    syncAndVerify();
  }, [entries, isUnlocked]);

  // Fetch and decrypt all entries
  const fetchEntries = useCallback(async () => {
    if (!isUnlocked) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/vault?trash=all');
      if (response.success && response.data) {
        // Save encrypted data to IndexedDB cache
        await localDb.saveEntries(response.data);

        const decryptedEntries = await Promise.all(
          response.data.map(entry => decryptEntry(entry))
        );
        setEntries(decryptedEntries);
      } else {
        throw new Error(response.message || 'Failed to fetch vault entries');
      }
    } catch (err) {
      console.error('Error fetching vault:', err);
      setError(err.message || 'Failed to load vault entries');
    } finally {
      setIsLoading(false);
    }
  }, [isUnlocked, decryptEntry]);

  // Add a new vault entry
  const addEntry = async (entryData, skipFetch = false) => {
    if (!isUnlocked) throw new Error('Vault is locked');
    setIsLoading(true);
    try {
      const { title, website, category, username, password, notes } = entryData;
      
      // Serialize and encrypt the sensitive payload client-side
      const sensitivePayload = JSON.stringify({ username, password, notes });
      const { encryptedData, iv, salt } = await encryptData(sensitivePayload);

      const response = await api.post('/vault', {
        title,
        website,
        category,
        encryptedData,
        iv,
        salt,
        notes: '', // Keep server notes field blank for privacy
      });

      if (response.success && response.data) {
        if (!skipFetch) {
          await fetchEntries(); // Force refresh list from database and decrypt
        }
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to create vault entry');
      }
    } catch (err) {
      console.error('Error adding entry:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Update an existing vault entry
  const updateEntry = async (id, entryData) => {
    if (!isUnlocked) throw new Error('Vault is locked');
    setIsLoading(true);
    try {
      const { title, website, category, username, password, notes, isFavorite } = entryData;
      
      // Serialize and encrypt the sensitive payload
      const sensitivePayload = JSON.stringify({ username, password, notes });
      const { encryptedData, iv, salt } = await encryptData(sensitivePayload);

      const response = await api.put(`/vault/${id}`, {
        title,
        website,
        category,
        encryptedData,
        iv,
        salt,
        notes: '', // Keep server notes field blank
        isFavorite,
      });

      if (response.success && response.data) {
        await fetchEntries(); // Force refresh list from database and decrypt
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to update vault entry');
      }
    } catch (err) {
      console.error('Error updating entry:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle favorite status
  const toggleFavorite = async (id) => {
    try {
      const response = await api.patch(`/vault/${id}/favorite`);
      if (response.success && response.data) {
        setEntries(prev =>
          prev.map(entry =>
            entry._id === id ? { ...entry, isFavorite: response.data.isFavorite } : entry
          )
        );
      } else {
        throw new Error(response.message || 'Failed to toggle favorite');
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      throw err;
    }
  };

  // Record that an entry was used (e.g. copied a password)
  const updateLastUsed = async (id) => {
    try {
      const response = await api.patch(`/vault/${id}/last-used`);
      if (response.success && response.data) {
        setEntries(prev =>
          prev.map(entry =>
            entry._id === id ? { ...entry, lastUsed: response.data.lastUsed } : entry
          )
        );
      }
    } catch (err) {
      console.error('Error updating last used time:', err);
    }
  };

  // Delete an entry (soft delete to Trash)
  const deleteEntry = async (id) => {
    setIsLoading(true);
    try {
      const response = await api.delete(`/vault/${id}`);
      if (response.success) {
        setEntries(prev =>
          prev.map(entry =>
            entry._id === id ? { ...entry, isInTrash: true, isFavorite: false } : entry
          )
        );
      } else {
        throw new Error(response.message || 'Failed to delete vault entry');
      }
    } catch (err) {
      console.error('Error deleting entry:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete multiple entries (soft delete to Trash)
  const deleteEntries = async (ids) => {
    setIsLoading(true);
    try {
      const response = await api.post('/vault/delete-bulk', { ids });
      if (response.success) {
        setEntries(prev =>
          prev.map(entry =>
            ids.includes(entry._id) ? { ...entry, isInTrash: true, isFavorite: false } : entry
          )
        );
      } else {
        throw new Error(response.message || 'Failed to delete vault entries');
      }
    } catch (err) {
      console.error('Error bulk deleting entries:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Update multiple entries (bulk update metadata)
  const updateEntries = async (ids, updates) => {
    setIsLoading(true);
    try {
      const response = await api.post('/vault/update-bulk', { ids, updates });
      if (response.success) {
        setEntries(prev =>
          prev.map(entry =>
            ids.includes(entry._id) ? { ...entry, ...updates } : entry
          )
        );
      } else {
        throw new Error(response.message || 'Failed to update vault entries');
      }
    } catch (err) {
      console.error('Error bulk updating entries:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete an entry permanently
  const deleteEntryPermanent = async (id) => {
    setIsLoading(true);
    try {
      const response = await api.delete(`/vault/${id}/permanent`);
      if (response.success) {
        setEntries(prev => prev.filter(entry => entry._id !== id));
      } else {
        throw new Error(response.message || 'Failed to permanently delete entry');
      }
    } catch (err) {
      console.error('Error permanently deleting entry:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete multiple entries permanently (bulk hard delete)
  const deleteEntriesPermanent = async (ids) => {
    setIsLoading(true);
    try {
      const response = await api.post('/vault/delete-bulk-permanent', { ids });
      if (response.success) {
        setEntries(prev => prev.filter(entry => !ids.includes(entry._id)));
      } else {
        throw new Error(response.message || 'Failed to permanently delete entries');
      }
    } catch (err) {
      console.error('Error permanently deleting entries:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Restore an entry from Trash
  const restoreEntry = async (id) => {
    setIsLoading(true);
    try {
      const response = await api.post(`/vault/${id}/restore`);
      if (response.success) {
        setEntries(prev =>
          prev.map(entry =>
            entry._id === id ? { ...entry, isInTrash: false } : entry
          )
        );
      } else {
        throw new Error(response.message || 'Failed to restore vault entry');
      }
    } catch (err) {
      console.error('Error restoring entry:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Restore multiple entries from Trash (bulk restore)
  const restoreEntries = async (ids) => {
    setIsLoading(true);
    try {
      const response = await api.post('/vault/restore-bulk', { ids });
      if (response.success) {
        setEntries(prev =>
          prev.map(entry =>
            ids.includes(entry._id) ? { ...entry, isInTrash: false } : entry
          )
        );
      } else {
        throw new Error(response.message || 'Failed to restore vault entries');
      }
    } catch (err) {
      console.error('Error restoring entries:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Clear in-memory entries on lock
  const clearEntries = useCallback(() => {
    setEntries([]);
  }, []);

  return (
    <VaultContext.Provider
      value={{
        entries,
        isLoading,
        error,
        fetchEntries,
        addEntry,
        updateEntry,
        toggleFavorite,
        updateLastUsed,
        deleteEntry,
        deleteEntries,
        updateEntries,
        deleteEntryPermanent,
        deleteEntriesPermanent,
        restoreEntry,
        restoreEntries,
        clearEntries,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};
