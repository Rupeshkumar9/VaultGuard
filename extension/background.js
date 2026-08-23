/**
 * VaultGuard - Zero-Knowledge Password Manager
 * Developed by Rupesh (https://github.com/rupeshkumar9)
 */

import { deriveMasterKey, encryptWithKey, decryptWithKey } from './crypto-helper.js';
import { localDb } from './local-db.js';
import { parseSiteIdentity, sitesMatch } from '../client/src/utils/siteIdentity.js';
import { client as opaqueClient, ready as opaqueReady } from '@serenity-kit/opaque';

const AUTO_LOCK_ALARM = 'vaultguard-auto-lock';
const MAX_FIELD_LENGTH = 10000;
const CONTENT_SCRIPT_ACTIONS = new Set([
  'GET_MATCHING_METADATA',
  'GET_CREDENTIAL_FOR_FILL',
  'CHECK_CREDENTIAL_FOR_SAVE',
  'QUEUE_PENDING_CREDENTIAL',
  'GET_PENDING_CREDENTIALS',
  'UPDATE_PENDING_CREDENTIAL',
  'DELETE_PENDING_CREDENTIAL',
  'SAVE_CREDENTIAL',
  'UPDATE_CREDENTIAL',
  'SET_FOCUSED_FRAME',
  'USER_ACTIVITY',
]);

// Keep secrets available only to trusted extension pages and the service worker.
// Popup pages are trusted contexts; content scripts must not read this storage.
if (chrome.storage.session && typeof chrome.storage.session.setAccessLevel === 'function') {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
    .catch(err => console.log('Session storage access level already configured or unsupported:', err));
}
if (chrome.storage.local && typeof chrome.storage.local.setAccessLevel === 'function') {
  chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
    .catch(err => console.log('Local storage access level could not be restricted:', err));
}

function isTrustedExtensionSender(sender) {
  return !sender?.tab && typeof sender?.url === 'string' &&
    sender.url.startsWith(chrome.runtime.getURL(''));
}

function isContentScriptSender(sender) {
  return !!sender?.tab && !!parseSiteIdentity(sender.url || sender.tab.url || '');
}

function assertAuthorizedSender(action, sender) {
  if (isTrustedExtensionSender(sender)) return;
  if (isContentScriptSender(sender) && CONTENT_SCRIPT_ACTIONS.has(action)) return;
  throw new Error('This extension context is not authorized for that action.');
}

function getSenderSite(sender) {
  const identity = parseSiteIdentity(sender?.url || sender?.tab?.url || '');
  if (!identity) throw new Error('Unable to determine the requesting site.');
  return identity;
}

function boundedString(value, field, { required = false, max = MAX_FIELD_LENGTH, trim = true } = {}) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') throw new Error(`${field} must be text.`);
  const result = trim ? value.trim() : value;
  if (required && !result) throw new Error(`${field} is required.`);
  if (result.length > max) throw new Error(`${field} is too long.`);
  return result;
}

function credentialId(value) {
  const id = boundedString(value, 'Credential ID', { required: true, max: 64 });
  if (!/^[a-f\d]{24}$/i.test(id)) throw new Error('Credential ID is invalid.');
  return id;
}

function normalizeServerUrl(value) {
  const identity = parseSiteIdentity(value);
  if (!identity) throw new Error('A valid HTTP(S) server URL is required.');
  const isLocal = identity.hostname === 'localhost' || identity.hostname === '127.0.0.1';
  if (identity.protocol !== 'https:' && !isLocal) {
    throw new Error('The server URL must use HTTPS.');
  }
  return identity.origin;
}

async function getConfiguredServerUrl() {
  const { serverUrl } = await chrome.storage.local.get(['serverUrl']);
  if (!serverUrl) {
    throw new Error('Server URL is not configured. Open the VaultGuard extension once.');
  }
  return normalizeServerUrl(serverUrl);
}

