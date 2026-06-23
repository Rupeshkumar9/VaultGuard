/**
 * Helper utilities for VaultGuard.
 */

/**
 * Extracts clean domain name from a URL string.
 * @param {string} url - The URL string
 * @returns {string} - Clean domain name (e.g. google.com)
 */
export const getDomain = (url) => {
  if (!url) return '';
  try {
    // Add protocol if missing to allow standard URL parsing
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized;
    }
    const parsed = new URL(normalized);
    // Remove www. prefix if present
    return parsed.hostname.replace(/^www\./i, '');
  } catch (e) {
    // Fallback if parsing fails (could be just 'google.com' typed in)
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i);
    return match ? match[1] : url;
  }
};

/**
 * Generates Google Favicon service URL for a given domain/website.
 * @param {string} url - The URL or domain name
 * @returns {string} - Favicon image URL
 */
export const getFaviconUrl = (url) => {
  const domain = getDomain(url);
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
};

/**
 * Formats a date string nicely (e.g., "May 22, 2026").
 * @param {string|Date} date - The date to format
 * @returns {string} - Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Formats relative time (e.g. "2 hours ago", "Yesterday").
 * @param {string|Date} date - The target date
 * @returns {string} - Relative time string
 */
export const formatRelativeTime = (date) => {
  if (!date) return 'Never';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Never';

  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  
  return formatDate(d);
};

/**
 * Checks if two URLs/domains match, taking into account subdomains.
 * @param {string} val1 - First URL or domain
 * @param {string} val2 - Second URL or domain
 * @returns {boolean} - True if domains match
 */
export const domainsMatch = (val1, val2) => {
  if (!val1 || !val2) return false;
  const d1 = getDomain(val1).toLowerCase().trim();
  const d2 = getDomain(val2).toLowerCase().trim();
  if (!d1 || !d2) return false;
  if (d1 === d2) return true;
  if (d1.endsWith('.' + d2) || d2.endsWith('.' + d1)) return true;
  
  const getBaseDomain = (domain) => {
    const parts = domain.split('.');
    if (parts.length <= 2) return domain;
    const sls = ['com', 'co', 'net', 'org', 'gov', 'edu', 'ac', 'mil'];
    const prev = parts[parts.length - 2];
    if (sls.includes(prev) && parts.length > 2) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  };
  
  return getBaseDomain(d1) === getBaseDomain(d2);
};

