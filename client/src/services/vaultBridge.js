import { registerPlugin } from '@capacitor/core';

const VaultBridge = registerPlugin('VaultBridge');

export const vaultBridge = {
  async updateVault(entries, aesKeyBase64) {
    try {
      await VaultBridge.updateVault({
        entries,
        aesKey: aesKeyBase64
      });
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
  }
};