// ──── Session Restoration on Startup ────
async function restoreSessionOnStartup() {
  try {
    const [session, settings] = await Promise.all([
      chrome.storage.session.get(['masterPassword']),
      chrome.storage.local.get(['rememberVault', 'masterPassword', 'token', 'user', 'vaultExplicitlyLocked'])
    ]);

    let rememberedSession = null;
    if (settings.rememberVault && !settings.vaultExplicitlyLocked) {
      rememberedSession = await localDb.getRememberedSession();
      if (!rememberedSession && settings.masterPassword) {
        // One-time migration from versions that stored restart credentials in plaintext.
        rememberedSession = {
          masterPassword: settings.masterPassword,
          token: settings.token,
          user: settings.user
        };
        await localDb.saveRememberedSession(rememberedSession);
        await chrome.storage.local.remove(['masterPassword', 'token', 'user']);
      }
    }

    // Do not overwrite an already-restored session or undo an explicit/automatic lock.
    if (!session.masterPassword && rememberedSession?.masterPassword) {
      await chrome.storage.session.set({
        masterPassword: rememberedSession.masterPassword,
        token: rememberedSession.token,
        user: rememberedSession.user,
        lastActive: Date.now()
      });
      if (rememberedSession.user) {
        await chrome.storage.local.set({
          cachedUser: {
            id: rememberedSession.user.id || rememberedSession.user._id,
            name: rememberedSession.user.name || '',
            email: rememberedSession.user.email
          }
        });
      }
      console.log('🔓 Extension session restored from local storage.');
      await scheduleAutoLockAlarm();
      chrome.runtime.sendMessage({ action: 'VAULT_RESTORED' }).catch(() => {});
    }
  } catch (err) {
    console.error('Session restoration failed:', err);
  }
}

// All events share the same initialization promise so a cold-start message cannot
// observe storage.session before restoration finishes.
let initializationPromise;
function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = restoreSessionOnStartup().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
}

void ensureInitialized();

// Register synchronously so Chrome can wake this MV3 worker at profile startup.
chrome.runtime.onStartup.addListener(() => {
  void ensureInitialized();
});

// ──── API Fetch Wrapper ────
async function apiRequest(endpoint, method = 'GET', body = null) {
  const serverUrl = await getConfiguredServerUrl();
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
    if (error.status) throw error;
    throw new Error(error.message || 'Failed to communicate with VaultGuard server.');
  }
}

async function authenticateWithServer(email, password) {
  await opaqueReady;
  const start = opaqueClient.startLogin({ password });
  const challenge = await apiRequest('/auth/opaque/login/start', 'POST', {
    email,
    startLoginRequest: start.startLoginRequest,
  });
  const result = opaqueClient.finishLogin({
    clientLoginState: start.clientLoginState,
    loginResponse: challenge.loginResponse,
    password,
  });
  if (!result) throw Object.assign(new Error('Invalid credentials.'), { status: 401 });
  return apiRequest('/auth/opaque/login/finish', 'POST', {
    email,
    challengeId: challenge.challengeId,
    finishLoginRequest: result.finishLoginRequest,
  });
}

// ──── Session and Locking Management ────
async function lockVault({ forgetPersistent = false } = {}) {
  await chrome.alarms.clear(AUTO_LOCK_ALARM);
  // Clear session storage keys
  await chrome.storage.session.remove(['masterPassword', 'token', 'user', 'encryptedEntries']);

  // Prevent a later worker restart from silently undoing this lock.
  await chrome.storage.local.set({ vaultExplicitlyLocked: true });
  if (forgetPersistent) {
    await localDb.clearRememberedSession();
    await localDb.clearPending();
    await chrome.storage.local.remove(['masterPassword', 'token', 'user']);
    await chrome.storage.local.set({ rememberVault: false });
  }
  
  // Notify popup and content scripts if any are active
  chrome.runtime.sendMessage({ action: 'VAULT_LOCKED' }).catch(() => {});
}

async function scheduleAutoLockAlarm() {
  await chrome.alarms.clear(AUTO_LOCK_ALARM);
  const settings = await chrome.storage.local.get(['lockTimeout']);
  const minutes = parseInt(settings.lockTimeout || '5', 10);
  if (minutes === 0) return; // 0 means Never Lock
  await chrome.alarms.create(AUTO_LOCK_ALARM, { delayInMinutes: minutes });
}

