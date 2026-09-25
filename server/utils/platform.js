/**
 * Validates if an origin belongs to a Chrome or Firefox browser extension.
 * Extension origins have an opaque host identifier and no credentials,
 * port, or path. This intentionally does not allow arbitrary web origins.
 * @param {string} origin
 * @returns {boolean}
 */
export const isBrowserExtensionOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    const isSupportedProtocol = parsed.protocol === 'chrome-extension:' || parsed.protocol === 'moz-extension:';

    return (
      isSupportedProtocol &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      (parsed.pathname === '/' || parsed.pathname === '')
    );
  } catch {
    return false;
  }
};
