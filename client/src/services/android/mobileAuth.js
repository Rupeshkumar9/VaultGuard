import { localDb } from './localDb';
import { vaultBridge } from './vaultBridge';

export const mobileAuth = {
  /**
   * Checks if biometric unlock (fingerprint/FaceID) is available on the device.
   * @returns {Promise<boolean>}
   */
  async checkBiometricAvailable() {
    try {
      return await vaultBridge.isBiometricAvailable();
    } catch (err) {
      console.warn('Biometrics not available on this device:', err);
      return false;
    }
  },

  /**
   * Perform biometric fingerprint/FaceID authentication.
   * @returns {Promise<boolean>}
   */
  async verifyBiometricIdentity() {
    try {
      const isAvailable = await this.checkBiometricAvailable();
      if (!isAvailable) return false;

      await vaultBridge.verifyBiometric();
      return true;
    } catch (err) {
      console.error('Biometric authentication failed:', err);
      return false;
    }
  },

  /**
   * Save the master password securely in the native Keychain/KeyStore.
   * @param {string} email 
   * @param {string} password 
   */
  async saveSecureCredentials(email, password) {
    try {
      if (!email || !password) return;
      await vaultBridge.saveBiometricCredentials(email, password);
    } catch (err) {
      console.error('Failed to save biometric credentials:', err);
    }
  },

  /**
   * Prompt biometric validation and load the master password from native Keychain/KeyStore.
   * @param {string} email 
   * @returns {Promise<string|null>}
   */
  async loadSecureCredentials(email) {
    try {
      if (!email) return null;
      if (!(await this.checkBiometricAvailable())) return null;
      const credentials = await vaultBridge.loadBiometricCredentials();
      return credentials?.password || null;
    } catch (err) {
      console.error('Failed to load biometric credentials:', err);
      return null;
    }
  },

  /**
   * Clear biometric credentials from native secure storage.
   * @param {string} email 
   */
  async clearSecureCredentials(email) {
    try {
      if (!email) return;
      await vaultBridge.clearBiometricCredentials();
    } catch (err) {
      console.error('Failed to clear biometric credentials:', err);
    }
  },

  /**
   * Delete any legacy password record from IndexedDB.
   */
  async clearAutoUnlockPassword() {
    return await localDb.clearAutoUnlockPassword();
  }
};
