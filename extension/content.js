// ──── Global Configurations and State ────
let matchingLogins = [];
let detectedInputs = [];
let shadowRoot = null;
let shadowContainer = null;
let activeDropdown = null;
let activeIconOverlays = new Map(); // Map of Input -> Icon Div in shadow
let activeInputForDropdown = null;
let scanScheduled = false;

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

  shadowRoot = shadowContainer.attachShadow({ mode: 'closed' });

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

function setInputValue(input, value) {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function createShieldSvg() {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
  svg.appendChild(path);
  return svg;
}

// ──── DOM Inputs Scanner ────
function scanForInputs() {
  const isVaultGuardApp = document.querySelector('meta[name="vaultguard-app"]');
  const isLoginPage = window.location.pathname.includes('/login') || 
                       window.location.pathname.includes('/register') || 
                       window.location.hash.includes('/login') || 
                       window.location.hash.includes('/register');

  if (isVaultGuardApp && !isLoginPage) {
    cleanupAllOverlays();
    return;
  }

  detectedInputs = detectedInputs.filter(pair => pair.password?.isConnected);
  const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));

  const newDetected = [];

  passwordInputs.forEach(passInput => {
    if (passInput.disabled || passInput.readOnly) return;
    let usernameInput = null;
    const scope = passInput.form || document;
    const allInputs = Array.from(scope.querySelectorAll('input'));

    usernameInput = allInputs.find(input =>
      (input.autocomplete || '').toLowerCase() === 'username' &&
      !input.disabled && !input.readOnly
    ) || null;

    // Fall back to the closest preceding username-like field in the same form.
    const passIndex = allInputs.indexOf(passInput);
    if (!usernameInput && passIndex !== -1) {
      // Look backwards for the closest preceding input that fits username types
      for (let i = passIndex - 1; i >= 0; i--) {
        const input = allInputs[i];
        const type = (input.type || 'text').toLowerCase();
        
        // Match standard credential/username inputs (skip hidden, checkbox, submit, and other password inputs)
        if ((type === 'text' || type === 'email' || type === 'tel') &&
            !input.disabled && !input.readOnly) {
          usernameInput = input;
          break;
        }
      }
    }

    // Never offer an existing password in account creation or password-change fields.
    if ((passInput.autocomplete || '').toLowerCase() === 'new-password') return;

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

function scheduleInputScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  queueMicrotask(() => {
    scanScheduled = false;
    scanForInputs();
  });
}

// Attach event listeners to input pairs
function setupInputListeners(pair) {
  const inputs = [pair.password, pair.username].filter(Boolean);

  inputs.forEach(input => {
    // Show icon on focus or hover
    input.addEventListener('focus', async () => {
      await fetchMatchingLogins();
      repositionOverlays();
      showOverlayIcon(input, pair);
    });

    input.addEventListener('mouseenter', async () => {
      await fetchMatchingLogins();
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
  // If there are no matching credentials, do not display the suggestion icon
  if (matchingLogins.length === 0) {
    if (activeIconOverlays.has(input)) {
      const icon = activeIconOverlays.get(input);
      icon.style.display = 'none';
    }
    return;
  }

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
  
  iconDiv.appendChild(createShieldSvg());

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

  const header = document.createElement('div');
  header.className = 'vg-suggestions-header';
  const headerTitle = document.createElement('span');
  headerTitle.textContent = 'VaultGuard Logins';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.id = 'vg-close-card';
  closeButton.setAttribute('aria-label', 'Close credential suggestions');
  closeButton.textContent = '×';
  header.append(headerTitle, closeButton);
  activeDropdown.appendChild(header);

  if (matchingLogins.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'vg-suggestions-empty';
    empty.textContent = 'No credentials synced for this site.';
    activeDropdown.appendChild(empty);
  } else {
    matchingLogins.forEach((cred) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'vg-suggestion-item';
      item.dataset.credentialId = cred.id;
      const title = document.createElement('div');
      title.className = 'vg-suggestion-title';
      title.textContent = cred.title || 'Untitled login';
      const user = document.createElement('div');
      user.className = 'vg-suggestion-user';
      user.textContent = cred.username || 'No Username';
      item.append(title, user);
      activeDropdown.appendChild(item);
    });
  }
  positionElement(anchorInput, activeDropdown, 'dropdown');
  shadowRoot.appendChild(activeDropdown);

  // Bind close button
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    removeActiveDropdown();
  });

  // Bind item clicks
  const items = activeDropdown.querySelectorAll('.vg-suggestion-item');
  items.forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const response = await chrome.runtime.sendMessage({
        action: 'GET_CREDENTIAL_FOR_FILL',
        id: item.dataset.credentialId,
      });
      if (!response?.success || !response.credential) return;
      const cred = response.credential;

      // Autofill fields
      if (pair.username && cred.username) {
        setInputValue(pair.username, cred.username);
      }

      if (pair.password && cred.password) {
        setInputValue(pair.password, cred.password);
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

function cleanupAllOverlays() {
  activeIconOverlays.forEach((iconDiv) => {
    try { iconDiv.remove(); } catch (e) {}
  });
  activeIconOverlays.clear();
  removeActiveDropdown();
  detectedInputs = [];
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

      await verifyAndPromptSave(username, password);
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
        // If there's no password input on the new page, or we are on a different dashboard path, prompt
        if (passwordInputs.length === 0 || !window.location.href.includes('/login') && !window.location.href.includes('/signin')) {
          await verifyAndPromptSave(pending.username, pending.password);
        }
      }
      
      // Always clear to prevent duplicate alerts
      await chrome.runtime.sendMessage({ action: 'CLEAR_PENDING_CREDENTIAL' });
    }
  } catch (err) {
    console.error('Error checking pending credential on load:', err);
  }
}

async function verifyAndPromptSave(username, password) {
  const result = await chrome.runtime.sendMessage({
    action: 'CHECK_CREDENTIAL_FOR_SAVE',
    username,
    password,
  });
  if (!result?.success || result.exactMatch) return;
  showSaveBanner(username, password, result.usernameMatch || null);
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

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'vg-banner-close';
  closeButton.id = 'vg-banner-close';
  closeButton.setAttribute('aria-label', 'Close save credentials banner');
  closeButton.textContent = '×';

  const left = document.createElement('div');
  left.className = 'vg-banner-left';
  const logo = document.createElement('div');
  logo.className = 'vg-banner-logo';
  logo.appendChild(createShieldSvg());
  const text = document.createElement('div');
  text.className = 'vg-banner-text';
  const titleElement = document.createElement('span');
  titleElement.className = 'vg-banner-title';
  titleElement.textContent = actionText;
  const description = document.createElement('span');
  description.className = 'vg-banner-desc';
  description.textContent = descText;
  text.append(titleElement, description);
  left.append(logo, text);

  const actions = document.createElement('div');
  actions.className = 'vg-banner-actions';
  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'vg-btn vg-btn-cancel';
  dismissButton.id = 'vg-banner-never';
  dismissButton.textContent = 'Not now';
  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'vg-btn vg-btn-save';
  saveButton.id = 'vg-banner-save';
  saveButton.textContent = 'Save';
  actions.append(dismissButton, saveButton);
  banner.append(closeButton, left, actions);

  shadowRoot.appendChild(banner);

  const dismissBanner = () => {
    banner.classList.add('vg-banner-fadeOut');
    setTimeout(() => {
      banner.remove();
    }, 250);
  };

  banner.querySelector('#vg-banner-close').addEventListener('click', dismissBanner);
  banner.querySelector('#vg-banner-never').addEventListener('click', dismissBanner);

  banner.querySelector('#vg-banner-save').addEventListener('click', async () => {
    const saveBtn = banner.querySelector('#vg-banner-save');
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
      if (existingLogin) {
        // Update existing item
        const response = await chrome.runtime.sendMessage({
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
        if (!response?.success) throw new Error(response?.error || 'Update failed.');
      } else {
        // Create new item using webpage document title, falling back to capitalized hostname
        let siteTitle = document.title.trim();
        if (!siteTitle) {
          siteTitle = window.location.hostname.replace('www.', '');
          siteTitle = siteTitle.charAt(0).toUpperCase() + siteTitle.slice(1);
        } else if (siteTitle.length > 50) {
          siteTitle = siteTitle.substring(0, 47) + '...';
        }

        const response = await chrome.runtime.sendMessage({
          action: 'SAVE_CREDENTIAL',
          data: {
            title: siteTitle,
            website: window.location.origin,
            username: username,
            password: password,
            category: 'General'
          }
        });
        if (!response?.success) throw new Error(response?.error || 'Save failed.');
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
      action: 'GET_MATCHING_METADATA'
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
  // Do not run content script inside the VaultGuard application itself, except on login/register pages
  const isVaultGuardApp = document.querySelector('meta[name="vaultguard-app"]');
  const isLoginPage = window.location.pathname.includes('/login') || 
                       window.location.pathname.includes('/register') || 
                       window.location.hash.includes('/login') || 
                       window.location.hash.includes('/register');

  if (isVaultGuardApp && !isLoginPage) {
    console.log('VaultGuard extension content script disabled on this app page.');
    return;
  }

  // Check if there is a pending credential from a previous page redirect
  await checkPendingCredentialOnLoad();
  
  await fetchMatchingLogins();
  scanForInputs();

  // Observe SPA form changes without repeatedly scanning the entire document.
  const observer = new MutationObserver(scheduleInputScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['type', 'autocomplete', 'disabled', 'readonly'],
  });

  // Monitor form submissions
  window.addEventListener('submit', (e) => {
    detectedInputs.filter(pair => !pair.password.form || pair.password.form === e.target).forEach(pair => {
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
          detectedInputs.filter(pair => !btn.form || pair.password.form === btn.form).forEach(pair => {
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

// ──── Autofill Handler from Extension Popup ────
function autofillCredentials(username, password) {
  scanForInputs();
  
  if (detectedInputs.length === 0) {
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));
    const emailOrTextInputs = Array.from(document.querySelectorAll('input')).filter(input => {
      const type = (input.type || '').toLowerCase();
      return type === 'email' || type === 'text';
    });
    
    if (passwordInputs.length > 0) {
      const passInput = passwordInputs[0];
      const usernameInput = emailOrTextInputs[0] || null;
      detectedInputs.push({ password: passInput, username: usernameInput });
    }
  }

  if (detectedInputs.length > 0) {
    let filled = false;
    detectedInputs.forEach(pair => {
      if (pair.username && username) {
        setInputValue(pair.username, username);
        filled = true;
      }
      if (pair.password && password) {
        setInputValue(pair.password, password);
        filled = true;
      }
    });
    return filled;
  }
  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'AUTOFILL_CREDENTIALS') {
    const username = typeof request.username === 'string' ? request.username.slice(0, 2048) : '';
    const password = typeof request.password === 'string' ? request.password.slice(0, 10000) : '';
    const success = autofillCredentials(username, password);
    sendResponse({ success });
    return false;
  }
  return false;
});

// Boot content script
init();
