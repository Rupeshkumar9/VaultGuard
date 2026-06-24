import { deriveMasterKey, encryptWithKey, decryptWithKey, decryptLegacy } from './crypto-helper.js';
import { localDb } from './local-db.js';

const DEFAULT_SERVER_URL = 'https://vaultguard-qi2y.onrender.com'; //change it to your server url
let autoLockTimer = null;

// Initialize access level for session storage so popup can also access it
if (chrome.storage.session && typeof chrome.storage.session.setAccessLevel === 'function') {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
    .catch(err => console.log('Session storage access level already configured or unsupported:', err));
}

// ──── Session Restoration on Startup ────
async function restoreSessionOnStartup() {
  try {
    const settings = await chrome.storage.local.get(['rememberVault', 'masterPassword', 'token', 'user']);
    if (settings.rememberVault && settings.masterPassword) {
      await chrome.storage.session.set({
        masterPassword: settings.masterPassword,
        token: settings.token,
        user: settings.user
      });
      if (settings.user) {
        await chrome.storage.local.set({
          cachedUser: { id: settings.user.id || settings.user._id, email: settings.user.email }
        });
      }
      console.log('🔓 Extension session restored from local storage.');
      startAutoLockTimer();
    }
  } catch (err) {
    console.error('Session restoration failed:', err);
  }
}

// Run startup check
restoreSessionOnStartup();

// ──── API Fetch Wrapper ────
async function apiRequest(endpoint, method = 'GET', body = null) {
  const settings = await chrome.storage.local.get(['serverUrl']);
  const serverUrl = (settings.serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  const url = `${serverUrl}${cleanEndpoint}`;

  // Get session info for auth token
  const session = await chrome.storage.session.get(['token']);
  const headers = {
    'Content-Type': 'application/json',
  };
  if (session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }

  const config = {
    method,
    headers,
  };
  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.message || 'API Request failed');
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    console.error('API Fetch Error:', error);
    throw new Error(error.message || 'Failed to communicate with VaultGuard server.');
  }
}

// ──── Session and Locking Management ────
async function lockVault() {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
  // Clear session storage keys
  await chrome.storage.session.remove(['masterPassword', 'token', 'user', 'encryptedEntries']);
  
  // Clear local storage keys (if any are saved there)
  await chrome.storage.local.remove(['masterPassword', 'token', 'user']);
  
  // Notify popup and content scripts if any are active
  chrome.runtime.sendMessage({ action: 'VAULT_LOCKED' }).catch(() => {});
}

async function startAutoLockTimer() {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
  }
  const settings = await chrome.storage.local.get(['lockTimeout']);
  const minutes = parseInt(settings.lockTimeout || '5', 10);
  if (minutes === 0) return; // 0 means Never Lock

  autoLockTimer = setTimeout(async () => {
    console.log('🔒 Vault auto-locked due to inactivity.');
    await lockVault();
  }, minutes * 60 * 1000);
}

// Reset the lock timer on user activity
async function resetAutoLockTimer() {
  const session = await chrome.storage.session.get(['masterPassword']);
  if (session.masterPassword) {
    startAutoLockTimer();
  }
}

// ──── Sync Vault ────
async function syncVault() {
  const session = await chrome.storage.session.get(['masterPassword']);
  if (!session.masterPassword) {
    throw new Error('Vault is locked.');
  }

  try {
    const response = await apiRequest('/vault');
    if (response.success && response.data) {
      // Store encrypted entries in both session and local IndexedDB database
      await chrome.storage.session.set({ encryptedEntries: response.data });
      await localDb.saveEntries(response.data);
      // Notify popup that sync completed
      chrome.runtime.sendMessage({ action: 'VAULT_SYNCED', count: response.data.length }).catch(() => {});
      return { success: true, count: response.data.length };
    } else {
      throw new Error(response.message || 'Failed to fetch vault ciphers.');
    }
  } catch (error) {
    console.error('Sync error:', error);
    throw error;
  }
}

// ──── Helper: Normalize Domain ────
// ──── Helper: Normalize Domain ────
function getDomain(urlStr) {
  try {
    if (!urlStr) return '';
    let cleanUrl = urlStr.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const url = new URL(cleanUrl);
    let hostname = url.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname.toLowerCase();
  } catch (e) {
    return '';
  }
}

