import React, { createContext, useState, useRef, useContext, useEffect } from 'react';
import {
  deriveMasterKey,
  encryptWithKey,
  decryptWithKey,
  exportKeyToBase64,
  importKeyFromBase64,
} from '../services/crypto';
import { useAuth } from './AuthContext';
import { isExtension, isNative } from '../utils/platform';
import { localDb } from '../services/android/localDb';
import { loginWithOpaque } from '../services/opaqueAuth';

const CryptoContext = createContext(null);
const SESSION_MASTER_KEY = 'vaultguard_session_master_key';

export const CryptoProvider = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlockStateLoading, setIsUnlockStateLoading] = useState(isExtension);
  const masterPasswordRef = useRef('');
  const masterKeyRef = useRef(null);
  const { isAuthenticated, user, login, logout, lock: authLock } = useAuth();

  // If running in extension, sync unlock state with GET_STATUS and listen to background events
  useEffect(() => {
    if (!isExtension) return;
    
    let isMounted = true;
    setIsUnlockStateLoading(true);
    const checkUnlockState = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
        if (isMounted && response) {
          setIsUnlocked(response.isUnlocked);
        }
      } catch (err) {
        console.error('Failed to query unlock state:', err);
      } finally {
        if (isMounted) setIsUnlockStateLoading(false);
      }
    };
    
    checkUnlockState();
    
    const messageListener = (message) => {
      if (message.action === 'VAULT_LOCKED') {
        console.log('🔒 Vault locked message received from background. Lock UI.');
        setIsUnlocked(false);
      } else if (message.action === 'VAULT_SYNCED' || message.action === 'VAULT_RESTORED') {
        console.log('🔓 Vault synced message received from background. Unlock UI.');
        setIsUnlocked(true);
        setIsUnlockStateLoading(false);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    
    return () => {
      isMounted = false;
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [isAuthenticated]);

  // Restore a tab-scoped vault key after a page refresh. The raw master
  // password is never stored. sessionStorage is cleared when the tab closes
  // and is explicitly cleared whenever the vault is locked.
  useEffect(() => {
    if (isExtension || isNative || !isAuthenticated || !user?.email || isUnlocked) return;
    let cancelled = false;

    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_MASTER_KEY) || 'null');
      if (!saved || saved.email !== user.email || !saved.key) return undefined;

      importKeyFromBase64(saved.key).then((sessionKey) => {
        if (cancelled || !user?.email || user.email !== saved.email) return;
        masterKeyRef.current = sessionKey;
        setIsUnlocked(true);
      }).catch((error) => {
        console.warn('Failed to restore the tab-scoped vault key:', error);
        sessionStorage.removeItem(SESSION_MASTER_KEY);
      });
    } catch (error) {
      console.warn('Failed to read the tab-scoped vault key:', error);
      sessionStorage.removeItem(SESSION_MASTER_KEY);
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isUnlocked, user?.email]);

  const saveTabScopedKey = async (password, email) => {
    if (isExtension || isNative || !password || !email) return;
    try {
      // Keep the working key non-exportable. Derive a separate exportable key
      // only for this tab's session persistence.
      const sessionKey = await deriveMasterKey(password, email, { extractable: true });
      const key = await exportKeyToBase64(sessionKey);
      sessionStorage.setItem(SESSION_MASTER_KEY, JSON.stringify({ email, key }));
    } catch (error) {
      console.warn('Failed to save the tab-scoped vault key:', error);
    }
  };

  // If user logs out, lock the vault automatically (web/mobile only)
  useEffect(() => {
    if (!isExtension && !isAuthenticated) {
      lock();
    }
  }, [isAuthenticated]);

  const unlock = async (password, emailOverride = '') => {
    if (isExtension) {
      // In extension popup, unlocking is done by logging in (which calls UNLOCK_VAULT in background)
      let emailVal = user?.email;
      if (!emailVal) {
        try {
          const cached = localStorage.getItem('vaultguard_cached_user');
          if (cached) {
            const parsed = JSON.parse(cached);
            emailVal = parsed?.email;
          }
        } catch (e) {
          console.warn('Failed to parse cached user for unlock:', e);
        }
      }
      const res = await login(emailVal || '', password);
      if (res && res.success) {
        setIsUnlocked(true);
        return true;
      }
      return false;
    }

    if (!password) return false;
    const unlockEmail = emailOverride || user?.email || '';
    if (!unlockEmail) {
      console.warn('Unlock requested but user email is not available.');
      return false;
    }
    try {
      // 1. Derive master key
      const derivedKey = await deriveMasterKey(password, unlockEmail);

      // 2. Perform verification
      let isVerified = false;

      // Try local verification first if offline or we have cached ciphers (only on mobile)
      if (isNative) {
        try {
          const cachedProfile = await localDb.getUserProfile();
            const isSameUser = cachedProfile && cachedProfile.email && cachedProfile.email.toLowerCase() === unlockEmail.toLowerCase();

          if (isSameUser) {
            const cachedEntries = await localDb.getAllEntries();
            const testEntry = cachedEntries.find(e => e.encryptedData && e.iv && e.salt);

            if (testEntry) {
              await decryptWithKey(testEntry.encryptedData, testEntry.iv, derivedKey);
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
        try {
          const res = await loginWithOpaque(unlockEmail, password);
          if (res && res.success) isVerified = true;
        } catch (serverErr) {
          console.error('OPAQUE verification failed:', serverErr);
          return false;
        }
      }

      if (isVerified) {
        masterPasswordRef.current = password;
        masterKeyRef.current = derivedKey;
        await saveTabScopedKey(password, unlockEmail);
        setIsUnlocked(true);
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
      if (authLock) {
        await authLock();
      } else {
        await logout();
      }
      return;
    }
    masterPasswordRef.current = '';
    masterKeyRef.current = null;
    if (!isExtension && !isNative) sessionStorage.removeItem(SESSION_MASTER_KEY);
    setIsUnlocked(false);
  };

  const verifyCurrentPassword = async (currentPassword) => {
    if (masterPasswordRef.current) {
      if (currentPassword !== masterPasswordRef.current) {
        throw new Error('Current password does not match the unlocked vault.');
      }
      return;
    }

    const saved = JSON.parse(sessionStorage.getItem(SESSION_MASTER_KEY) || 'null');
    if (!saved?.key || saved.email !== user?.email) {
      throw new Error('Enter your current master password to continue.');
    }
    const candidate = await deriveMasterKey(currentPassword, user.email, { extractable: true });
    const candidateKey = await exportKeyToBase64(candidate);
    if (candidateKey !== saved.key) {
      throw new Error('Current password does not match the unlocked vault.');
    }
  };

  const prepareEmailRekey = async (newEmail, entries, currentPassword) => {
    if (isExtension) {
      throw new Error('Email rekeying is handled by the extension background service.');
    }

    await verifyCurrentPassword(currentPassword);

    const nextKey = await deriveMasterKey(currentPassword, newEmail);
    const encryptedEntries = await Promise.all(entries.map(async (entry) => {
      if (entry.decryptionError) {
        throw new Error(`Cannot re-encrypt "${entry.title}" because it could not be decrypted.`);
      }

      const sensitivePayload = JSON.stringify({
        username: entry.username || '',
        password: entry.password || '',
        notes: entry.notes || '',
      });
      const encrypted = await encryptWithKey(sensitivePayload, nextKey);
      return {
        id: entry._id,
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        salt: 'migrated',
      };
    }));

    return { key: nextKey, entries: encryptedEntries };
  };

  const commitEmailRekey = async (nextKey, nextEmail = user?.email) => {
    masterKeyRef.current = nextKey;
    if (nextEmail) {
      const password = masterPasswordRef.current;
      if (password) await saveTabScopedKey(password, nextEmail);
    }
    return true;
  };

  const preparePasswordRekey = async (newPassword, entries, currentPassword) => {
    if (isExtension) {
      throw new Error('Password rekeying is handled by the extension background service.');
    }

    await verifyCurrentPassword(currentPassword);

    const nextKey = await deriveMasterKey(newPassword, user.email);
    const encryptedEntries = await Promise.all(entries.map(async (entry) => {
      if (entry.decryptionError) {
        throw new Error(`Cannot re-encrypt "${entry.title}" because it could not be decrypted.`);
      }

      const sensitivePayload = JSON.stringify({
        username: entry.username || '',
        password: entry.password || '',
        notes: entry.notes || '',
      });
      const encrypted = await encryptWithKey(sensitivePayload, nextKey);
      return {
        id: entry._id,
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        salt: 'migrated',
      };
    }));

    return { key: nextKey, entries: encryptedEntries };
  };

  const commitPasswordRekey = async (nextKey, nextPassword) => {
    masterPasswordRef.current = nextPassword;
    masterKeyRef.current = nextKey;
    await saveTabScopedKey(nextPassword, user?.email);
    return true;
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

  /** Decrypt ciphertext using the current single-key vault format. */
  const decryptData = async (encryptedData, iv) => {
    if (isExtension) {
      // In extension, data from background is already decrypted
      return encryptedData;
    }
    if (!isUnlocked) {
      throw new Error('Vault is locked. Please unlock first.');
    }
    if (!masterKeyRef.current) {
      throw new Error('Vault is unlocked but master key is missing from memory.');
    }
    return decryptWithKey(encryptedData, iv, masterKeyRef.current);
  };

  return (
    <CryptoContext.Provider value={{ 
      isUnlocked, 
      isUnlockStateLoading,
      unlock, 
      lock, 
      prepareEmailRekey,
      commitEmailRekey,
      preparePasswordRekey,
      commitPasswordRekey,
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
