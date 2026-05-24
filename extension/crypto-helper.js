/**
 * Cryptographic services for VaultGuard Browser Extension.
 * Uses browser-native Web Crypto API to ensure high security and speed.
 * Context-independent (works in both popup.js and background.js service worker).
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
const deriveKey = async (password, salt) => {
  const passwordBuffer = stringToBuffer(password);
  const cryptoObj = typeof self !== 'undefined' ? self.crypto : window.crypto;
  
  // Import the raw password as a key-deriving-key
  const baseKey = await cryptoObj.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );
  
  // Derive the actual AES-GCM 256-bit encryption key
  return cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 600000, // OWASP recommended iteration count
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // Key is not exportable
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypts plaintext data using a master password.
 * Generates a random salt and IV dynamically.
 * @param {string} plaintext - Data to encrypt
 * @param {string} password - Master password
 * @returns {Promise<{ encryptedData: string, iv: string, salt: string }>} - Base64 encoded outputs
 */
export const encrypt = async (plaintext, password) => {
  if (!plaintext) return { encryptedData: '', iv: '', salt: '' };
  const cryptoObj = typeof self !== 'undefined' ? self.crypto : window.crypto;
  
  // 1. Generate secure random salt (16 bytes) and IV (12 bytes)
  const salt = cryptoObj.getRandomValues(new Uint8Array(16));
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  
  // 2. Derive key from password and salt
  const key = await deriveKey(password, salt);
  
  // 3. Encrypt the plaintext using AES-GCM
  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    stringToBuffer(plaintext)
  );
  
  // 4. Return base64 encoded results
  return {
    encryptedData: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
  };
};

/**
 * Decrypts ciphertext data using the master password and stored parameters.
 * @param {string} encryptedDataBase64 - Base64 ciphertext
 * @param {string} ivBase64 - Base64 IV
 * @param {string} saltBase64 - Base64 salt
 * @param {string} password - Master password
 * @returns {Promise<string>} - Plaintext string
 */
export const decrypt = async (encryptedDataBase64, ivBase64, saltBase64, password) => {
  if (!encryptedDataBase64) return '';
  const cryptoObj = typeof self !== 'undefined' ? self.crypto : window.crypto;
  
  try {
    // 1. Convert base64 inputs back to buffers
    const ciphertext = base64ToBuffer(encryptedDataBase64);
    const iv = base64ToBuffer(ivBase64);
    const salt = base64ToBuffer(saltBase64);
    
    // 2. Re-derive the key using the same password and salt
    const key = await deriveKey(password, salt);
    
    // 3. Decrypt the ciphertext
    const decryptedBuffer = await cryptoObj.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );
    
    // 4. Convert buffer back to plaintext string
    return bufferToString(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data. Invalid master password or corrupted entry.');
  }
};
