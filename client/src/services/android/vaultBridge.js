import { registerPlugin } from '@capacitor/core';

const VaultBridge = registerPlugin('VaultBridge');

export const vaultBridge = {
  async updateVault(entries) {
    try {
      await VaultBridge.updateVault({ entries });
      console.log('Sync to native autofill complete');
      return true;
    } catch (err) {
      console.warn('VaultBridge native plugin not available:', err.message);
      return false;
    }
  },

  async clearVault() {
    try {
      await VaultBridge.clearVault();
      console.log('Cleared native autofill data');
      return true;
    } catch (err) {
      console.warn('VaultBridge native plugin not available:', err.message);
      return false;
    }
  },

  async diagnose() {
    try {
      const result = await VaultBridge.diagnose();
      console.log('VaultBridge diagnosis:', JSON.stringify(result));
      return result;
    } catch (err) {
      console.warn('VaultBridge diagnose not available:', err.message);
      return { status: 'UNAVAILABLE', message: err.message, count: 0 };
    }
  },

  async isAutofillMode() {
    try {
      const result = await VaultBridge.isAutofillMode();
      return result.isAutofill || false;
    } catch (err) {
      console.warn('VaultBridge isAutofillMode not available:', err.message);
      return false;
    }
  },

  async selectCredential(username, password) {
    try {
      await VaultBridge.selectCredential({ username, password });
      return true;
    } catch (err) {
      console.warn('VaultBridge selectCredential not available:', err.message);
      return false;
    }
  }
};

