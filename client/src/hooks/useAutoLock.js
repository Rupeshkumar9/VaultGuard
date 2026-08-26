import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useCrypto } from '../contexts/CryptoContext';
import { isExtension, isNative } from '../utils/platform';

export const useAutoLock = () => {
  const { isUnlocked, lock } = useCrypto();
  const timerRef = useRef(null);
  const lastMessageSent = useRef(0);
  const backgroundAtRef = useRef(null);
  const lockInFlight = useRef(false);

  useEffect(() => {
    if (!isUnlocked) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const getTimeoutMs = () => {
      const minutes = localStorage.getItem('vaultguard_lock_timeout') || '5';
      const parsed = parseInt(minutes, 10);
      if (isNaN(parsed) || parsed <= 0) return 0; // 0 means "Never"
      return parsed * 60 * 1000;
    };

    const lockVault = () => {
      if (lockInFlight.current) return;
      lockInFlight.current = true;
      Promise.resolve(lock()).finally(() => {
        lockInFlight.current = false;
      });
    };

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      
      const timeoutMs = getTimeoutMs();
      if (timeoutMs === 0) return; // Never lock

      timerRef.current = setTimeout(() => {
        console.log('🔒 Vault auto-locked due to inactivity.');
        lockVault();
      }, timeoutMs);

      // Throttled notification to background script
      if (isExtension) {
        const now = Date.now();
        if (now - lastMessageSent.current > 30 * 1000) {
          lastMessageSent.current = now;
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'USER_ACTIVITY' }).catch(() => {});
          }
        }
      }
    };

    // Events to track user activity
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Initialize timer
    resetTimer();

    // Register event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Listen for custom event when timeout settings are updated in SettingsPage
    const handleTimeoutConfigChange = () => {
      resetTimer();
    };
    window.addEventListener('vaultguard_timeout_changed', handleTimeoutConfigChange);

    // WebView JavaScript timers can be suspended while Android is in the
    // background. Track real elapsed time so a timed-out vault is locked as
    // soon as the app becomes visible again.
    const handleAppActiveChange = (isActive) => {
      if (!isActive) {
        backgroundAtRef.current = Date.now();
        return;
      }
      const backgroundAt = backgroundAtRef.current;
      backgroundAtRef.current = null;
      const timeoutMs = getTimeoutMs();
      if (backgroundAt && timeoutMs > 0 && Date.now() - backgroundAt >= timeoutMs) {
        console.log('🔒 Vault auto-locked after returning from the background.');
        lockVault();
      } else {
        resetTimer();
      }
    };
    const handleVisibilityChange = () => {
      if (!isNative) return;
      handleAppActiveChange(document.visibilityState !== 'hidden');
    };
    let lifecycleDisposed = false;
    let removeAppStateListener = () => {};
    if (isNative) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        handleAppActiveChange(isActive);
      }).then((listener) => {
        if (lifecycleDisposed) listener.remove();
        else removeAppStateListener = () => listener.remove();
      }).catch((error) => {
        console.warn('Native app lifecycle listener unavailable:', error);
      });
    }

    // Clean up
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
      window.removeEventListener('vaultguard_timeout_changed', handleTimeoutConfigChange);
      if (isNative) document.removeEventListener('visibilitychange', handleVisibilityChange);
      lifecycleDisposed = true;
      removeAppStateListener();
    };
  }, [isUnlocked, lock]);
};
