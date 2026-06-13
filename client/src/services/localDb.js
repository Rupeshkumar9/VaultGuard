const DB_NAME = 'VaultGuardLocalDB';
const DB_VERSION = 2;
const STORE_NAME = 'encrypted_entries';
const USER_STORE_NAME = 'user_metadata';
const USER_PROFILE_KEY = 'current_user_profile';

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
      if (!db.objectStoreNames.contains(USER_STORE_NAME)) {
        db.createObjectStore(USER_STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

export const localDb = {
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

  async getUserProfile() {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(USER_STORE_NAME, 'readonly');
        const store = transaction.objectStore(USER_STORE_NAME);
        const request = store.get(USER_PROFILE_KEY);

        request.onsuccess = () => resolve(request.result?.value || null);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Failed to get user profile from IndexedDB:', err);
      return null;
    }
  },

  async saveUserProfile(profile) {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(USER_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(USER_STORE_NAME);
        const request = store.put({
          key: USER_PROFILE_KEY,
          value: profile,
          updatedAt: new Date().toISOString(),
        });

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Failed to save user profile to IndexedDB:', err);
      return false;
    }
  },

  async clearUserProfile() {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(USER_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(USER_STORE_NAME);
        const request = store.delete(USER_PROFILE_KEY);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Failed to clear user profile from IndexedDB:', err);
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
