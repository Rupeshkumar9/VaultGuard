const DB_NAME = 'VaultGuardLocalDB';
const DB_VERSION = 2;
const STORE_NAME = 'encrypted_entries';
const SECURE_STORE_NAME = 'secure_state';
const WRAPPING_KEY_ID = 'remembered_session_key';
const REMEMBERED_SESSION_ID = 'remembered_session';

let dbInstance = null;

function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains(SECURE_STORE_NAME)) {
        db.createObjectStore(SECURE_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function getSecureRecord(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(SECURE_STORE_NAME, 'readonly').objectStore(SECURE_STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function putSecureRecord(record) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SECURE_STORE_NAME, 'readwrite');
    transaction.objectStore(SECURE_STORE_NAME).put(record);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function deleteSecureRecord(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SECURE_STORE_NAME, 'readwrite');
    transaction.objectStore(SECURE_STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getOrCreateWrappingKey() {
  const existing = await getSecureRecord(WRAPPING_KEY_ID);
  if (existing?.key) return existing.key;

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  await putSecureRecord({ id: WRAPPING_KEY_ID, key });
  return key;
}

export const localDb = {
  async saveRememberedSession(session) {
    const key = await getOrCreateWrappingKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(session));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    await putSecureRecord({
      id: REMEMBERED_SESSION_ID,
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(ciphertext))
    });
  },

  async getRememberedSession() {
    const record = await getSecureRecord(REMEMBERED_SESSION_ID);
    if (!record) return null;

    const keyRecord = await getSecureRecord(WRAPPING_KEY_ID);
    if (!keyRecord?.key) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(record.iv) },
      keyRecord.key,
      new Uint8Array(record.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  },

  async clearRememberedSession() {
    await deleteSecureRecord(REMEMBERED_SESSION_ID);
    await deleteSecureRecord(WRAPPING_KEY_ID);
  },

  async getAllEntries() {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Failed to get entries from IndexedDB:', err);
      return [];
    }
  },

  async saveEntries(entries) {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Wipe the store first
        store.clear();

        // Put each entry
        entries.forEach((entry) => {
          store.put(entry);
        });

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (err) {
      console.error('Failed to save entries to IndexedDB:', err);
      return false;
    }
  },

  async clearAll() {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Failed to clear IndexedDB:', err);
      return false;
    }
  }
};
