import { getSiteHostname, parseSiteIdentity, sitesMatch } from './siteIdentity';

/**
 * Helper utilities for VaultGuard.
 */

/**
 * Extracts clean domain name from a URL string.
 * @param {string} url - The URL string
 * @returns {string} - Clean domain name (e.g. google.com)
 */
export const getDomain = (url) => {
  return getSiteHostname(url);
};

/**
 * Remote favicon services disclose every saved hostname to a third party.
 * Return no remote URL so callers use their built-in generic site icon.
 */
export const getFaviconUrl = () => '';

/**
 * Return a navigable HTTP(S) URL for a saved website, or an empty string for
 * malformed/untrusted values. This prevents saved text from becoming a
 * javascript:, data:, or other dangerous link in the UI.
 */
export const getSafeWebsiteUrl = (value) => {
  if (!parseSiteIdentity(value)) return '';
  try {
    const raw = value.trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
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
  return sitesMatch(val1, val2);
};
