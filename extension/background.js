import { decrypt, encrypt } from './crypto-helper.js';

const DEFAULT_SERVER_URL = 'http://localhost:5000';
let autoLockTimer = null;

// Initialize access level for session storage so popup can also access it
if (chrome.storage.session) {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
    .catch(err => console.log('Session storage access level already configured or unsupported:', err));
}

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
  await chrome.storage.session.remove(['masterPassword', 'token', 'user', 'decryptedEntries']);
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
      // Store encrypted entries in session storage as well to keep them in memory
      await chrome.storage.session.set({ encryptedEntries: response.data });
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
          const { email, masterPassword } = message;
          // 1. Call login endpoint to authenticate and get token
          const loginRes = await apiRequest('/auth/login', 'POST', { email, password: masterPassword });
          if (loginRes.success) {
            // 2. Set token, user, and master password in-memory session storage
            await chrome.storage.session.set({
              token: loginRes.token,
              user: loginRes.user,
              masterPassword: masterPassword
            });
            
            // 3. Trigger initial sync
            await syncVault();
            startAutoLockTimer();
            return { success: true, user: loginRes.user };
          }
          throw new Error('Invalid credentials.');
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
        case 'GET_ENTRIES': {
          const session = await chrome.storage.session.get(['masterPassword', 'encryptedEntries']);
          if (!session.masterPassword) {
            return { success: false, error: 'Vault is locked.' };
          }
          
          const rawEntries = session.encryptedEntries || [];
          const decryptedList = [];

          for (const entry of rawEntries) {
            try {
              if (entry.encryptedData && entry.iv && entry.salt) {
                const plaintext = await decrypt(entry.encryptedData, entry.iv, entry.salt, session.masterPassword);
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
          return { success: true, entries: decryptedList };
        }
        case 'GET_MATCHING_CREDENTIALS': {
          const session = await chrome.storage.session.get(['masterPassword', 'encryptedEntries']);
          if (!session.masterPassword || !session.encryptedEntries) {
            return { success: false, error: 'Vault is locked.' };
          }

          const pageUrl = message.url;
          const pageDomain = getDomain(pageUrl);
          if (!pageDomain) return { success: true, credentials: [] };

          const rawEntries = session.encryptedEntries;
          const matching = [];

          for (const entry of rawEntries) {
            const entryDomain = getDomain(entry.website);
            if (!entryDomain) continue;

            const pageBase = getBaseDomain(pageDomain);
            const entryBase = getBaseDomain(entryDomain);

            // Match if base domains are identical (e.g., auth.geeksforgeeks.org matching practice.geeksforgeeks.org)
            const isMatch = pageBase && (pageBase === entryBase);
            
            if (isMatch) {
              try {
                const plaintext = await decrypt(entry.encryptedData, entry.iv, entry.salt, session.masterPassword);
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
          
          // Encrypt client-side
          const encrypted = await encrypt(sensitivePayload, session.masterPassword);
          const newEntryData = {
            title,
            website,
            category: category || 'General',
            encryptedData: encrypted.encryptedData,
            iv: encrypted.iv,
            salt: encrypted.salt,
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
          
          const encrypted = await encrypt(sensitivePayload, session.masterPassword);
          const updatedEntryData = {
            title,
            website,
            category: category || 'General',
            encryptedData: encrypted.encryptedData,
            iv: encrypted.iv,
            salt: encrypted.salt,
            notes: ''
          };

          const updateRes = await apiRequest(`/vault/${id}`, 'PUT', updatedEntryData);
          if (updateRes.success) {
            await syncVault();
            return { success: true, entry: updateRes.data };
          }
          throw new Error(updateRes.message || 'Failed to update credential.');
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
