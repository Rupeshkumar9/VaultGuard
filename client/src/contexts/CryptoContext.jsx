import React, { createContext, useState, useRef, useContext, useEffect } from 'react';
import { deriveMasterKey, encryptWithKey, decryptWithKey, decryptLegacy } from '../services/crypto';
import { useAuth } from './AuthContext';
import { isExtension } from '../utils/platform';

const CryptoContext = createContext(null);

export const CryptoProvider = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const masterPasswordRef = useRef('');
  const masterKeyRef = useRef(null);
  const { isAuthenticated, user, login, logout } = useAuth();

  // If running in extension, sync unlock state with auth state
  useEffect(() => {
    if (isExtension) {
      setIsUnlocked(isAuthenticated);
    }
  }, [isAuthenticated]);

  // If user logs out, lock the vault automatically (web/mobile only)
  useEffect(() => {
    if (!isExtension && !isAuthenticated) {
      lock();
    }
  }, [isAuthenticated]);

  // Restore unlock state from sessionStorage on page refresh (web/mobile only)
  useEffect(() => {
    if (isExtension) return;
    const restoreSession = async () => {
      const savedPassword = sessionStorage.getItem('vaultguard_session_master_password');
      if (savedPassword && isAuthenticated && user?.email) {
        try {
          masterPasswordRef.current = savedPassword;
          masterKeyRef.current = await deriveMasterKey(savedPassword, user.email);
          setIsUnlocked(true);
        } catch (err) {
          console.error('Failed to restore derived master key on load:', err);
          lock();
        }
      }
    };
    restoreSession();
  }, [isAuthenticated, user]);

  const unlock = async (password) => {
    if (isExtension) {
      // In extension popup, unlocking is done by logging in (which calls UNLOCK_VAULT in background)
      return await login(user?.email || '', password);
    }

    if (!password) return false;
    if (!user?.email) {
      console.warn('Unlock requested but user email is not available.');
      return false;
    }
    try {
      masterPasswordRef.current = password;
      masterKeyRef.current = await deriveMasterKey(password, user.email);
      setIsUnlocked(true);
      sessionStorage.setItem('vaultguard_session_master_password', password);
      return true;
    } catch (err) {
      console.error('Failed to derive master key on unlock:', err);
      return false;
    }
  };

  const lock = async () => {
    if (isExtension) {
      await logout();
      return;
    }
    masterPasswordRef.current = '';
    masterKeyRef.current = null;
    setIsUnlocked(false);
    sessionStorage.removeItem('vaultguard_session_master_password');
  };

  const getMasterPassword = () => {
    if (isExtension) {
      return '';
    }
    if (!isUnlocked || !masterPasswordRef.current) {
      throw new Error('Vault is locked. Please unlock first.');
    }
    return masterPasswordRef.current;
  };

  /**
   * Helper to encrypt plaintext using the pre-derived master key.
   * @param {string} plaintext - Data to encrypt
   */
  const encryptData = async (plaintext) => {
    if (isExtension) {
      // In extension, encryption is delegated to the background worker
      return {
        encryptedData: plaintext,
        iv: '',
        salt: 'migrated',
      };
    }
    if (!isUnlocked || !masterKeyRef.current) {
      throw new Error('Vault is locked. Please unlock first.');
    }
    const result = await encryptWithKey(plaintext, masterKeyRef.current);
    return {
      ...result,
      salt: 'migrated', // Sentinel value to satisfy required validation on backend
    };
  };

  /**
   * Helper to decrypt ciphertext using either the pre-derived key or legacy fallback.
   * @param {string} encryptedData - Base64 ciphertext
   * @param {string} iv - Base64 IV
   * @param {string} salt - Base64 salt (or 'migrated' sentinel)
   */
  const decryptData = async (encryptedData, iv, salt) => {
    if (isExtension) {
      // In extension, data from background is already decrypted
      return encryptedData;
    }
    if (!isUnlocked) {
      throw new Error('Vault is locked. Please unlock first.');
    }
    if (salt === 'migrated' || salt === 'none' || !salt) {
      if (!masterKeyRef.current) {
        throw new Error('Vault is unlocked but master key is missing from memory.');
      }
      return decryptWithKey(encryptedData, iv, masterKeyRef.current);
    } else {
      const password = getMasterPassword();
      return decryptLegacy(encryptedData, iv, salt, password);
    }
  };

  return (
    <CryptoContext.Provider value={{ 
      isUnlocked, 
      unlock, 
      lock, 
      getMasterPassword,
      encryptData,
      decryptData
    }}>
      {children}
    </CryptoContext.Provider>
  );
};

export const useCrypto = () => {
  const context = useContext(CryptoContext);
  if (!context) {
    throw new Error('useCrypto must be used within a CryptoProvider');
  }
  return context;
};
