import { NativeBiometric } from 'capacitor-native-biometric';
import { localDb } from './localDb';

export const mobileAuth = {
  /**
   * Checks if biometric unlock (fingerprint/FaceID) is available on the device.
   * @returns {Promise<boolean>}
   */
  async checkBiometricAvailable() {
    try {
      const result = await NativeBiometric.isAvailable();
      return !!result.isAvailable;
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

      await NativeBiometric.verifyIdentity({
        reason: "Unlock your VaultGuard secure database",
        title: "Biometric Unlock",
        subtitle: "Scan your fingerprint or face to unlock your vault",
        description: "Provide your biometric credentials to access your passwords.",
        negativeButtonText: "Cancel"
      });
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
      await NativeBiometric.setCredentials({
        username: email,
        password: password,
        server: "vaultguard.auth",
        useBiometrics: true
      });
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
      const isAvailable = await this.checkBiometricAvailable();
      if (!isAvailable) return null;

      const credentials = await NativeBiometric.getCredentials({
        username: email,
        server: "vaultguard.auth"
      });
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
      await NativeBiometric.deleteCredentials({
        username: email,
        server: "vaultguard.auth"
      });
    } catch (err) {
      console.error('Failed to clear biometric credentials:', err);
    }
  },

  /**
   * Save password in IndexedDB user metadata (for Keep Unlocked).
   */
  async saveAutoUnlockPassword(password) {
    return await localDb.saveAutoUnlockPassword(password);
  },

  /**
   * Load password from IndexedDB.
   */
  async getAutoUnlockPassword() {
    return await localDb.getAutoUnlockPassword();
  },

  /**
   * Delete password from IndexedDB.
   */
  async clearAutoUnlockPassword() {
    return await localDb.clearAutoUnlockPassword();
  }
};
