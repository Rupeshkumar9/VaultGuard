// ──── Global Configurations and State ────
let matchingLogins = [];
let detectedInputs = [];
let shadowRoot = null;
let shadowContainer = null;
let activeDropdown = null;
let activeIconOverlays = new Map(); // Map of Input -> Icon Div in shadow
let activeInputForDropdown = null;

// Track submitted values to prompt for save
let lastTypedUsername = '';
let lastTypedPassword = '';
let lastTypedPasswordInput = null;
let lastTypedUsernameInput = null;

// ──── Shadow DOM Isolation ────
function initShadowDom() {
  if (shadowContainer) return;

  shadowContainer = document.createElement('div');
  shadowContainer.id = 'vaultguard-extension-root';
  shadowContainer.style.position = 'absolute';
  shadowContainer.style.top = '0';
  shadowContainer.style.left = '0';
  shadowContainer.style.width = '100%';
  shadowContainer.style.height = '0'; // Don't block page interactions
  shadowContainer.style.pointerEvents = 'none'; // Only children have pointer events
  document.body.appendChild(shadowContainer);

  shadowRoot = shadowContainer.attachShadow({ mode: 'open' });

  // Load stylesheet inside Shadow DOM
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('content.css');
  shadowRoot.appendChild(styleLink);

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    // Check if click was inside shadow root
    let clickedInsideShadow = false;
    if (shadowRoot) {
      const path = e.composedPath();
      if (path.includes(shadowContainer)) {
        clickedInsideShadow = true;
      }
    }

    if (!clickedInsideShadow) {
      removeActiveDropdown();
    }
  });

  // Recalculate icon positions on window resize or scroll
  window.addEventListener('resize', repositionOverlays);
  window.addEventListener('scroll', repositionOverlays, { passive: true });
}

// ──── DOM Inputs Scanner ────
function scanForInputs() {
  const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));
  const allInputs = Array.from(document.querySelectorAll('input'));

  const newDetected = [];

  passwordInputs.forEach(passInput => {
    let usernameInput = null;
    
    // Find index of this password input in the document
    const passIndex = allInputs.indexOf(passInput);
    if (passIndex !== -1) {
      // Look backwards for the closest preceding input that fits username types
      for (let i = passIndex - 1; i >= 0; i--) {
        const input = allInputs[i];
        const type = (input.type || 'text').toLowerCase();
        
        // Match standard credential/username inputs (skip hidden, checkbox, submit, and other password inputs)
        if (type === 'text' || type === 'email' || type === 'tel' || type === 'number') {
          usernameInput = input;
          break;
        }
      }
    }

    newDetected.push({
      password: passInput,
      username: usernameInput
    });
  });

  // Track state changes to add overlay triggers
  newDetected.forEach(pair => {
    const isAlreadyTracked = detectedInputs.some(existing => existing.password === pair.password);
    if (!isAlreadyTracked) {
      detectedInputs.push(pair);
      setupInputListeners(pair);
    }
  });

  // Clean up and reposition overlays for SPA dynamically
  repositionOverlays();
}

// Attach event listeners to input pairs
function setupInputListeners(pair) {
  const inputs = [pair.password, pair.username].filter(Boolean);

  inputs.forEach(input => {
    // Show icon on focus or hover
    input.addEventListener('focus', () => {
      repositionOverlays();
      showOverlayIcon(input, pair);
    });

    input.addEventListener('mouseenter', () => {
      showOverlayIcon(input, pair);
    });

    // Save values typed by the user to check if they should be saved later
    input.addEventListener('input', () => {
      if (input.type === 'password') {
        lastTypedPassword = input.value;
        lastTypedPasswordInput = input;
      } else {
        lastTypedUsername = input.value;
        lastTypedUsernameInput = input;
      }
    });

    // Capture Enter key submission
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        setTimeout(() => {
          const uVal = pair.username ? pair.username.value : lastTypedUsername;
          const pVal = pair.password ? pair.password.value : lastTypedPassword;
          savePendingSubmit(uVal, pVal, pair);
        }, 50);
      }
    });
  });
}

