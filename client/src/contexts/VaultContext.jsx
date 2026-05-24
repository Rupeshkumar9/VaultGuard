import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { useCrypto } from './CryptoContext';

const VaultContext = createContext(null);

export const VaultProvider = ({ children }) => {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { encryptData, decryptData, isUnlocked } = useCrypto();

  // Clear entries when vault is locked
  useEffect(() => {
    if (!isUnlocked) {
      setEntries([]);
    }
  }, [isUnlocked]);

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

  // Fetch and decrypt all entries
  const fetchEntries = useCallback(async () => {
    if (!isUnlocked) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/vault');
      if (response.success && response.data) {
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
  const addEntry = async (entryData) => {
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
        await fetchEntries(); // Force refresh list from database and decrypt
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

  // Delete an entry
  const deleteEntry = async (id) => {
    setIsLoading(true);
    try {
      const response = await api.delete(`/vault/${id}`);
      if (response.success) {
        setEntries(prev => prev.filter(entry => entry._id !== id));
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
