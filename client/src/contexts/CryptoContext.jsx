import React, { createContext, useState, useRef, useContext, useEffect } from 'react';
import { deriveMasterKey, encryptWithKey, decryptWithKey, decryptLegacy, exportKeyToBase64, importKeyFromBase64 } from '../services/crypto';
import { useAuth } from './AuthContext';
import { isExtension, isNative } from '../utils/platform';
import { api } from '../services/api';
import { localDb } from '../services/android/localDb';

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
      const savedKeyBase64 = sessionStorage.getItem('vaultguard_session_master_key');
      if (savedKeyBase64 && isAuthenticated && user?.email) {
        try {
          const importedKey = await importKeyFromBase64(savedKeyBase64);
          masterKeyRef.current = importedKey;
          setIsUnlocked(true);
        } catch (err) {
          console.error('Failed to restore derived master key on load:', err);
          lock();
        }
      }
    };
    restoreSession();
  }, [isAuthenticated, user]);

  const unlock = async (password, isAlreadyVerified = false) => {
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
      // 1. Derive master key
      const derivedKey = await deriveMasterKey(password, user.email);

      // 2. Perform verification
      let isVerified = false;

      // Try local verification first if offline or we have cached ciphers (only on mobile)
      if (isNative) {
        try {
          const cachedProfile = await localDb.getUserProfile();
          const isSameUser = cachedProfile && cachedProfile.email && cachedProfile.email.toLowerCase() === user.email.toLowerCase();

          if (isSameUser) {
            const cachedEntries = await localDb.getAllEntries();
            const testEntry = cachedEntries.find(e => e.encryptedData && e.iv && e.salt);

            if (testEntry) {
              if (testEntry.salt === 'migrated' || testEntry.salt === 'none' || !testEntry.salt) {
                await decryptWithKey(testEntry.encryptedData, testEntry.iv, derivedKey);
              } else {
                await decryptLegacy(testEntry.encryptedData, testEntry.iv, testEntry.salt, password);
              }
              isVerified = true;
            }
          } else {
            // Different user logging in on mobile: clear previous user's old cache to prevent cross-contamination
            await localDb.clearAll();
            await localDb.clearUserProfile();
          }
        } catch (decryptErr) {
          // Decryption failed. Since testEntry exists, the password must be incorrect.
          console.error('Local verification failed. Wrong master password:', decryptErr);
          return false;
        }
      }

      // If not verified locally (e.g. no cached entries, or we are on web dashboard where IndexedDB cache doesn't exist), check with server
      if (!isVerified) {
        if (isAlreadyVerified) {
          isVerified = true;
        } else {
          try {
            const res = await api.post('/auth/login', { email: user.email, password });
            if (res && res.success) {
              isVerified = true;
            }
          } catch (serverErr) {
            // Server auth failed.
            console.error('Server verification failed:', serverErr);
            return false;
          }
        }
      }

      if (isVerified) {
        masterPasswordRef.current = password;
        masterKeyRef.current = derivedKey;
        setIsUnlocked(true);
        try {
          const keyBase64 = await exportKeyToBase64(derivedKey);
          sessionStorage.setItem('vaultguard_session_master_key', keyBase64);
        } catch (err) {
          console.error('Failed to save master key to sessionStorage:', err);
        }
        return true;
      }

      return false;
    } catch (err) {
      console.error('Failed to unlock vault:', err);
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
    sessionStorage.removeItem('vaultguard_session_master_key');
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