// ──── Overlay Icon Placement ────
function showOverlayIcon(input, pair) {
  initShadowDom();

  // If already exists, just show it
  if (activeIconOverlays.has(input)) {
    const icon = activeIconOverlays.get(input);
    icon.style.display = 'flex';
    return;
  }

  const iconDiv = document.createElement('div');
  iconDiv.className = 'vg-input-overlay-icon';
  iconDiv.style.pointerEvents = 'auto'; // allow click
  
  // VaultGuard shield SVG
  iconDiv.innerHTML = `
    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
  `;

  // Position icon overlay
  positionElement(input, iconDiv, 'inside-right');

  // Trigger dropdown on click
  iconDiv.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleSuggestionsDropdown(input, pair);
  });

  shadowRoot.appendChild(iconDiv);
  activeIconOverlays.set(input, iconDiv);
}

function positionElement(target, elem, type) {
  const rect = target.getBoundingClientRect();
  if (type === 'inside-right') {
    elem.style.top = `${rect.top + window.scrollY + (rect.height - 18) / 2}px`;
    elem.style.left = `${rect.left + window.scrollX + rect.width - 24}px`;
  } else if (type === 'dropdown') {
    elem.style.top = `${rect.bottom + window.scrollY + 4}px`;
    elem.style.left = `${rect.left + window.scrollX}px`;
    elem.style.width = `${Math.max(rect.width, 220)}px`;
  }
}

function repositionOverlays() {
  activeIconOverlays.forEach((iconDiv, input) => {
    // If input is no longer visible or detached, remove it
    if (!input.isConnected || input.offsetWidth === 0) {
      iconDiv.remove();
      activeIconOverlays.delete(input);
      return;
    }
    positionElement(input, iconDiv, 'inside-right');
  });

  if (activeDropdown && activeInputForDropdown) {
    if (!activeInputForDropdown.isConnected) {
      removeActiveDropdown();
    } else {
      positionElement(activeInputForDropdown, activeDropdown, 'dropdown');
    }
  }
}

// ──── Suggestions Dropdown ────
function toggleSuggestionsDropdown(anchorInput, pair) {
  if (activeDropdown) {
    removeActiveDropdown();
    if (activeInputForDropdown === anchorInput) {
      activeInputForDropdown = null;
      return;
    }
  }

  activeInputForDropdown = anchorInput;
  activeDropdown = document.createElement('div');
  activeDropdown.className = 'vg-suggestions-card';
  activeDropdown.style.pointerEvents = 'auto';

  // Render suggestion headers
  let html = `<div class="vg-suggestions-header"><span>VaultGuard Logins</span><span style="cursor:pointer;" id="vg-close-card">&times;</span></div>`;

  if (matchingLogins.length === 0) {
    html += `<div class="vg-suggestions-empty">No credentials synced for this site.</div>`;
  } else {
    matchingLogins.forEach((cred, index) => {
      html += `
        <div class="vg-suggestion-item" data-index="${index}">
          <div class="vg-suggestion-title">${cred.title}</div>
          <div class="vg-suggestion-user">${cred.username || 'No Username'}</div>
        </div>
      `;
    });
  }

  activeDropdown.innerHTML = html;
  positionElement(anchorInput, activeDropdown, 'dropdown');
  shadowRoot.appendChild(activeDropdown);

  // Bind close button
  activeDropdown.querySelector('#vg-close-card').addEventListener('click', (e) => {
    e.stopPropagation();
    removeActiveDropdown();
  });

  // Bind item clicks
  const items = activeDropdown.querySelectorAll('.vg-suggestion-item');
  items.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(item.getAttribute('data-index'), 10);
      const cred = matchingLogins[index];
      
      // Autofill fields
      if (pair.username && cred.username) {
        pair.username.value = cred.username;
        pair.username.dispatchEvent(new Event('input', { bubbles: true }));
        pair.username.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      if (pair.password && cred.password) {
        pair.password.value = cred.password;
        pair.password.dispatchEvent(new Event('input', { bubbles: true }));
        pair.password.dispatchEvent(new Event('change', { bubbles: true }));
      }

      removeActiveDropdown();
    });
  });
}

function removeActiveDropdown() {
  if (activeDropdown) {
    activeDropdown.remove();
    activeDropdown = null;
    activeInputForDropdown = null;
  }
}

