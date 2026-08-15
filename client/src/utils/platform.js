import { Capacitor } from '@capacitor/core';
export const isNative = Capacitor.isNativePlatform();
export const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