// Extract base domain (eTLD+1) for flexible matching across subdomains
function getBaseDomain(hostname) {
  if (!hostname) return '';
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return hostname;
  }
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  
  const secondLast = parts[parts.length - 2];
  const doubleTlds = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'nom', 'mil'];
  
  if (doubleTlds.includes(secondLast) && parts[parts.length - 1].length === 2) {
    return parts.slice(-3).join('.');
  }
  
  return parts.slice(-2).join('.');
}

const MULTI_TENANT_DOMAINS = [
  'vercel.app',
  'github.io',
  'netlify.app',
  'herokuapp.com',
  'firebaseapp.com',
  'pages.dev',
  'workers.dev',
  'githubusercontent.com',
  'amazonaws.com',
  'onedev.sh'
];

// Helper to derive master key from stored master password and user email
async function getMasterKey(masterPassword) {
  const session = await chrome.storage.session.get(['user']);
  let email = session.user?.email;
  if (!email) {
    const settings = await chrome.storage.local.get(['cachedUser', 'user']);
    email = settings.user?.email || settings.cachedUser?.email;
  }
  if (!email) {
    throw new Error('User email not found in session or cache.');
  }
  return await deriveMasterKey(masterPassword, email);
}

// ──── Main Message Router ────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  resetAutoLockTimer();

  // Standard Chrome message passing is asynchronous if we return true
  const handleMessage = async () => {
    try {
      switch (message.action) {
        case 'GET_SERVER_URL': {
          const settings = await chrome.storage.local.get(['serverUrl']);
          return { serverUrl: settings.serverUrl || DEFAULT_SERVER_URL };
        }
        case 'SET_SERVER_URL': {
          await chrome.storage.local.set({ serverUrl: message.serverUrl });
          return { success: true };
        }
        case 'GET_LOCK_TIMEOUT': {
          const settings = await chrome.storage.local.get(['lockTimeout']);
          return { lockTimeout: settings.lockTimeout || '5' };
        }
        case 'SET_LOCK_TIMEOUT': {
          await chrome.storage.local.set({ lockTimeout: message.lockTimeout });
          startAutoLockTimer();
          return { success: true };
        }
        case 'UNLOCK_VAULT': {
          const { email, masterPassword, rememberVault } = message;
          await chrome.storage.local.set({ rememberVault: !!rememberVault });
          
          let unlockedLocally = false;
          let userToUse = null;

          try {
            const settings = await chrome.storage.local.get(['cachedUser']);
            const cachedUser = settings.cachedUser;
            
            if (cachedUser && cachedUser.email && cachedUser.email.toLowerCase() === email.toLowerCase()) {
              const cachedEntries = await localDb.getAllEntries();
              const testEntry = cachedEntries.find(e => e.encryptedData && e.iv && e.salt);
              
              if (testEntry) {
                // Try to decrypt the entry to verify password
                if (testEntry.salt === 'migrated' || testEntry.salt === 'none' || !testEntry.salt) {
                  const masterKey = await deriveMasterKey(masterPassword, email);
                  await decryptWithKey(testEntry.encryptedData, testEntry.iv, masterKey);
                } else {
                  await decryptLegacy(testEntry.encryptedData, testEntry.iv, testEntry.salt, masterPassword);
                }
                unlockedLocally = true;
                userToUse = cachedUser;
              }
            }
          } catch (err) {
            console.log('Local decryption failed or no cache, will try server auth:', err);
          }

          if (unlockedLocally) {
            // Restore cached token if it exists in local storage
            const localSettings = await chrome.storage.local.get(['token']);
            
            // Unlock immediately using cached data
            await chrome.storage.session.set({
              user: userToUse,
              masterPassword: masterPassword,
              token: localSettings.token || null
            });

            // If rememberVault is enabled, save to local storage as well
            if (rememberVault) {
              await chrome.storage.local.set({
                user: userToUse,
                masterPassword: masterPassword
              });
            } else {
              await chrome.storage.local.remove(['token', 'user', 'masterPassword']);
            }

            startAutoLockTimer();

            // Background wake, login, and sync
            (async () => {
              try {
                const loginRes = await apiRequest('/auth/login', 'POST', { email, password: masterPassword });
                if (loginRes.success) {
                  await chrome.storage.session.set({
                    token: loginRes.token,
                    user: loginRes.user
                  });
                  await chrome.storage.local.set({
                    cachedUser: { id: loginRes.user.id || loginRes.user._id, email: loginRes.user.email }
                  });
                  if (rememberVault) {
                    await chrome.storage.local.set({
                      token: loginRes.token,
                      user: loginRes.user
                    });
                  }
                  await syncVault();
                }
              } catch (err) {
                console.error('Background login/sync failed:', err);
                if (err.status === 401) {
                  console.warn('Background login returned 401. Locking vault.');
                  await lockVault();
                }
              }
            })();

            return { success: true, user: userToUse };
          } else {
            // Standard server-based authentication flow (for first login, different user, or changed password)
            const loginRes = await apiRequest('/auth/login', 'POST', { email, password: masterPassword });
            if (loginRes.success) {
              await chrome.storage.session.set({
                token: loginRes.token,
                user: loginRes.user,
                masterPassword: masterPassword
              });
              
              await chrome.storage.local.set({
                cachedUser: { id: loginRes.user.id || loginRes.user._id, email: loginRes.user.email }
              });

              if (rememberVault) {
                await chrome.storage.local.set({
                  token: loginRes.token,
                  user: loginRes.user,
                  masterPassword: masterPassword
                });
              } else {
                await chrome.storage.local.remove(['token', 'user', 'masterPassword']);
              }
              
              await syncVault();
              startAutoLockTimer();
              return { success: true, user: loginRes.user };
            }
            throw new Error('Invalid credentials.');
          }
        }
        case 'LOCK_VAULT': {
          await lockVault();
          return { success: true };
        }
        case 'GET_STATUS': {
          const session = await chrome.storage.session.get(['masterPassword', 'user']);
          return { 
            isUnlocked: !!session.masterPassword, 
            user: session.user || null 
          };
        }
        case 'SYNC_VAULT': {
          return await syncVault();
        }
        case 'GET_REMEMBER_VAULT': {
          const settings = await chrome.storage.local.get(['rememberVault']);
          return { rememberVault: !!settings.rememberVault };
        }
        case 'SET_REMEMBER_VAULT': {
          await chrome.storage.local.set({ rememberVault: !!message.rememberVault });
          if (!message.rememberVault) {
            await chrome.storage.local.remove(['token', 'user', 'masterPassword']);
          } else {
            const session = await chrome.storage.session.get(['token', 'user', 'masterPassword']);
            if (session.masterPassword) {
              await chrome.storage.local.set({
                token: session.token,
                user: session.user,
                masterPassword: session.masterPassword
              });
            }
          }
          return { success: true };
        }
        case 'GET_ENTRIES': {
          const session = await chrome.storage.session.get(['masterPassword', 'encryptedEntries']);
          if (!session.masterPassword) {
            return { success: false, error: 'Vault is locked.' };
          }
          
          let rawEntries = session.encryptedEntries;
          if (!rawEntries) {
            rawEntries = await localDb.getAllEntries();
            await chrome.storage.session.set({ encryptedEntries: rawEntries });
          }
          
          let masterKey;
          try {
            masterKey = await getMasterKey(session.masterPassword);
          } catch (err) {
            console.error('Failed to derive master key for GET_ENTRIES:', err);
            return { success: false, error: 'Failed to derive master key.' };
          }

          const decryptedList = [];
          const legacyEntries = [];

          for (const entry of rawEntries) {
            try {
              if (entry.encryptedData && entry.iv && entry.salt) {
                let plaintext;
                if (entry.salt === 'migrated' || entry.salt === 'none' || !entry.salt) {
                  plaintext = await decryptWithKey(entry.encryptedData, entry.iv, masterKey);
                } else {
                  plaintext = await decryptLegacy(entry.encryptedData, entry.iv, entry.salt, session.masterPassword);
                  legacyEntries.push({ ...entry, plaintext });
                }
                const sensitive = JSON.parse(plaintext);
                decryptedList.push({
                  ...entry,
                  username: sensitive.username || '',
                  password: sensitive.password || '',
                  notes: sensitive.notes || ''
                });
              } else {
                decryptedList.push({
                  ...entry,
                  username: '',
                  password: '',
                  notes: entry.notes || ''
                });
              }
            } catch (err) {
              console.error('Decryption failed for single entry:', entry.title, err);
              decryptedList.push({
                ...entry,
                username: '[Error Decrypting]',
                password: '[Error Decrypting]',
                notes: '[Error Decrypting]',
                decryptionError: true
              });
            }
          }

          // Trigger background migration for legacy entries if any exist
          if (legacyEntries.length > 0) {
            (async () => {
              console.log(`[Migration] Starting background migration for ${legacyEntries.length} entries...`);
              let migratedCount = 0;
              for (const entry of legacyEntries) {
                try {
                  const encrypted = await encryptWithKey(entry.plaintext, masterKey);
                  const updatedEntryData = {
                    title: entry.title,
                    website: entry.website,
                    category: entry.category || 'General',
                    encryptedData: encrypted.encryptedData,
                    iv: encrypted.iv,
                    salt: 'migrated',
                    notes: ''
                  };
                  await apiRequest(`/vault/${entry._id}`, 'PUT', updatedEntryData);
                  migratedCount++;
                } catch (err) {
                  console.error(`[Migration] Failed to migrate entry ${entry.title}:`, err);
                }
              }
              if (migratedCount > 0) {
                console.log(`[Migration] Successfully migrated ${migratedCount} entries. Syncing vault...`);
                await syncVault().catch(err => console.error('Sync failed after migration:', err));
              }
            })();
          }

          return { success: true, entries: decryptedList };
        }
        case 'GET_MATCHING_CREDENTIALS': {
          const session = await chrome.storage.session.get(['masterPassword', 'encryptedEntries']);
          if (!session.masterPassword) {
            return { success: false, error: 'Vault is locked.' };
          }

          let rawEntries = session.encryptedEntries;
          if (!rawEntries) {
            rawEntries = await localDb.getAllEntries();
            await chrome.storage.session.set({ encryptedEntries: rawEntries });
          }

          const pageUrl = message.url;
          const pageDomain = getDomain(pageUrl);
          if (!pageDomain) return { success: true, credentials: [] };

          const matching = [];

          let masterKey;
          try {
            masterKey = await getMasterKey(session.masterPassword);
          } catch (err) {
            console.error('Failed to derive master key for GET_MATCHING_CREDENTIALS:', err);
            return { success: false, error: 'Failed to derive master key.' };
          }

          for (const entry of rawEntries) {
            const entryDomain = getDomain(entry.website);
            if (!entryDomain) continue;

            const pageBase = getBaseDomain(pageDomain);
            const entryBase = getBaseDomain(entryDomain);

            // Match logic:
            // 1. Exact match of hostnames (e.g., vault-guard-xi.vercel.app and vault-guard-xi.vercel.app)
            // 2. Base domain match, provided the base domain is not a known multi-tenant hosting suffix (like vercel.app)
            let isMatch = false;
            if (pageDomain === entryDomain) {
              isMatch = true;
            } else if (pageBase && pageBase === entryBase) {
              if (!MULTI_TENANT_DOMAINS.includes(pageBase)) {
                isMatch = true;
              }
            }
            
            if (isMatch) {
              try {
                let plaintext;
                if (entry.salt === 'migrated' || entry.salt === 'none' || !entry.salt) {
                  plaintext = await decryptWithKey(entry.encryptedData, entry.iv, masterKey);
                } else {
                  plaintext = await decryptLegacy(entry.encryptedData, entry.iv, entry.salt, session.masterPassword);
                }
                const sensitive = JSON.parse(plaintext);
                matching.push({
                  id: entry._id,
                  title: entry.title,
                  website: entry.website,
                  username: sensitive.username || '',
                  password: sensitive.password || ''
                });
              } catch (err) {
                console.error('Failed to decrypt matching entry:', err);
              }
            }
          }
          return { success: true, credentials: matching };
        }
        case 'SAVE_CREDENTIAL': {
          const session = await chrome.storage.session.get(['masterPassword']);
          if (!session.masterPassword) {
            return { success: false, error: 'Vault is locked.' };
          }

          const { title, website, username, password, category, notes } = message.data;
          const sensitivePayload = JSON.stringify({ username, password, notes: notes || '' });
          
          let masterKey;
          try {
            masterKey = await getMasterKey(session.masterPassword);
          } catch (err) {
            console.error('Failed to derive master key for SAVE_CREDENTIAL:', err);
            return { success: false, error: 'Failed to derive master key.' };
          }

          // Encrypt client-side
          const encrypted = await encryptWithKey(sensitivePayload, masterKey);
          const newEntryData = {
            title,
            website,
            category: category || 'General',
            encryptedData: encrypted.encryptedData,
            iv: encrypted.iv,
            salt: 'migrated', // Sentinel value to satisfy required salt schema
            notes: ''
          };

          const saveRes = await apiRequest('/vault', 'POST', newEntryData);
          if (saveRes.success) {
            // Reload and update cache
            await syncVault();
            return { success: true, entry: saveRes.data };
          }
          throw new Error(saveRes.message || 'Failed to save credential.');
        }
        case 'UPDATE_CREDENTIAL': {
          const session = await chrome.storage.session.get(['masterPassword']);
          if (!session.masterPassword) {
            return { success: false, error: 'Vault is locked.' };
          }

          const { id, title, website, username, password, category, notes } = message.data;
          const sensitivePayload = JSON.stringify({ username, password, notes: notes || '' });
          
          let masterKey;
          try {
            masterKey = await getMasterKey(session.masterPassword);
          } catch (err) {
            console.error('Failed to derive master key for UPDATE_CREDENTIAL:', err);
            return { success: false, error: 'Failed to derive master key.' };
          }

          const encrypted = await encryptWithKey(sensitivePayload, masterKey);
          const updatedEntryData = {
            title,
            website,
            category: category || 'General',
            encryptedData: encrypted.encryptedData,
            iv: encrypted.iv,
            salt: 'migrated', // Sentinel value
            notes: ''
          };

          const updateRes = await apiRequest(`/vault/${id}`, 'PUT', updatedEntryData);
          if (updateRes.success) {
            await syncVault();
            return { success: true, entry: updateRes.data };
          }
          throw new Error(updateRes.message || 'Failed to update credential.');
        }
        case 'DELETE_CREDENTIAL': {
          const session = await chrome.storage.session.get(['masterPassword']);
          if (!session.masterPassword) {
            return { success: false, error: 'Vault is locked.' };
          }
          const { id } = message;
          const deleteRes = await apiRequest(`/vault/${id}`, 'DELETE');
          if (deleteRes.success) {
            await syncVault();
            return { success: true };
          }
          throw new Error(deleteRes.message || 'Failed to delete credential.');
        }
        case 'TOGGLE_FAVORITE': {
          const session = await chrome.storage.session.get(['masterPassword']);
          if (!session.masterPassword) {
            return { success: false, error: 'Vault is locked.' };
          }
          const { id } = message;
          const favRes = await apiRequest(`/vault/${id}/favorite`, 'PATCH');
          if (favRes.success) {
            await syncVault();
            return { success: true, entry: favRes.data };
          }
          throw new Error(favRes.message || 'Failed to toggle favorite.');
        }
        case 'SET_PENDING_CREDENTIAL': {
          const { username, password, website, title } = message.data;
          await chrome.storage.session.set({
            pendingCredential: {
              username,
              password,
              website,
              title,
              timestamp: Date.now()
            }
          });
          return { success: true };
        }
        case 'GET_PENDING_CREDENTIAL': {
          const session = await chrome.storage.session.get(['pendingCredential']);
          return { success: true, pendingCredential: session.pendingCredential || null };
        }
        case 'CLEAR_PENDING_CREDENTIAL': {
          await chrome.storage.session.remove(['pendingCredential']);
          return { success: true };
        }
        case 'USER_ACTIVITY': {
          // Trigger timer reset
          return { success: true };
        }
        default:
          return { error: 'Unknown action' };
      }
    } catch (err) {
      console.error('Background worker handler failed:', err);
      return { success: false, error: err.message || 'Action failed' };
    }
  };

  handleMessage().then(sendResponse);
  return true; // Keeps the message channel open for sendResponse
});