// ──── Form Submission & Successful Login Heuristics ────
async function savePendingSubmit(username, password, pair) {
  if (!password || password.length < 4) return;
  const cleanUsername = (username || '').trim();

  // Temporarily store in background session (for page reloads / redirects)
  chrome.runtime.sendMessage({
    action: 'SET_PENDING_CREDENTIAL',
    data: {
      username: cleanUsername,
      password: password,
      website: window.location.origin,
      title: document.title || window.location.hostname
    }
  }).catch(() => {});

  // Start checking for SPA (Single Page Application) success in-place (no page reload)
  startSpaSuccessTracker(pair, cleanUsername, password);
}

function startSpaSuccessTracker(pair, username, password) {
  let ticks = 0;
  const originalUrl = window.location.href;
  const originalPath = window.location.pathname;

  const interval = setInterval(async () => {
    ticks++;
    
    // Check up to 15 seconds (30 * 500ms)
    if (ticks > 30) {
      clearInterval(interval);
      return;
    }

    const isPasswordDetached = !pair.password.isConnected || pair.password.offsetWidth === 0 || pair.password.offsetHeight === 0;
    const hasUrlChanged = window.location.href !== originalUrl || window.location.pathname !== originalPath;

    // If login input is gone or URL changed, we assume successful login
    if (isPasswordDetached || hasUrlChanged) {
      clearInterval(interval);

      // Verify that we didn't just fail and reload/stay on login path
      const passwordInputs = document.querySelectorAll('input[type="password"]');
      if (passwordInputs.length > 0 && !hasUrlChanged) {
        // Form is still there, login likely failed or user cleared it
        return;
      }

      await verifyAndPromptSave(username, password, window.location.origin, document.title || window.location.hostname);
      chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_CREDENTIAL' }).catch(() => {});
    }
  }, 500);
}

async function checkPendingCredentialOnLoad() {
  try {
    const res = await chrome.runtime.sendMessage({ action: 'GET_PENDING_CREDENTIAL' });
    if (res && res.success && res.pendingCredential) {
      const pending = res.pendingCredential;
      
      // If it was saved less than 60 seconds ago
      if (Date.now() - pending.timestamp < 60000) {
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        const isSameHost = window.location.origin === pending.website;

        // If there's no password input on the new page, or we are on a different dashboard path, prompt
        if (passwordInputs.length === 0 || !window.location.href.includes('/login') && !window.location.href.includes('/signin')) {
          await verifyAndPromptSave(pending.username, pending.password, pending.website, pending.title);
        }
      }
      
      // Always clear to prevent duplicate alerts
      await chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_CREDENTIAL' });
    }
  } catch (err) {
    console.error('Error checking pending credential on load:', err);
  }
}

async function verifyAndPromptSave(username, password, website, title) {
  // Sync latest matches
  await fetchMatchingLogins();

  // Case A: Exact Match already in vault
  const exactMatch = matchingLogins.some(cred => 
    (cred.username || '').toLowerCase() === username.toLowerCase() && 
    cred.password === password
  );
  if (exactMatch) return; // Credential matches exactly, do not prompt

  // Case B: Same username, different password (Update)
  const usernameMatch = matchingLogins.find(cred => 
    (cred.username || '').toLowerCase() === username.toLowerCase()
  );

  showSaveBanner(username, password, usernameMatch);
}

