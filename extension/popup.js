// ──── State and DOM Cache ────
let currentCategory = 'All';
let searchQuery = '';
let allEntries = [];
let matchingCredentials = [];
let activeTabUrl = '';

// DOM Screens
const screenLocked = document.getElementById('screen-locked');
const screenUnlocked = document.getElementById('screen-unlocked');

// Locked Screen Elements
const lockForm = document.getElementById('lock-form');
const lockEmail = document.getElementById('lock-email');
const lockPassword = document.getElementById('lock-password');
const btnVisitRegister = document.getElementById('btn-visit-register');
const toggleServerConfig = document.getElementById('toggle-server-config');
const serverConfigPanel = document.getElementById('server-config-panel');
const serverUrlInput = document.getElementById('server-url');
const saveServerBtn = document.getElementById('save-server-btn');

// Dashboard Elements
const lockVaultBtn = document.getElementById('lock-vault-btn');
const matchingBanner = document.getElementById('matching-banner');
const matchingWebsiteText = document.getElementById('matching-website-text');
const matchingFilterBtn = document.getElementById('matching-filter-btn');
const vaultSearch = document.getElementById('vault-search');
const searchClearBtn = document.getElementById('search-clear-btn');
const vaultEntriesList = document.getElementById('vault-entries-list');
const categoryPills = document.querySelectorAll('.pill');

// Modal Elements
const entryDetailModal = document.getElementById('entry-detail-modal');
const detailTitle = document.getElementById('detail-title');
const detailTitleInput = document.getElementById('detail-title-input');
const detailCategory = document.getElementById('detail-category');
const detailCategorySelect = document.getElementById('detail-category-select');
const detailWebsite = document.getElementById('detail-website');
const detailWebsiteInput = document.getElementById('detail-website-input');
const detailUsername = document.getElementById('detail-username');
const detailUsernameInput = document.getElementById('detail-username-input');
const detailPasswordInput = document.getElementById('detail-password-input');
const toggleDetailPassBtn = document.getElementById('toggle-detail-pass-btn');
const detailNotes = document.getElementById('detail-notes');
const detailNotesInput = document.getElementById('detail-notes-input');
const closeDetailBtn = document.getElementById('close-detail-btn');
const editDetailBtn = document.getElementById('edit-detail-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');
const detailEditActions = document.getElementById('detail-edit-actions');

// Add Credential Elements
const addEntryBtn = document.getElementById('add-entry-btn');
const addEntryModal = document.getElementById('add-entry-modal');
const closeAddModalBtn = document.getElementById('close-add-modal-btn');
const addEntryForm = document.getElementById('add-entry-form');
const addTitleInput = document.getElementById('add-title');
const addCategorySelect = document.getElementById('add-category');
const addWebsiteInput = document.getElementById('add-website');
const addUsernameInput = document.getElementById('add-username');
const addPasswordInput = document.getElementById('add-password');
const toggleAddPassBtn = document.getElementById('toggle-add-pass-btn');
const addNotesInput = document.getElementById('add-notes');
const cancelAddBtn = document.getElementById('cancel-add-btn');
const saveAddBtn = document.getElementById('save-add-btn');

// Edit Mode State variables
let activeEditingEntry = null;
let isEditMode = false;

// Tab Navigation Elements
const navTabs = document.querySelectorAll('.nav-tab');
const tabGenerator = document.getElementById('tab-generator');
const tabSettings = document.getElementById('tab-settings');

// Generator Elements
const genPasswordInput = document.getElementById('gen-password');
const btnCopyGen = document.getElementById('btn-copy-gen');
const genStrengthIndicator = document.getElementById('gen-strength-indicator');
const genStrengthText = document.getElementById('gen-strength-text');
const genLengthInput = document.getElementById('gen-length');
const genLengthVal = document.getElementById('gen-length-val');
const genUpperCb = document.getElementById('gen-upper');
const genLowerCb = document.getElementById('gen-lower');
const genNumbersCb = document.getElementById('gen-numbers');
const genSymbolsCb = document.getElementById('gen-symbols');
const btnGenerate = document.getElementById('btn-generate');