// Reset the lock timer on user activity
async function resetAutoLockTimer() {
  const session = await chrome.storage.session.get(['masterPassword']);
  if (session.masterPassword) {
    await chrome.storage.session.set({ lastActive: Date.now() });
    await scheduleAutoLockAlarm();
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== AUTO_LOCK_ALARM) return;
  void ensureInitialized()
    .then(() => checkInactivityLock())
    .catch((error) => console.error('Auto-lock alarm failed:', error));
});

// ──── Sync Vault ────
async function syncVault() {
  const session = await chrome.storage.session.get(['masterPassword']);
  if (!session.masterPassword) {
    throw new Error('Vault is locked.');
  }

  try {
    const response = await apiRequest('/vault?trash=all');
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

// Helper to derive master key from stored master password and user email
async function getMasterKeyForEmail(masterPassword, email) {
  if (!email) {
    throw new Error('User email not found in session or cache.');
  }
  return await deriveMasterKey(masterPassword, email);
}

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
  return getMasterKeyForEmail(masterPassword, email);
}

// Check if the vault should be locked based on inactivity elapsed time
async function checkInactivityLock() {
  const session = await chrome.storage.session.get(['masterPassword', 'lastActive']);
  if (!session.masterPassword) return; // Already locked

  const settings = await chrome.storage.local.get(['lockTimeout']);
  const minutes = parseInt(settings.lockTimeout || '5', 10);
  if (minutes === 0) return; // 0 means Never Lock

  const lastActive = session.lastActive || Date.now();
  const elapsedMs = Date.now() - lastActive;
  if (elapsedMs >= minutes * 60 * 1000) {
    console.log('🔒 Vault auto-locked due to inactivity (checked on message receipt).');
    await lockVault();
  }
}

async function loadEncryptedEntries(sessionEntries) {
  if (sessionEntries) return sessionEntries;
  const entries = await localDb.getAllEntries();
  await chrome.storage.session.set({ encryptedEntries: entries });
  return entries;
}

async function decryptSensitiveEntry(entry, masterKey) {
  if (!entry?.encryptedData || !entry?.iv) {
    return { username: '', password: '', notes: entry?.notes || '' };
  }

  const plaintext = await decryptWithKey(entry.encryptedData, entry.iv, masterKey);
  return JSON.parse(plaintext);
}

async function matchingEntriesForSite(pageUrl, session) {
  const rawEntries = await loadEncryptedEntries(session.encryptedEntries);
  return rawEntries.filter(entry => entry.website && sitesMatch(entry.website, pageUrl));
}

async function readPendingCredentials(masterKey) {
  const records = await localDb.getAllPending();
  const items = [];
  for (const record of records) {
    try {
      const data = JSON.parse(await decryptWithKey(record.encryptedData, record.iv, masterKey));
      items.push({ ...record, ...data });
    } catch (error) {
      console.error('Failed to decrypt a pending autosave item:', error);
    }
  }
  return items.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

async function writePendingCredential(data, session, sender) {
  if (!session.masterPassword) return { success: false, error: 'Vault is locked.' };
  const senderSite = getSenderSite(sender);
  const website = senderSite.origin;
  const username = boundedString(data.username, 'Username', { max: 1000, trim: false });
  const password = boundedString(data.password, 'Password', { max: MAX_FIELD_LENGTH, trim: false });
  if (!username && !password) return { success: false, error: 'A username or password is required.' };
  const title = boundedString(data.title || senderSite.hostname, 'Title', { max: 200 });
  const category = boundedString(data.category || 'General', 'Category', { max: 100 });
  const masterKey = await getMasterKey(session.masterPassword);
  const existingItems = await readPendingCredentials(masterKey);
  const normalizedUser = username.trim().toLowerCase();
  const existingPending = existingItems.find(item =>
    sitesMatch(item.website, website) &&
    ((normalizedUser && item.username?.trim().toLowerCase() === normalizedUser) ||
      (!normalizedUser && !item.username && !item.password) ||
      (!item.username && username) || (!username && item.password && password))
  );

  const matchingEntries = await matchingEntriesForSite(website, session);
  let existingId = existingPending?.existingId || null;
  let kind = existingPending?.kind || 'new';
  for (const entry of matchingEntries) {
    const sensitive = await decryptSensitiveEntry(entry, masterKey);
    if (username && (sensitive.username || '').trim().toLowerCase() === normalizedUser) {
      if (sensitive.password !== password || !password) {
        existingId = entry._id;
        kind = 'updated';
      } else if (password && sensitive.password === password) {
        return { success: true, duplicate: true, pendingCount: existingItems.length };
      }
      break;
    }
  }

  const merged = {
    title: title || existingPending?.title || senderSite.hostname,
    website,
    category,
    username: username || existingPending?.username || '',
    password: password || existingPending?.password || '',
    notes: boundedString(data.notes || existingPending?.notes, 'Notes', { max: MAX_FIELD_LENGTH, trim: false }),
  };
  const encrypted = await encryptWithKey(JSON.stringify(merged), masterKey);
  const record = {
    id: existingPending?.id || crypto.randomUUID(),
    encryptedData: encrypted.encryptedData,
    iv: encrypted.iv,
    website,
    title: merged.title,
    kind,
    existingId,
    createdAt: existingPending?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  await localDb.putPending(record);
  return {
    success: true,
    duplicate: false,
    id: record.id,
    kind,
    pendingCount: (await localDb.getAllPending()).length,
  };
}

// ──── Main Message Router ────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Standard Chrome message passing is asynchronous if we return true
  const handleMessage = async () => {
    try {
      await ensureInitialized();
      if (!message || typeof message.action !== 'string') {
        throw new Error('A valid message action is required.');
      }
      // Let a fresh login or an explicit settings change establish the new
      // policy before evaluating the previous timeout policy.
      if (!['UNLOCK_VAULT', 'SET_LOCK_TIMEOUT'].includes(message.action)) {
        await checkInactivityLock();
      }
      assertAuthorizedSender(message.action, sender);
      switch (message.action) {
        case 'GET_SERVER_URL': {
          const settings = await chrome.storage.local.get(['serverUrl']);
          return { serverUrl: settings.serverUrl || null };
        }
        case 'SET_SERVER_URL': {
          const serverUrl = normalizeServerUrl(message.serverUrl);
          await chrome.storage.local.set({ serverUrl });
          return { success: true };
        }
        case 'SET_FRONTEND_URL': {
          const frontendUrl = normalizeServerUrl(message.frontendUrl);
          await chrome.storage.local.set({ frontendUrl });
          return { success: true };
        }
        case 'OPEN_FRONTEND': {
          const { frontendUrl } = await chrome.storage.local.get(['frontendUrl']);
          if (!frontendUrl) throw new Error('Frontend URL is not configured in this extension build.');
          await chrome.tabs.create({ url: normalizeServerUrl(frontendUrl) });
          return { success: true };
        }
        case 'GET_LOCK_TIMEOUT': {
          const settings = await chrome.storage.local.get(['lockTimeout']);
          return { lockTimeout: settings.lockTimeout || '5' };
        }
        case 'SET_FOCUSED_FRAME': {
          if (!sender.tab?.id || !sender.frameId) {
            return { success: true };
          }
          const focusedSite = getSenderSite(sender);
          await chrome.storage.session.set({
            focusedFrame: {
              tabId: sender.tab.id,
              frameId: sender.frameId,
              website: focusedSite.origin,
              timestamp: Date.now(),
            },
          });
          return { success: true };
        }
        case 'SET_LOCK_TIMEOUT': {
          const lockTimeout = String(message.lockTimeout);
          if (!['0', '1', '5', '15', '30'].includes(lockTimeout)) {
            throw new Error('Invalid lock timeout.');
          }
          const neverLock = lockTimeout === '0';
          await chrome.storage.local.set({
            lockTimeout,
            rememberVault: neverLock,
            vaultExplicitlyLocked: false,
          });
          if (neverLock) {
            const session = await chrome.storage.session.get(['token', 'user', 'masterPassword']);
            if (session.masterPassword) {
              await localDb.saveRememberedSession({
                token: session.token || null,
                user: session.user || null,
                masterPassword: session.masterPassword,
              });
            }
          } else {
            await localDb.clearRememberedSession();
            await chrome.storage.local.remove(['token', 'user', 'masterPassword']);
          }
          await scheduleAutoLockAlarm();
          return {
            success: true,
            lockTimeout,
            rememberVault: neverLock,
            message: neverLock
              ? 'Vault set to never lock automatically.'
              : `Vault will lock after ${lockTimeout} minute${lockTimeout === '1' ? '' : 's'} of inactivity.`,
          };
        }
        case 'UNLOCK_VAULT': {
          const email = boundedString(message.email, 'Email', { required: true, max: 320 }).toLowerCase();
          const masterPassword = boundedString(message.masterPassword, 'Master password', { required: true, trim: false });
          const rememberVault = message.rememberVault === true;
          const lockTimeout = rememberVault ? '0' : '5';
          await chrome.storage.local.set({
            rememberVault: !!rememberVault,
            lockTimeout,
            vaultExplicitlyLocked: false
          });
          if (!rememberVault) {
            await localDb.clearRememberedSession();
          }
          
          let unlockedLocally = false;
          let userToUse = null;

          try {
            const settings = await chrome.storage.local.get(['cachedUser']);
            const cachedUser = settings.cachedUser;
            
            if (cachedUser && cachedUser.email && cachedUser.email.toLowerCase() === email.toLowerCase()) {
              const cachedEntries = await localDb.getAllEntries();
              const testEntry = cachedEntries.find(e => e.encryptedData && e.iv && e.salt);
              
              if (testEntry) {
                // All vault entries use the current single-key format.
                const masterKey = await deriveMasterKey(masterPassword, email);
                await decryptWithKey(testEntry.encryptedData, testEntry.iv, masterKey);
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
              await localDb.saveRememberedSession({
                user: userToUse,
                masterPassword,
                token: localSettings.token || null
              });
              await chrome.storage.local.remove(['token', 'user', 'masterPassword']);
            } else {
              await chrome.storage.local.remove(['token', 'user', 'masterPassword']);
            }

            await resetAutoLockTimer();

            // Keep online refresh inside the message lifetime so Chrome cannot
            // terminate the worker while a required sync is still running.
            let refreshedUser = null;
            try {
              const loginRes = await authenticateWithServer(email, masterPassword);
              if (loginRes.success) {
                refreshedUser = loginRes.user;
                await chrome.storage.session.set({
                  token: loginRes.token,
                  user: loginRes.user
                });
                await chrome.storage.local.set({
                  cachedUser: { id: loginRes.user.id || loginRes.user._id, name: loginRes.user.name || '', email: loginRes.user.email }
                });
                if (rememberVault) {
                  await localDb.saveRememberedSession({
                    token: loginRes.token,
                    user: loginRes.user,
                    masterPassword
                  });
                }
                await syncVault();
              }
            } catch (err) {
              console.error('Background login/sync failed:', err);
              if (err.status === 401) {
                console.warn('Background login returned 401. Locking vault.');
                await lockVault({ forgetPersistent: true });
                return { success: false, error: 'Authentication expired. Please unlock again.' };
              }
            }

            // The local decryption path starts with cached profile data, but the
            // online login above is authoritative. Return that refreshed user so
            // the extension UI does not immediately replace the new server name
            // with the stale cached profile.
            return { success: true, user: refreshedUser || userToUse };
          } else {
            // Standard server-based authentication flow (for first login, different user, or changed password)
            const loginRes = await authenticateWithServer(email, masterPassword);
            if (loginRes.success) {
              await chrome.storage.session.set({
                token: loginRes.token,
                user: loginRes.user,
                masterPassword: masterPassword
              });
              
              await chrome.storage.local.set({
                cachedUser: { id: loginRes.user.id || loginRes.user._id, name: loginRes.user.name || '', email: loginRes.user.email }
              });

              if (rememberVault) {
                await localDb.saveRememberedSession({
                  token: loginRes.token,
                  user: loginRes.user,
                  masterPassword
                });
                await chrome.storage.local.remove(['token', 'user', 'masterPassword']);
              } else {
                await chrome.storage.local.remove(['token', 'user', 'masterPassword']);
              }
              
              await syncVault();
              await resetAutoLockTimer();
              return { success: true, user: loginRes.user };
            }
            throw new Error('Invalid credentials.');
          }
        }
        case 'LOCK_VAULT': {
          await lockVault({ forgetPersistent: !!message.forgetPersistent });
          return { success: true };
        }
        case 'GET_STATUS': {
          const session = await chrome.storage.session.get(['masterPassword', 'user']);
          const settings = await chrome.storage.local.get(['cachedUser']);
          return { 
            isUnlocked: !!session.masterPassword, 
            user: session.user || settings.cachedUser || null 
          };
        }
        case 'UPDATE_PROFILE': {
          const session = await chrome.storage.session.get(['masterPassword', 'user']);
          if (!session.masterPassword || !session.user?.email) {
            return { success: false, error: 'Vault is locked.' };
          }

          const name = boundedString(message.name, 'Name', { max: 100 });
          const email = boundedString(message.email, 'Email', { required: true, max: 320 }).toLowerCase();
          const emailChanged = email !== session.user.email.toLowerCase();
          const currentPassword = message.currentPassword || '';

          if (emailChanged && currentPassword !== session.masterPassword) {
            return { success: false, error: 'Current password is incorrect.' };
          }

          let vaultEntries;
          if (emailChanged) {
            const vaultResponse = await apiRequest('/vault?trash=all');
            if (!vaultResponse.success || !Array.isArray(vaultResponse.data)) {
              throw new Error(vaultResponse.message || 'Failed to load the encrypted vault.');
            }

            const oldKey = await getMasterKey(session.masterPassword);
            const newKey = await getMasterKeyForEmail(session.masterPassword, email);
            vaultEntries = await Promise.all(vaultResponse.data.map(async (entry) => {
              if (!entry.encryptedData || !entry.iv) {
                throw new Error(`Credential \"${entry.title}\" cannot be re-encrypted.`);
              }

              const plaintext = await decryptSensitiveEntry(entry, oldKey);
              const encrypted = await encryptWithKey(JSON.stringify(plaintext), newKey);
              return {
                id: entry._id,
                encryptedData: encrypted.encryptedData,
                iv: encrypted.iv,
                salt: 'migrated',
              };
            }));
          }

          const profileResponse = await apiRequest('/auth/profile', 'PATCH', {
            name,
            email,
            vaultEntries,
          });

          if (!profileResponse.success || !profileResponse.user) {
            throw new Error(profileResponse.message || 'Failed to update profile.');
          }

          await chrome.storage.session.set({
            token: profileResponse.token,
            user: profileResponse.user,
          });
          await chrome.storage.local.set({
            cachedUser: {
              id: profileResponse.user.id || profileResponse.user._id,
              name: profileResponse.user.name || '',
              email: profileResponse.user.email,
            },
          });

          const settings = await chrome.storage.local.get(['rememberVault']);
          if (settings.rememberVault) {
            await localDb.saveRememberedSession({
              token: profileResponse.token,
              user: profileResponse.user,
              masterPassword: session.masterPassword,
            });
          }

          if (emailChanged) await syncVault();
          await resetAutoLockTimer();
          return { success: true, user: profileResponse.user, token: profileResponse.token };
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
            await localDb.clearRememberedSession();
            await chrome.storage.local.remove(['token', 'user', 'masterPassword']);
          } else {
            const session = await chrome.storage.session.get(['token', 'user', 'masterPassword']);
            if (session.masterPassword) {
              await localDb.saveRememberedSession({
                token: session.token,
                user: session.user,
                masterPassword: session.masterPassword
              });
              await chrome.storage.local.set({ vaultExplicitlyLocked: false });
              await chrome.storage.local.remove(['token', 'user', 'masterPassword']);
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

          for (const entry of rawEntries) {
            try {
              if (entry.encryptedData && entry.iv && entry.salt) {
                const plaintext = await decryptWithKey(entry.encryptedData, entry.iv, masterKey);
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
        case 'AUTOFILL_ENTRY': {
          const id = credentialId(message.id);
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab?.id || !activeTab.url) throw new Error('No active website tab was found.');

          if (!parseSiteIdentity(activeTab.url)) throw new Error('The active tab is not a supported website.');

          const session = await chrome.storage.session.get(['masterPassword', 'encryptedEntries', 'focusedFrame']);
          if (!session.masterPassword) return { success: false, error: 'Vault is locked.' };
          const entries = await loadEncryptedEntries(session.encryptedEntries);
          const entry = entries.find(candidate => String(candidate._id) === id);
          if (!entry) return { success: false, error: 'Credential was not found in the unlocked vault.' };

          const masterKey = await getMasterKey(session.masterPassword);
          const sensitive = await decryptSensitiveEntry(entry, masterKey);
          const focusedFrame = session.focusedFrame;
          const frameId = focusedFrame && focusedFrame.tabId === activeTab.id &&
            Date.now() - focusedFrame.timestamp < 30000 ? focusedFrame.frameId : 0;
          const response = await chrome.tabs.sendMessage(activeTab.id, {
            action: 'AUTOFILL_CREDENTIALS',
            username: sensitive.username || '',
            password: sensitive.password || '',
          }, { frameId });
          if (!response?.success) return { success: false, error: 'No suitable login fields were found.' };
          await resetAutoLockTimer();
          return { success: true };
        }
        case 'GET_MATCHING_METADATA': {
          const session = await chrome.storage.session.get(['masterPassword', 'encryptedEntries']);
          if (!session.masterPassword) {
            return { success: false, error: 'Vault is locked.' };
          }
          const pageSite = getSenderSite(sender);
          const entries = await matchingEntriesForSite(pageSite.origin, session);
          const masterKey = await getMasterKey(session.masterPassword);
          const credentials = [];

          for (const entry of entries) {
            try {
              const sensitive = await decryptSensitiveEntry(entry, masterKey);
              credentials.push({
                id: entry._id,
                title: entry.title,
                website: entry.website,
                category: entry.category || 'General',
                username: sensitive.username || '',
              });
            } catch (err) {
              console.error('Failed to read matching credential metadata:', err);
            }
          }
          return { success: true, credentials };
        }
        case 'GET_CREDENTIAL_FOR_FILL': {
          const id = credentialId(message.id);
          const session = await chrome.storage.session.get(['masterPassword', 'encryptedEntries']);
          if (!session.masterPassword) return { success: false, error: 'Vault is locked.' };

          const pageSite = getSenderSite(sender);
          const entries = await matchingEntriesForSite(pageSite.origin, session);
          const entry = entries.find(candidate => String(candidate._id) === id);
          if (!entry) return { success: false, error: 'Credential is not valid for this site.' };

          const masterKey = await getMasterKey(session.masterPassword);
          const sensitive = await decryptSensitiveEntry(entry, masterKey);
          await resetAutoLockTimer();
          return {
            success: true,
            credential: {
              id: entry._id,
              username: sensitive.username || '',
              password: sensitive.password || '',
            },
          };
        }
        case 'CHECK_CREDENTIAL_FOR_SAVE': {
          const username = boundedString(message.username, 'Username', { max: 1000, trim: false });
          const password = boundedString(message.password, 'Password', { required: true, trim: false });
          const session = await chrome.storage.session.get(['masterPassword', 'encryptedEntries']);
          if (!session.masterPassword) return { success: false, error: 'Vault is locked.' };

          const pageSite = getSenderSite(sender);
          const entries = await matchingEntriesForSite(pageSite.origin, session);
          const masterKey = await getMasterKey(session.masterPassword);
          let usernameMatch = null;

          for (const entry of entries) {
            try {
              const sensitive = await decryptSensitiveEntry(entry, masterKey);
              const sameUsername = (sensitive.username || '').toLowerCase() === username.toLowerCase();
              if (sameUsername && sensitive.password === password) {
                return { success: true, exactMatch: true, usernameMatch: null };
              }
              if (sameUsername && !usernameMatch) {
                usernameMatch = {
                  id: entry._id,
                  title: entry.title,
                  website: entry.website,
                  category: entry.category || 'General',
                  username: sensitive.username || '',
                };
              }
            } catch (err) {
              console.error('Failed to compare a matching credential:', err);
            }
          }
          return { success: true, exactMatch: false, usernameMatch };
        }
        case 'QUEUE_PENDING_CREDENTIAL': {
          const session = await chrome.storage.session.get(['masterPassword', 'encryptedEntries']);
          return writePendingCredential(message.data || {}, session, sender);
        }
        case 'GET_PENDING_CREDENTIALS': {
          const session = await chrome.storage.session.get(['masterPassword']);
          if (!session.masterPassword) return { success: false, error: 'Vault is locked.' };
          const masterKey = await getMasterKey(session.masterPassword);
          return { success: true, credentials: await readPendingCredentials(masterKey) };
        }
        case 'UPDATE_PENDING_CREDENTIAL': {
          const session = await chrome.storage.session.get(['masterPassword']);
          if (!session.masterPassword) return { success: false, error: 'Vault is locked.' };
          const id = boundedString(message.id, 'Pending credential ID', { required: true, max: 100 });
          const records = await localDb.getAllPending();
          const record = records.find(item => item.id === id);
          if (!record) return { success: false, error: 'Pending credential not found.' };
          const masterKey = await getMasterKey(session.masterPassword);
          const current = JSON.parse(await decryptWithKey(record.encryptedData, record.iv, masterKey));
          const next = { ...current, ...(message.data || {}) };
          const username = boundedString(next.username, 'Username', { max: 1000, trim: false });
          const password = boundedString(next.password, 'Password', { max: MAX_FIELD_LENGTH, trim: false });
          const encrypted = await encryptWithKey(JSON.stringify({ ...next, username, password }), masterKey);
          await localDb.putPending({ ...record, encryptedData: encrypted.encryptedData, iv: encrypted.iv, title: next.title, updatedAt: Date.now() });
          return { success: true };
        }
        case 'DELETE_PENDING_CREDENTIAL': {
          const id = boundedString(message.id, 'Pending credential ID', { required: true, max: 100 });
          await localDb.deletePending(id);
          return { success: true };
        }
        case 'SAVE_CREDENTIAL': {
          const session = await chrome.storage.session.get(['masterPassword']);
          if (!session.masterPassword) {
            return { success: false, error: 'Vault is locked.' };
          }

          if (!message.data || typeof message.data !== 'object') throw new Error('Credential data is required.');
          const title = boundedString(message.data.title, 'Title', { required: true, max: 200 });
          const username = boundedString(message.data.username, 'Username', { max: 1000, trim: false });
          const password = boundedString(message.data.password, 'Password', { required: true, trim: false });
          const category = boundedString(message.data.category || 'General', 'Category', { max: 100 });
          const notes = boundedString(message.data.notes, 'Notes', { trim: false });
          const website = isContentScriptSender(sender)
            ? getSenderSite(sender).origin
            : boundedString(message.data.website, 'Website', { required: true, max: 2048 });
          if (!parseSiteIdentity(website)) throw new Error('A valid HTTP(S) website is required.');
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
          const session = await chrome.storage.session.get(['masterPassword', 'encryptedEntries']);
          if (!session.masterPassword) {
            return { success: false, error: 'Vault is locked.' };
          }

          if (!message.data || typeof message.data !== 'object') throw new Error('Credential data is required.');
          const id = credentialId(message.data.id);
          const title = boundedString(message.data.title, 'Title', { required: true, max: 200 });
          const username = boundedString(message.data.username, 'Username', { max: 1000, trim: false });
          const password = boundedString(message.data.password, 'Password', { required: true, trim: false });
          const category = boundedString(message.data.category || 'General', 'Category', { max: 100 });
          const notes = boundedString(message.data.notes, 'Notes', { trim: false });
          let website = boundedString(message.data.website, 'Website', { required: true, max: 2048 });
          if (isContentScriptSender(sender)) {
            const senderSite = getSenderSite(sender);
            const matchingEntries = await matchingEntriesForSite(senderSite.origin, session);
            const existingEntry = matchingEntries.find(candidate => String(candidate._id) === id);
            if (!existingEntry) throw new Error('Credential is not valid for this site.');
            website = existingEntry.website;
          }
          if (!parseSiteIdentity(website)) throw new Error('A valid HTTP(S) website is required.');
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
          const id = credentialId(message.id);
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
          const id = credentialId(message.id);
          const favRes = await apiRequest(`/vault/${id}/favorite`, 'PATCH');
          if (favRes.success) {
            await syncVault();
            return { success: true, entry: favRes.data };
          }
          throw new Error(favRes.message || 'Failed to toggle favorite.');
        }
        case 'USER_ACTIVITY': {
          await resetAutoLockTimer();
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
