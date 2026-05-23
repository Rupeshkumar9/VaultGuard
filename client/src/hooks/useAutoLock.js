import { useEffect, useRef } from 'react';
import { useCrypto } from '../contexts/CryptoContext';

export const useAutoLock = () => {
  const { isUnlocked, lock } = useCrypto();
  const timerRef = useRef(null);

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

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      
      const timeoutMs = getTimeoutMs();
      if (timeoutMs === 0) return; // Never lock

      timerRef.current = setTimeout(() => {
        console.log('🔒 Vault auto-locked due to inactivity.');
        lock();
      }, timeoutMs);
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

    // Clean up
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
      window.removeEventListener('vaultguard_timeout_changed', handleTimeoutConfigChange);
    };
  }, [isUnlocked, lock]);
};