// Settings Elements
const settingsUserEmail = document.getElementById('settings-user-email');
const settingsServerUrl = document.getElementById('settings-server-url');
const settingsLockTimeout = document.getElementById('settings-lock-timeout');
const settingsSyncBtn = document.getElementById('settings-sync-btn');
const settingsLogoutBtn = document.getElementById('settings-logout-btn');
const btnVisitDashboard = document.getElementById('btn-visit-dashboard');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// ──── Initialize and Check Session ────
document.addEventListener('DOMContentLoaded', async () => {
  // Let the background script know the user is active in the extension popup
  chrome.runtime.sendMessage({ action: 'USER_ACTIVITY' }).catch(() => {});

  // Load configured Server URL in lock view
  const serverConfig = await chrome.runtime.sendMessage({ action: 'GET_SERVER_URL' });
  serverUrlInput.value = serverConfig.serverUrl;
  settingsServerUrl.value = serverConfig.serverUrl;

  // Load lock timeout setting
  const timeoutConfig = await chrome.runtime.sendMessage({ action: 'GET_LOCK_TIMEOUT' });
  settingsLockTimeout.value = timeoutConfig.lockTimeout;

  // Check vault status
  await checkVaultStatus();
  
  // Get active tab URL to check for matching credentials
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      activeTabUrl = tab.url;
      // If unlocked, check matches now
      const status = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
      if (status.isUnlocked) {
        await checkMatchingCredentials();
      }
    }
  } catch (err) {
    console.error('Failed to query active tab:', err);
  }
});

// Check lock state and display screens
async function checkVaultStatus() {
  const status = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
  if (status.isUnlocked) {
    screenLocked.classList.remove('active');
    screenUnlocked.classList.add('active');
    settingsUserEmail.textContent = status.user ? status.user.email : 'user@domain.com';
    await loadVaultEntries();
    await checkMatchingCredentials();
  } else {
    screenUnlocked.classList.remove('active');
    screenLocked.classList.add('active');
    // Hide modal and tab panels if visible
    hideAllTabPanels();
    entryDetailModal.classList.add('hidden');
  }
}