function showSaveBanner(username, password, existingLogin) {
  initShadowDom();
  
  // Remove existing banner if any
  const oldBanner = shadowRoot.querySelector('.vg-save-banner');
  if (oldBanner) oldBanner.remove();

  const banner = document.createElement('div');
  banner.className = 'vg-save-banner';
  banner.style.pointerEvents = 'auto';

  const actionText = existingLogin ? 'Update password' : 'Save credentials';
  const descText = existingLogin ? `Update password for ${username}?` : `Save login ${username} to VaultGuard?`;

  banner.innerHTML = `
    <div class="vg-banner-left">
      <div class="vg-banner-logo">
        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" fill="none">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      </div>
      <div class="vg-banner-text">
        <span class="vg-banner-title">${actionText}</span>
        <span class="vg-banner-desc">${descText}</span>
      </div>
    </div>
    <div class="vg-banner-actions">
      <button class="vg-btn vg-btn-cancel" id="vg-banner-never">Never</button>
      <button class="vg-btn vg-btn-save" id="vg-banner-save">Save</button>
    </div>
  `;

  shadowRoot.appendChild(banner);

  const dismissBanner = () => {
    banner.classList.add('vg-banner-fadeOut');
    setTimeout(() => {
      banner.remove();
    }, 250);
  };

  banner.querySelector('#vg-banner-never').addEventListener('click', dismissBanner);

  banner.querySelector('#vg-banner-save').addEventListener('click', async () => {
    const saveBtn = banner.querySelector('#vg-banner-save');
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
      if (existingLogin) {
        // Update existing item
        await chrome.runtime.sendMessage({
          action: 'UPDATE_CREDENTIAL',
          data: {
            id: existingLogin.id,
            title: existingLogin.title,
            website: existingLogin.website,
            username: username,
            password: password,
            category: existingLogin.category
          }
        });
      } else {
        // Create new item using webpage document title, falling back to capitalized hostname
        let siteTitle = document.title.trim();
        if (!siteTitle) {
          siteTitle = window.location.hostname.replace('www.', '');
          siteTitle = siteTitle.charAt(0).toUpperCase() + siteTitle.slice(1);
        } else if (siteTitle.length > 50) {
          siteTitle = siteTitle.substring(0, 47) + '...';
        }

        await chrome.runtime.sendMessage({
          action: 'SAVE_CREDENTIAL',
          data: {
            title: siteTitle,
            website: window.location.origin,
            username: username,
            password: password,
            category: 'General'
          }
        });
      }
      
      // Refresh local matching logins
      await fetchMatchingLogins();
      
      // Show success feedback state
      saveBtn.textContent = 'Saved! ✓';
      saveBtn.style.background = '#10b981';
      saveBtn.style.color = '#0c0f12';
      
      // Dismiss banner after 1.2s delay
      setTimeout(dismissBanner, 1200);
    } catch (err) {
      console.error('Failed to auto-save credential:', err);
      saveBtn.textContent = 'Error';
      setTimeout(() => {
        saveBtn.textContent = 'Save';
        saveBtn.disabled = false;
      }, 2000);
    }
  });
}

// ──── Main Fetch Routine ────
async function fetchMatchingLogins() {
  try {
    const res = await chrome.runtime.sendMessage({
      action: 'GET_MATCHING_CREDENTIALS',
      url: window.location.href
    });
    if (res.success) {
      matchingLogins = res.credentials || [];
    }
  } catch (err) {
    matchingLogins = [];
  }
}

// ──── Initial Boot and Listeners ────
async function init() {
  // Do not run content script inside the VaultGuard application itself
  if (document.querySelector('meta[name="vaultguard-app"]')) {
    console.log('VaultGuard extension content script disabled on this app page.');
    return;
  }

  // Check if there is a pending credential from a previous page redirect
  await checkPendingCredentialOnLoad();
  
  await fetchMatchingLogins();
  scanForInputs();

  // Run periodic scans since SPA apps render forms dynamically
  setInterval(scanForInputs, 1500);

  // Monitor form submissions
  window.addEventListener('submit', (e) => {
    detectedInputs.forEach(pair => {
      const uVal = pair.username ? pair.username.value : lastTypedUsername;
      const pVal = pair.password ? pair.password.value : lastTypedPassword;
      if (pVal && pVal.length >= 4) {
        savePendingSubmit(uVal, pVal, pair);
      }
    });
  }, true);

  // Intercept button clicks that act as submit triggers
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, input[type="submit"], input[type="button"], [role="button"], [class*="btn"], [class*="button"]');
    if (btn) {
      const text = (btn.innerText || btn.value || '').toLowerCase();
      if (text.includes('log in') || text.includes('signin') || text.includes('submit') || text.includes('register') || text.includes('sign up') || text.includes('continue') || text.includes('next')) {
        setTimeout(() => {
          detectedInputs.forEach(pair => {
            const uVal = pair.username ? pair.username.value : lastTypedUsername;
            const pVal = pair.password ? pair.password.value : lastTypedPassword;
            if (pVal && pVal.length >= 4) {
              savePendingSubmit(uVal, pVal, pair);
            }
          });
        }, 100);
      }
    }
  }, true);
}

// Boot content script
init();
