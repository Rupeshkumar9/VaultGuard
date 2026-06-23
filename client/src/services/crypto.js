/**
 * Cryptographic services for VaultGuard.
 * Uses browser-native Web Crypto API to ensure high security and speed.
 * 
 * Flow:
 * 1. Master password + Salt derived via PBKDF2 with 600,000 iterations (HMAC-SHA256)
 * 2. Generates a 256-bit AES-GCM key
 * 3. AES-GCM (256-bit) encryption using a unique 12-byte IV for every entry
 */

// Helper: Convert string to Uint8Array buffer
const stringToBuffer = (str) => new TextEncoder().encode(str);

// Helper: Convert Uint8Array buffer to string
const bufferToString = (buf) => new TextDecoder().decode(buf);

// Helper: Convert ArrayBuffer to Base64 string
const bufferToBase64 = (buf) => {
  const binString = Array.from(new Uint8Array(buf))
    .map((byte) => String.fromCharCode(byte))
    .join('');
  return btoa(binString);
};

// Helper: Convert Base64 string to Uint8Array buffer
const base64ToBuffer = (base64) => {
  const binString = atob(base64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Derives an AES-GCM key from a master password and salt using PBKDF2.
 * @param {string} password - The user's master password
 * @param {ArrayBuffer} salt - 16-byte random salt
 * @returns {Promise<CryptoKey>} - Derived CryptoKey
 */
/**
 * Derives an AES-GCM key from a master password and salt using PBKDF2.
 * @param {string} password - The user's master password
 * @param {ArrayBuffer} salt - 16-byte random salt
 * @returns {Promise<CryptoKey>} - Derived CryptoKey
 */
export const deriveKey = async (password, salt) => {
  const passwordBuffer = stringToBuffer(password);
  
  // Import the raw password as a key-deriving-key
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );
  
  // Derive the actual AES-GCM 256-bit encryption key
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 600000, // OWASP recommended iteration count
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // Key is not exportable (safer in memory)
    ['encrypt', 'decrypt']
  );
};

/**
 * Derives the master vault key from password and user email.
 * Email is hashed to create a standard 16-byte salt.
 * @param {string} password - The master password
 * @param {string} email - The user's email
 * @returns {Promise<CryptoKey>} - Master key
 */
export const deriveMasterKey = async (password, email) => {
  if (!password || !email) throw new Error('Password and email are required to derive key.');
  const emailBuffer = stringToBuffer(email.toLowerCase().trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', emailBuffer);
  const salt = hashBuffer.slice(0, 16); // First 16 bytes of SHA-256 hash
  return deriveKey(password, salt);
};

/**
 * Encrypts plaintext data using a pre-derived AES-GCM key.
 * @param {string} plaintext - Data to encrypt
 * @param {CryptoKey} key - Pre-derived AES-GCM key
 * @returns {Promise<{ encryptedData: string, iv: string }>} - Base64 encoded outputs (no salt)
 */
export const encryptWithKey = async (plaintext, key) => {
  if (!plaintext) return { encryptedData: '', iv: '' };
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    stringToBuffer(plaintext)
  );
  
  return {
    encryptedData: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
  };
};

/**
 * Decrypts ciphertext data using a pre-derived AES-GCM key.
 * @param {string} encryptedDataBase64 - Base64 ciphertext
 * @param {string} ivBase64 - Base64 IV
 * @param {CryptoKey} key - Pre-derived AES-GCM key
 * @returns {Promise<string>} - Plaintext string
 */
export const decryptWithKey = async (encryptedDataBase64, ivBase64, key) => {
  if (!encryptedDataBase64) return '';
  
  const ciphertext = base64ToBuffer(encryptedDataBase64);
  const iv = base64ToBuffer(ivBase64);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ciphertext
  );
  
  return bufferToString(decryptedBuffer);
};

/**
 * Legacy decryption handler: derives key per-entry using stored salt.
 * Used for unmigrated database entries.
 * @param {string} encryptedDataBase64 - Base64 ciphertext
 * @param {string} ivBase64 - Base64 IV
 * @param {string} saltBase64 - Base64 salt
 * @param {string} password - Master password
 * @returns {Promise<string>} - Plaintext string
 */
export const decryptLegacy = async (encryptedDataBase64, ivBase64, saltBase64, password) => {
  if (!encryptedDataBase64) return '';
  
  try {
    const ciphertext = base64ToBuffer(encryptedDataBase64);
    const iv = base64ToBuffer(ivBase64);
    const salt = base64ToBuffer(saltBase64);
    
    const key = await deriveKey(password, salt);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );
    
    return bufferToString(decryptedBuffer);
  } catch (error) {
    console.error('Legacy decryption failed:', error);
    throw new Error('Failed to decrypt data using legacy mode.');
  }
};
