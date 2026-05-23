import React, { createContext, useState, useRef, useContext, useEffect } from 'react';
import { encrypt, decrypt } from '../services/crypto';
import { useAuth } from './AuthContext';

const CryptoContext = createContext(null);

export const CryptoProvider = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const masterPasswordRef = useRef('');
  const { isAuthenticated } = useAuth();

  // If user logs out, lock the vault automatically
  useEffect(() => {
    if (!isAuthenticated) {
      lock();
    }
  }, [isAuthenticated]);

  const unlock = (password) => {
    if (!password) return false;
    masterPasswordRef.current = password;
    setIsUnlocked(true);
    return true;
  };

  const lock = () => {
    masterPasswordRef.current = '';
    setIsUnlocked(false);
  };

  const getMasterPassword = () => {
    if (!isUnlocked || !masterPasswordRef.current) {
      throw new Error('Vault is locked. Please unlock first.');
    }
    return masterPasswordRef.current;
  };

  /**
   * Helper to encrypt plaintext using the stored master password.
   * @param {string} plaintext - Data to encrypt
   */
  const encryptData = async (plaintext) => {
    const password = getMasterPassword();
    return encrypt(plaintext, password);
  };

  /**
   * Helper to decrypt ciphertext using the stored master password.
   * @param {string} encryptedData - Base64 ciphertext
   * @param {string} iv - Base64 IV
   * @param {string} salt - Base64 salt
   */
  const decryptData = async (encryptedData, iv, salt) => {
    const password = getMasterPassword();
    return decrypt(encryptedData, iv, salt, password);
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
