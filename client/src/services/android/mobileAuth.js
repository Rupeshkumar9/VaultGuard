import { localDb } from './localDb';
import { vaultBridge } from './vaultBridge';

let biometricLoadPromise = null;

export const mobileAuth = {
  async getBiometricStatus() {
    try {
      return await vaultBridge.isBiometricAvailable();
    } catch (err) {
      console.warn('Biometrics not available on this device:', err);
      return { isAvailable: false, status: 'unsupported' };
    }
  },

  async hasBiometricCredentials(email) {
    if (!email) return false;
    try {
      const result = await vaultBridge.hasBiometricCredentials(email);
      return !!result?.isConfigured;
    } catch (err) {
      console.warn('Biometric credentials are not configured:', err);
      return false;
    }
  },

  /**
   * Checks if biometric unlock (fingerprint/FaceID) is available on the device.
   * @returns {Promise<boolean>}
   */
  async checkBiometricAvailable() {
    const result = await this.getBiometricStatus();
    return !!result?.isAvailable;
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
    if (!email || !password) throw new Error('Email and password are required for biometric enrollment.');
    return vaultBridge.saveBiometricCredentials(email, password);
  },

  /**
   * Prompt biometric validation and load the master password from native Keychain/KeyStore.
   * @param {string} email 
   * @returns {Promise<string|null>}
   */
  async loadSecureCredentials(email) {
    if (!email) throw new Error('Account email is required for biometric unlock.');
    if (biometricLoadPromise) return biometricLoadPromise;

    const currentLoad = (async () => {
      const status = await vaultBridge.isBiometricAvailable();
      if (!status?.isAvailable) return null;
      const credentials = await vaultBridge.loadBiometricCredentials();
      if (!credentials?.password || credentials.username?.toLowerCase() !== email.toLowerCase()) {
        throw new Error('No biometric credentials are configured for this account.');
      }
      return credentials.password;
    })();
    biometricLoadPromise = currentLoad;

    try {
      return await currentLoad;
    } finally {
      if (biometricLoadPromise === currentLoad) biometricLoadPromise = null;
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
