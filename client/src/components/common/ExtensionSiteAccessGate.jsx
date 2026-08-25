import React from 'react';
import { isExtension } from '../../utils/platform';

const ALL_SITES = { origins: ['<all_urls>'] };

export default function ExtensionSiteAccessGate() {
  const [isFirefox, setIsFirefox] = React.useState(false);
  const [hasAllSitesAccess, setHasAllSitesAccess] = React.useState(true);
  const [isChecking, setIsChecking] = React.useState(isExtension);
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [error, setError] = React.useState('');

  const activateCurrentTab = React.useCallback(async () => {
    try {
      return await chrome.runtime.sendMessage({ action: 'ENSURE_CONTENT_SCRIPT' });
    } catch (activationError) {
      console.debug('Could not activate VaultGuard in the current tab:', activationError);
      return null;
    }
  }, []);

  React.useEffect(() => {
    if (!isExtension) return undefined;

    let cancelled = false;
    const inspectAccess = async () => {
      await activateCurrentTab();

      try {
        const browserInfo = typeof chrome.runtime.getBrowserInfo === 'function'
          ? await chrome.runtime.getBrowserInfo()
          : null;
        const firefox = /firefox/i.test(browserInfo?.name || '');
        const allowed = !firefox || !chrome.permissions?.contains
          ? true
          : await chrome.permissions.contains(ALL_SITES);

        if (!cancelled) {
          setIsFirefox(firefox);
          setHasAllSitesAccess(allowed);
        }
      } catch (inspectError) {
        console.debug('Could not inspect extension site access:', inspectError);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    void inspectAccess();
    return () => {
      cancelled = true;
    };
  }, [activateCurrentTab]);

  const requestAllSitesAccess = async () => {
    setIsRequesting(true);
    setError('');
    try {
      const granted = await chrome.permissions.request(ALL_SITES);
      if (!granted) {
        setError('Firefox did not grant access. Choose “Always Allow on All Websites” from VaultGuard’s extension permissions.');
        return;
      }

      setHasAllSitesAccess(true);
      await activateCurrentTab();
    } catch (requestError) {
      console.error('Failed to request Firefox site access:', requestError);
      setError('Open Firefox Add-ons → VaultGuard → Permissions and enable access to all websites.');
    } finally {
      setIsRequesting(false);
    }
  };

  const continueForCurrentTab = async () => {
    await activateCurrentTab();
    setDismissed(true);
  };

  if (!isExtension || isChecking || !isFirefox || hasAllSitesAccess || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-bg-dark/95 p-6">
      <div className="w-full rounded-2xl border border-border-dark bg-surface-dark p-5 shadow-2xl">
        <div className="mb-2 text-sm font-bold text-text-primary">Enable automatic autofill</div>
        <p className="mb-4 text-xs leading-5 text-text-secondary">
          Firefox is currently allowing VaultGuard only after you click it. Grant access to all websites so suggestions and credential saving can start automatically.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] leading-4 text-amber-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={requestAllSitesAccess}
          disabled={isRequesting}
          className="w-full rounded-xl bg-gradient-to-r from-accent-teal to-cyan-500 px-4 py-3 text-xs font-bold text-bg-dark disabled:opacity-50"
        >
          {isRequesting ? 'Waiting for Firefox…' : 'Allow on all websites'}
        </button>
        <button
          type="button"
          onClick={continueForCurrentTab}
          className="mt-2 w-full rounded-xl border border-border-dark px-4 py-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
        >
          Continue for this tab only
        </button>
      </div>
    </div>
  );
}
