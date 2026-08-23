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
function getInputHint(input) {
  const labelledBy = (input.getAttribute('aria-labelledby') || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(id => document.getElementById(id)?.textContent || '')
    .join(' ');
  const labelText = input.closest('label')?.textContent || '';

  return [
    input.type,
    input.name,
    input.id,
    input.autocomplete,
    input.getAttribute('aria-label'),
    input.getAttribute('placeholder'),
    labelledBy,
    labelText,
  ].filter(Boolean).join(' ').toLowerCase();
}

function isUsernameLikeInput(input) {
  if (!input || input.disabled || input.readOnly) return false;

  const type = (input.type || 'text').toLowerCase();
  if (!['text', 'email', 'tel'].includes(type)) return false;

  const autocomplete = (input.autocomplete || '').toLowerCase();
  if (autocomplete === 'username' || autocomplete === 'email') return true;
  if (type === 'email') return true;

  return /\b(email|e-mail|username|user\s*name|login|user\s*id|userid|account)\b/.test(getInputHint(input));
}

function trackDetectedPair(pair) {
  const existing = detectedInputs.find(candidate =>
    (pair.password && candidate.password === pair.password) ||
    (pair.username && candidate.username === pair.username)
  );

  if (!existing) {
    detectedInputs.push(pair);
    setupInputListeners(pair);
    return;
  }

  const newInputs = [];
  if (!existing.password && pair.password) {
    existing.password = pair.password;
    newInputs.push(pair.password);
  }
  if (!existing.username && pair.username) {
    existing.username = pair.username;
    newInputs.push(pair.username);
  }
  if (newInputs.length > 0) setupInputListeners(existing, newInputs);
}

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

  detectedInputs = detectedInputs.filter(pair => pair.password?.isConnected || pair.username?.isConnected);
  const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));
  const usernameInputs = Array.from(document.querySelectorAll('input')).filter(isUsernameLikeInput);

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

  // Many modern login pages use a two-step flow: the email/username field is
  // rendered first and the password field appears only after Continue/Next.
  // Track those username-only fields so suggestions are available on step one.
  usernameInputs.forEach(usernameInput => {
    if (!newDetected.some(pair => pair.username === usernameInput)) {
      newDetected.push({ password: null, username: usernameInput });
    }
  });

  // Track state changes to add overlay triggers
  newDetected.forEach(trackDetectedPair);

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
function setupInputListeners(pair, inputs = [pair.password, pair.username].filter(Boolean)) {

  inputs.forEach(input => {
    // Show icon on focus or hover
    input.addEventListener('focus', async () => {
      chrome.runtime.sendMessage({ action: 'SET_FOCUSED_FRAME' }).catch(() => {});
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

// ──── Automatic local capture / pending inbox ────
function isCredentialContext(pair) {
  const form = pair?.password?.form || pair?.username?.form;
  const context = [
    form?.innerText || '',
    form?.getAttribute?.('aria-label') || '',
    form?.getAttribute?.('name') || '',
    pair?.username ? getInputHint(pair.username) : '',
    pair?.password ? getInputHint(pair.password) : '',
  ].join(' ').toLowerCase();
  if (/\b(otp|one[- ]?time|verification|security code|captcha|cvv|card number|search)\b/.test(context)) return false;
  return /\b(log[ -]?in|sign[ -]?in|sign[ -]?up|register|password|username|email|account|continue|next|submit)\b/.test(context);
}

function showAutoSaveToast(message) {
  initShadowDom();
  const oldToast = shadowRoot.querySelector('.vg-autosave-toast');
  if (oldToast) oldToast.remove();
  const toast = document.createElement('div');
  toast.className = 'vg-autosave-toast';
  toast.textContent = message;
  shadowRoot.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

async function queueAutoSaveCandidate(username, password, pair) {
  if (!pair || !isCredentialContext(pair)) return;
  const cleanUsername = (username || '').trim();
  const cleanPassword = password || '';
  if (!cleanUsername && !cleanPassword) return;
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'QUEUE_PENDING_CREDENTIAL',
      data: {
        username: cleanUsername,
        password: cleanPassword,
        title: document.title || window.location.hostname,
      },
    });
    if (response?.success && !response.duplicate) {
      showAutoSaveToast(`New credential saved — ${response.pendingCount || 1} pending`);
    }
  } catch (err) {
    console.warn('VaultGuard could not queue local autosave candidate:', err);
  }
}

async function savePendingSubmit(username, password, pair) {
  await queueAutoSaveCandidate(username, password, pair);
}

async function checkPendingCredentialOnLoad() {
  // Pending credentials are now encrypted in the inbox immediately. Nothing
  // sensitive is carried through redirects or sent to the server here.
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
    detectedInputs.filter(pair => {
      const fieldForm = pair.password?.form || pair.username?.form;
      return !fieldForm || fieldForm === e.target;
    }).forEach(pair => {
      const uVal = pair.username ? pair.username.value : lastTypedUsername;
      const pVal = pair.password ? pair.password.value : lastTypedPassword;
      savePendingSubmit(uVal, pVal, pair);
    });
  }, true);

  // Intercept button clicks that act as submit triggers
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, input[type="submit"], input[type="button"], [role="button"], [class*="btn"], [class*="button"]');
    if (btn) {
      const text = (btn.innerText || btn.value || '').toLowerCase();
      if (text.includes('log in') || text.includes('signin') || text.includes('submit') || text.includes('register') || text.includes('sign up') || text.includes('continue') || text.includes('next')) {
        setTimeout(() => {
          detectedInputs.filter(pair => {
            const fieldForm = pair.password?.form || pair.username?.form;
            return !btn.form || fieldForm === btn.form;
          }).forEach(pair => {
            const uVal = pair.username ? pair.username.value : lastTypedUsername;
            const pVal = pair.password ? pair.password.value : lastTypedPassword;
            savePendingSubmit(uVal, pVal, pair);
          });
        }, 100);
      }
    }
  }, true);
}

// ──── Autofill Handler from Extension Popup ────
function autofillCredentials(username, password) {
  scanForInputs();

  const isVisible = (input) => {
    if (!input || !input.isConnected || input.disabled || input.readOnly) return false;
    const style = window.getComputedStyle(input);
    const rect = input.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' &&
      rect.width > 0 && rect.height > 0;
  };

  const active = document.activeElement;
  let pair = detectedInputs.find(candidate =>
    candidate.username === active || candidate.password === active
  );

  if (!pair) {
    pair = detectedInputs.find(candidate => isVisible(candidate.password) &&
      (!candidate.username || isVisible(candidate.username)));
  }

  if (!pair) {
    const scope = active?.form || document;
    const passwordInput = Array.from(scope.querySelectorAll('input[type="password"]'))
      .find(isVisible);
    if (passwordInput) {
      const candidates = Array.from(scope.querySelectorAll('input'))
        .filter(input => ['text', 'email', 'tel'].includes((input.type || '').toLowerCase()))
        .filter(isVisible);
      pair = { password: passwordInput, username: candidates[0] || null };
    }
  }

  if (!pair) return false;
  let filled = false;
  if (pair.username && username && isVisible(pair.username)) {
    setInputValue(pair.username, username);
    filled = true;
  }
  if (pair.password && password && isVisible(pair.password)) {
    setInputValue(pair.password, password);
    filled = true;
  }
  return filled;
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