// ──── Toast Notifications ────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast flex-row toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <span style="font-weight:bold;margin-left:12px;cursor:pointer;">&times;</span>
  `;
  
  // Close toast on click
  toast.addEventListener('click', () => {
    toast.classList.add('toast-fadeOut');
    setTimeout(() => toast.remove(), 200);
  });

  toastContainer.appendChild(toast);

  // Auto remove after 3s
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('toast-fadeOut');
      setTimeout(() => toast.remove(), 200);
    }
  }, 3000);
}

// ──── Tab Routing ────
navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.getAttribute('data-tab');
    
    // Manage active classes
    navTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    hideAllTabPanels();
    
    if (tabName === 'generator') {
      tabGenerator.classList.remove('hidden');
      generatePassword();
    } else if (tabName === 'settings') {
      tabSettings.classList.remove('hidden');
    }
    // 'vault' defaults back to the mainUnlocked screen under tab panels
  });
});

function hideAllTabPanels() {
  tabGenerator.classList.add('hidden');
  tabSettings.classList.add('hidden');
}

// ──── Server Config Panel ────
toggleServerConfig.addEventListener('click', () => {
  serverConfigPanel.classList.toggle('expanded');
});

saveServerBtn.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim() || 'http://localhost:5000';
  await chrome.runtime.sendMessage({ action: 'SET_SERVER_URL', serverUrl: url });
  settingsServerUrl.value = url;
  showToast('Server connection saved!');
  serverConfigPanel.classList.remove('expanded');
});

// ──── Unlock Vault ────
lockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = lockEmail.value.trim();
  const masterPassword = lockPassword.value;
  
  const unlockBtnText = document.querySelector('#unlock-btn span');
  unlockBtnText.textContent = 'Decrypting...';
  
  try {
    const res = await chrome.runtime.sendMessage({
      action: 'UNLOCK_VAULT',
      email,
      masterPassword
    });
    
    if (res.success) {
      lockPassword.value = '';
      showToast('Vault Unlocked!');
      await checkVaultStatus();
    } else {
      showToast(res.error || 'Failed to unlock vault.', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to server.', 'error');
  } finally {
    unlockBtnText.textContent = 'Unlock Vault';
  }
});

// ──── Lock Vault ────
lockVaultBtn.addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ action: 'LOCK_VAULT' });
  if (res.success) {
    showToast('Vault Locked.');
    await checkVaultStatus();
  }
});

// ──── Load and Filter Vault Entries ────
async function loadVaultEntries() {
  const res = await chrome.runtime.sendMessage({ action: 'GET_ENTRIES' });
  if (res.success) {
    allEntries = res.entries;
    renderEntries();
  } else {
    vaultEntriesList.innerHTML = `
      <div class="no-entries">
        <p style="color:var(--danger-color);">${res.error || 'Failed to fetch vault data.'}</p>
      </div>
    `;
  }
}

function renderEntries(filterDomain = '') {
  let filtered = allEntries;

  // 1. Filter by category
  if (currentCategory !== 'All') {
    if (currentCategory === 'Logins') {
      filtered = filtered.filter(e => e.category === 'Social Media' || e.category === 'Emails' || e.category === 'General' || e.category === 'Entertainment');
    } else if (currentCategory === 'Cards') {
      filtered = filtered.filter(e => e.category === 'Banking' || e.category === 'Credit Cards');
    } else if (currentCategory === 'Notes') {
      filtered = filtered.filter(e => e.category === 'Secure Notes' || e.category === 'Notes');
    }
  }

  // 2. Filter by search query
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(e => 
      e.title.toLowerCase().includes(query) || 
      (e.website && e.website.toLowerCase().includes(query)) ||
      (e.username && e.username.toLowerCase().includes(query))
    );
  }

  // 3. Filter by domain (clicked from matching banner)
  if (filterDomain) {
    const domain = filterDomain.toLowerCase();
    filtered = filtered.filter(e => e.website && e.website.toLowerCase().includes(domain));
  }

  // Render to DOM
  if (filtered.length === 0) {
    vaultEntriesList.innerHTML = `
      <div class="no-entries">
        <p>No matching credentials found.</p>
      </div>
    `;
    return;
  }

  vaultEntriesList.innerHTML = '';
  filtered.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'vault-item flex-row';
    
    // Avatar first letter
    const firstLetter = (entry.title || 'V').charAt(0).toUpperCase();
    
    item.innerHTML = `
      <div class="item-left flex-row">
        <div class="item-avatar flex-col flex-center">${firstLetter}</div>
        <div class="item-details flex-col">
          <span class="item-title truncate">${entry.title}</span>
          <span class="item-username truncate">${entry.username || 'No Username'}</span>
        </div>
      </div>
      <div class="item-right-actions flex-row">
        ${entry.password ? `
          <button class="btn-copy icon-btn-sm tooltip" data-tooltip="Copy Pass" data-copy="${entry.password}">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        ` : ''}
        <button class="btn-view icon-btn-sm tooltip" data-tooltip="Details">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </button>
      </div>
    `;

    // Click handler to open details modal
    item.addEventListener('click', (e) => {
      // Don't open details if they clicked copy button
      if (e.target.closest('.btn-copy')) return;
      openDetailModal(entry);
    });

    // Copy password button handler
    const copyBtn = item.querySelector('.btn-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(entry.password);
        showToast('Password copied to clipboard!');
        // Update last used
        chrome.runtime.sendMessage({ action: 'USER_ACTIVITY' }).catch(() => {});
      });
    }

    vaultEntriesList.appendChild(item);
  });
}

// ──── Matching Tab Credentials ────
async function checkMatchingCredentials() {
  if (!activeTabUrl) return;
  const res = await chrome.runtime.sendMessage({
    action: 'GET_MATCHING_CREDENTIALS',
    url: activeTabUrl
  });

  if (res.success && res.credentials && res.credentials.length > 0) {
    matchingCredentials = res.credentials;
    // Extract domain for display
    let displayDomain = '';
    try {
      const url = new URL(activeTabUrl);
      displayDomain = url.hostname.replace('www.', '');
    } catch (e) {
      displayDomain = 'this site';
    }
    
    matchingWebsiteText.textContent = `Logins found for ${displayDomain}`;
    matchingFilterBtn.textContent = `View (${matchingCredentials.length})`;
    matchingBanner.classList.remove('hidden');
  } else {
    matchingBanner.classList.add('hidden');
  }
}

// Filter vault when clicking the matching suggestions badge
matchingFilterBtn.addEventListener('click', () => {
  let displayDomain = '';
  try {
    const url = new URL(activeTabUrl);
    displayDomain = url.hostname.replace('www.', '');
    renderEntries(displayDomain);
    showToast(`Showing matches for ${displayDomain}`);
  } catch (e) {
    renderEntries();
  }
});

// ──── Search and Filter pills ────
vaultSearch.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  if (searchQuery) {
    searchClearBtn.classList.remove('hidden');
  } else {
    searchClearBtn.classList.add('hidden');
  }
  renderEntries();
});

searchClearBtn.addEventListener('click', () => {
  vaultSearch.value = '';
  searchQuery = '';
  searchClearBtn.classList.add('hidden');
  renderEntries();
});

categoryPills.forEach(pill => {
  pill.addEventListener('click', () => {
    categoryPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentCategory = pill.getAttribute('data-category');
    renderEntries();
  });
});

// ──── Detail Modal ────
function toggleEditMode(enable) {
  isEditMode = enable;
  const copyBtns = entryDetailModal.querySelectorAll('.btn-copy-field');

  if (enable) {
    // Show input fields
    detailTitleInput.classList.remove('hidden');
    detailCategorySelect.classList.remove('hidden');
    detailWebsiteInput.classList.remove('hidden');
    detailUsernameInput.classList.remove('hidden');
    detailNotesInput.classList.remove('hidden');
    detailEditActions.classList.remove('hidden');

    // Hide display texts
    detailTitle.classList.add('hidden');
    detailCategory.classList.add('hidden');
    detailWebsite.classList.add('hidden');
    detailUsername.classList.add('hidden');
    detailNotes.classList.add('hidden');
    
    // Hide edit trigger button and copy buttons
    editDetailBtn.classList.add('hidden');
    copyBtns.forEach(btn => btn.classList.add('hidden'));

    // Enable editing password
    detailPasswordInput.removeAttribute('readonly');
    detailPasswordInput.classList.add('editable-input-active');
  } else {
    // Hide input fields
    detailTitleInput.classList.add('hidden');
    detailCategorySelect.classList.add('hidden');
    detailWebsiteInput.classList.add('hidden');
    detailUsernameInput.classList.add('hidden');
    detailNotesInput.classList.add('hidden');
    detailEditActions.classList.add('hidden');

    // Show display texts
    detailTitle.classList.remove('hidden');
    detailCategory.classList.remove('hidden');
    detailWebsite.classList.remove('hidden');
    detailUsername.classList.remove('hidden');
    detailNotes.classList.remove('hidden');
    
    // Show edit trigger button and copy buttons
    editDetailBtn.classList.remove('hidden');
    copyBtns.forEach(btn => btn.classList.remove('hidden'));

    // Disable editing password
    detailPasswordInput.setAttribute('readonly', 'true');
    detailPasswordInput.classList.remove('editable-input-active');
  }
}

function openDetailModal(entry) {
  activeEditingEntry = entry;

  // Populate display texts
  detailTitle.textContent = entry.title;
  detailCategory.textContent = entry.category || 'General';
  detailWebsite.textContent = entry.website || 'No website URL';
  detailUsername.textContent = entry.username || 'No username';
  detailPasswordInput.value = entry.password || '';
  detailNotes.textContent = entry.notes || 'No notes.';

  // Populate edit fields
  detailTitleInput.value = entry.title || '';
  detailCategorySelect.value = entry.category || 'General';
  detailWebsiteInput.value = entry.website || '';
  detailUsernameInput.value = entry.username || '';
  detailNotesInput.value = entry.notes || '';

  // Reset eye toggle to hidden password
  detailPasswordInput.type = 'password';
  
  // Wire copy buttons inside modal
  const copyBtns = entryDetailModal.querySelectorAll('.btn-copy-field');
  copyBtns.forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn); // remove old listeners
    
    newBtn.addEventListener('click', () => {
      const field = newBtn.getAttribute('data-field');
      let val = '';
      if (field === 'website') val = activeEditingEntry.website;
      else if (field === 'username') val = activeEditingEntry.username;
      else if (field === 'password') val = activeEditingEntry.password;
      
      navigator.clipboard.writeText(val);
      showToast(`${field.charAt(0).toUpperCase() + field.slice(1)} copied!`);
    });
  });

  toggleEditMode(false);
  entryDetailModal.classList.remove('hidden');
}

closeDetailBtn.addEventListener('click', () => {
  toggleEditMode(false);
  entryDetailModal.classList.add('hidden');
});

// Edit Button Handler
editDetailBtn.addEventListener('click', () => {
  toggleEditMode(true);
});

// Cancel Edit Button Handler
cancelEditBtn.addEventListener('click', () => {
  if (activeEditingEntry) {
    detailTitleInput.value = activeEditingEntry.title || '';
    detailCategorySelect.value = activeEditingEntry.category || 'General';
    detailWebsiteInput.value = activeEditingEntry.website || '';
    detailUsernameInput.value = activeEditingEntry.username || '';
    detailPasswordInput.value = activeEditingEntry.password || '';
    detailNotesInput.value = activeEditingEntry.notes || '';
  }
  toggleEditMode(false);
});

// Save Edit Button Handler
saveEditBtn.addEventListener('click', async () => {
  if (!activeEditingEntry) return;

  const title = detailTitleInput.value.trim();
  const category = detailCategorySelect.value;
  const website = detailWebsiteInput.value.trim();
  const username = detailUsernameInput.value.trim();
  const password = detailPasswordInput.value;
  const notes = detailNotesInput.value.trim();

  if (!title) {
    showToast('Title is required!', 'error');
    return;
  }

  saveEditBtn.textContent = 'Saving...';
  saveEditBtn.disabled = true;

  try {
    const res = await chrome.runtime.sendMessage({
      action: 'UPDATE_CREDENTIAL',
      data: {
        id: activeEditingEntry._id,
        title,
        website,
        username,
        password,
        category,
        notes
      }
    });

    if (res.success) {
      showToast('Credential updated successfully!');
      
      // Update local copy of entries
      const updatedIndex = allEntries.findIndex(e => e._id === activeEditingEntry._id);
      if (updatedIndex !== -1) {
        allEntries[updatedIndex] = {
          ...allEntries[updatedIndex],
          title,
          website,
          username,
          password,
          category,
          notes
        };
        activeEditingEntry = allEntries[updatedIndex];
      }

      // Re-populate display elements
      detailTitle.textContent = title;
      detailCategory.textContent = category;
      detailWebsite.textContent = website || 'No website URL';
      detailUsername.textContent = username || 'No username';
      detailPasswordInput.value = password;
      detailNotes.textContent = notes || 'No notes.';

      toggleEditMode(false);
      renderEntries();
      await checkMatchingCredentials();
    } else {
      showToast(res.error || 'Failed to update credential.', 'error');
    }
  } catch (err) {
    showToast('Error communicating with background.', 'error');
    console.error(err);
  } finally {
    saveEditBtn.textContent = 'Save Changes';
    saveEditBtn.disabled = false;
  }
});

// Toggle password visibility in modal
toggleDetailPassBtn.addEventListener('click', () => {
  if (detailPasswordInput.type === 'password') {
    detailPasswordInput.type = 'text';
  } else {
    detailPasswordInput.type = 'password';
  }
});

// ──── Add Entry Modal Handlers ────
addEntryBtn.addEventListener('click', () => {
  // Clear previous values
  addTitleInput.value = '';
  addCategorySelect.value = 'General';
  addWebsiteInput.value = '';
  addUsernameInput.value = '';
  addPasswordInput.value = '';
  addNotesInput.value = '';
  addPasswordInput.type = 'password';

  // Pre-fill active tab URL and generate title
  if (activeTabUrl && (activeTabUrl.startsWith('http://') || activeTabUrl.startsWith('https://'))) {
    addWebsiteInput.value = activeTabUrl;
    try {
      const url = new URL(activeTabUrl);
      let host = url.hostname.replace('www.', '');
      let pageTitle = host.charAt(0).toUpperCase() + host.slice(1);
      const dotIdx = pageTitle.indexOf('.');
      if (dotIdx !== -1) pageTitle = pageTitle.substring(0, dotIdx);
      addTitleInput.value = pageTitle;
    } catch (e) {
      console.error('Failed to parse active tab URL for title:', e);
    }
  }

  addEntryModal.classList.remove('hidden');
});

closeAddModalBtn.addEventListener('click', () => {
  addEntryModal.classList.add('hidden');
});

cancelAddBtn.addEventListener('click', () => {
  addEntryModal.classList.add('hidden');
});

toggleAddPassBtn.addEventListener('click', () => {
  if (addPasswordInput.type === 'password') {
    addPasswordInput.type = 'text';
  } else {
    addPasswordInput.type = 'password';
  }
});

addEntryForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = addTitleInput.value.trim();
  const category = addCategorySelect.value;
  const website = addWebsiteInput.value.trim();
  const username = addUsernameInput.value.trim();
  const password = addPasswordInput.value;
  const notes = addNotesInput.value.trim();

  if (!title || !password) {
    showToast('Title and Password are required!', 'error');
    return;
  }

  saveAddBtn.textContent = 'Saving...';
  saveAddBtn.disabled = true;

  try {
    const res = await chrome.runtime.sendMessage({
      action: 'SAVE_CREDENTIAL',
      data: {
        title,
        website,
        username,
        password,
        category,
        notes
      }
    });

    if (res.success) {
      showToast('Credential added successfully!');
      addEntryModal.classList.add('hidden');
      await loadVaultEntries();
      await checkMatchingCredentials();
    } else {
      showToast(res.error || 'Failed to save credential.', 'error');
    }
  } catch (err) {
    showToast('Error communicating with background.', 'error');
    console.error(err);
  } finally {
    saveAddBtn.textContent = 'Save Credential';
    saveAddBtn.disabled = false;
  }
});

// ──── Password Generator ────
genLengthInput.addEventListener('input', (e) => {
  genLengthVal.textContent = e.target.value;
  generatePassword();
});

[genUpperCb, genLowerCb, genNumbersCb, genSymbolsCb].forEach(cb => {
  cb.addEventListener('change', generatePassword);
});

btnGenerate.addEventListener('click', generatePassword);

function generatePassword() {
  const length = parseInt(genLengthInput.value, 10);
  const useUpper = genUpperCb.checked;
  const useLower = genLowerCb.checked;
  const useNumbers = genNumbersCb.checked;
  const useSymbols = genSymbolsCb.checked;

  let charset = '';
  if (useUpper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (useLower) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (useNumbers) charset += '0123456789';
  if (useSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (!charset) {
    genPasswordInput.value = '';
    updateStrength(0);
    return;
  }

  let password = '';
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : self.crypto;
  const randomValues = new Uint32Array(length);
  cryptoObj.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }

  genPasswordInput.value = password;
  
  // Entropy strength calculation
  const poolSize = charset.length;
  const entropy = Math.round(length * Math.log2(poolSize));
  updateStrength(entropy);
}

function updateStrength(entropy) {
  let pct = Math.min((entropy / 128) * 100, 100);
  genStrengthIndicator.style.width = `${pct}%`;
  
  if (entropy === 0) {
    genStrengthIndicator.style.backgroundColor = 'transparent';
    genStrengthText.textContent = '-';
  } else if (entropy < 40) {
    genStrengthIndicator.style.backgroundColor = 'var(--danger-color)';
    genStrengthText.textContent = 'Weak (Too short)';
  } else if (entropy < 80) {
    genStrengthIndicator.style.backgroundColor = 'var(--warning-color)';
    genStrengthText.textContent = 'Medium (Decent)';
  } else {
    genStrengthIndicator.style.backgroundColor = 'var(--success-color)';
    genStrengthText.textContent = 'Strong (Excellent)';
  }
}

btnCopyGen.addEventListener('click', () => {
  const val = genPasswordInput.value;
  if (val) {
    navigator.clipboard.writeText(val);
    showToast('Generated password copied!');
  }
});

// ──── Settings Config Panel ────
settingsLockTimeout.addEventListener('change', async () => {
  const timeout = settingsLockTimeout.value;
  await chrome.runtime.sendMessage({ action: 'SET_LOCK_TIMEOUT', lockTimeout: timeout });
  showToast('Inactivity timeout updated!');
});

settingsSyncBtn.addEventListener('click', async () => {
  const syncBtnText = settingsSyncBtn.querySelector('span');
  syncBtnText.textContent = 'Syncing...';
  try {
    const res = await chrome.runtime.sendMessage({ action: 'SYNC_VAULT' });
    if (res.success) {
      showToast('Vault sync completed!');
      await loadVaultEntries();
      await checkMatchingCredentials();
    } else {
      showToast(res.error || 'Sync failed.', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to server.', 'error');
  } finally {
    syncBtnText.textContent = 'Sync Vault Now';
  }
});

settingsLogoutBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'LOCK_VAULT' });
  showToast('Vault locked and logged out.');
  await checkVaultStatus();
});

// ──── Web Redirection Handlers ────
btnVisitRegister.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://vault-guard-xi.vercel.app/register' });
});

btnVisitDashboard.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://vault-guard-xi.vercel.app/' });
});

