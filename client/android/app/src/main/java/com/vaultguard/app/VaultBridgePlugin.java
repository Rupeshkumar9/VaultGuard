package com.vaultguard.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Base64;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;

@CapacitorPlugin(name = "VaultBridge")
public class VaultBridgePlugin extends Plugin {

    private static AutofillActivity activeAutofillActivity = null;

    public static void registerAutofillActivity(AutofillActivity activity) {
        activeAutofillActivity = activity;
    }

    public static void unregisterAutofillActivity(AutofillActivity activity) {
        if (activeAutofillActivity == activity) {
            activeAutofillActivity = null;
        }
    }

    private static final String PREFS_FILE = "vaultguard_secure_prefs";
    private static final String KEY_ENTRIES = "decrypted_entries";
    private static final String KEY_PENDING_AUTOSAVE = "pending_autosave";
    private static final String BIOMETRIC_PREFS_FILE = "vaultguard_biometric_store";
    // Versioned so keys created with the previous device-credential policy are
    // never reused with the strong-biometric-only policy below.
    private static final String BIOMETRIC_KEY_ALIAS = "vaultguard_biometric_master_v2";
    private static final String BIOMETRIC_IV = "iv";
    private static final String BIOMETRIC_CIPHERTEXT = "ciphertext";
    private static final String BIOMETRIC_EMAIL = "email";
    private static final int BIOMETRIC_AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_STRONG;
    private final AtomicBoolean biometricOperationInProgress = new AtomicBoolean(false);

    private SharedPreferences getEncryptedPrefs() {
        Context context = getContext().getApplicationContext();
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();
            return EncryptedSharedPreferences.create(
                context,
                PREFS_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (Exception e) {
            android.util.Log.e("VaultBridge", "EncryptedSharedPreferences initialization failed; refusing plaintext fallback", e);
            return null;
        }
    }

    @PluginMethod
    public void updateVault(PluginCall call) {
        JSArray entries = call.getArray("entries");
        if (entries == null) {
            android.util.Log.e("VaultBridge", "updateVault called with missing entries list");
            call.reject("Missing entries list");
            return;
        }

        try {
            SharedPreferences prefs = getEncryptedPrefs();
            if (prefs == null) {
                android.util.Log.e("VaultBridge", "updateVault failed to initialize storage");
                call.reject("Failed to initialize storage");
                return;
            }

            android.util.Log.d("VaultBridge", "Syncing entries count: " + entries.length());
            prefs.edit().putString(KEY_ENTRIES, entries.toString()).apply();
            call.resolve();
        } catch (Exception e) {
            android.util.Log.e("VaultBridge", "updateVault write error", e);
            call.reject("Failed to save entries: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearVault(PluginCall call) {
        try {
            SharedPreferences prefs = getEncryptedPrefs();
            if (prefs != null) {
                android.util.Log.d("VaultBridge", "Clearing native autofill data");
                prefs.edit().remove(KEY_ENTRIES).apply();
            }
            call.resolve();
        } catch (Exception e) {
            android.util.Log.e("VaultBridge", "clearVault error", e);
            call.reject("Failed to clear secure storage: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingCredentials(PluginCall call) {
        try {
            SharedPreferences prefs = getEncryptedPrefs();
            if (prefs == null) {
                call.reject("Failed to initialize secure storage");
                return;
            }
            JSObject result = new JSObject();
            result.put("items", new org.json.JSONArray(prefs.getString(KEY_PENDING_AUTOSAVE, "[]")));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read Auto-Save Inbox", e);
        }
    }

    @PluginMethod
    public void updatePendingCredential(PluginCall call) {
        String id = call.getString("id", null);
        if (id == null || id.isEmpty()) {
            call.reject("Pending credential ID is required");
            return;
        }
        try {
            SharedPreferences prefs = getEncryptedPrefs();
            if (prefs == null) {
                call.reject("Failed to initialize secure storage");
                return;
            }
            org.json.JSONArray items = new org.json.JSONArray(prefs.getString(KEY_PENDING_AUTOSAVE, "[]"));
            JSObject data = call.getObject("data");
            if (data == null) data = new JSObject();
            boolean found = false;
            for (int i = 0; i < items.length(); i++) {
                org.json.JSONObject item = items.getJSONObject(i);
                if (id.equals(item.optString("id", ""))) {
                    for (String key : new String[] {"title", "website", "username", "password", "category"}) {
                        if (data.has(key)) item.put(key, data.get(key));
                    }
                    item.put("updatedAt", System.currentTimeMillis());
                    found = true;
                    break;
                }
            }
            if (!found) {
                call.reject("Pending credential not found");
                return;
            }
            prefs.edit().putString(KEY_PENDING_AUTOSAVE, items.toString()).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update Auto-Save Inbox", e);
        }
    }

    @PluginMethod
    public void deletePendingCredential(PluginCall call) {
        String id = call.getString("id", null);
        if (id == null || id.isEmpty()) {
            call.reject("Pending credential ID is required");
            return;
        }
        try {
            SharedPreferences prefs = getEncryptedPrefs();
            if (prefs == null) {
                call.reject("Failed to initialize secure storage");
                return;
            }
            org.json.JSONArray current = new org.json.JSONArray(prefs.getString(KEY_PENDING_AUTOSAVE, "[]"));
            org.json.JSONArray remaining = new org.json.JSONArray();
            for (int i = 0; i < current.length(); i++) {
                org.json.JSONObject item = current.getJSONObject(i);
                if (!id.equals(item.optString("id", ""))) remaining.put(item);
            }
            prefs.edit().putString(KEY_PENDING_AUTOSAVE, remaining.toString()).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to delete Auto-Save Inbox item", e);
        }
    }

    @PluginMethod
    public void clearPendingCredentials(PluginCall call) {
        try {
            SharedPreferences prefs = getEncryptedPrefs();
            if (prefs != null) prefs.edit().remove(KEY_PENDING_AUTOSAVE).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear Auto-Save Inbox", e);
        }
    }

    @PluginMethod
    public void isBiometricAvailable(PluginCall call) {
        JSObject result = new JSObject();
        if (!(getActivity() instanceof FragmentActivity)) {
            call.resolve(result.put("isAvailable", false).put("status", "unsupported"));
            return;
        }

        int authResult = BiometricManager.from((FragmentActivity) getActivity())
            .canAuthenticate(BIOMETRIC_AUTHENTICATORS);
        result.put("isAvailable", authResult == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("status", biometricStatus(authResult));
        result.put("code", authResult);
        call.resolve(result);
    }

    @PluginMethod
    public void hasBiometricCredentials(PluginCall call) {
        JSObject result = new JSObject().put("isConfigured", false).put("status", "missing");
        String email = call.getString("email", null);
        if (email == null || email.isEmpty()) {
            call.resolve(result.put("status", "invalid_request"));
            return;
        }
        try {
            SharedPreferences prefs = getContext().getApplicationContext()
                .getSharedPreferences(BIOMETRIC_PREFS_FILE, Context.MODE_PRIVATE);
            String storedEmail = prefs.getString(BIOMETRIC_EMAIL, null);
            String iv = prefs.getString(BIOMETRIC_IV, null);
            String ciphertext = prefs.getString(BIOMETRIC_CIPHERTEXT, null);
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            boolean configured = storedEmail != null && email.equalsIgnoreCase(storedEmail)
                && iv != null && !iv.isEmpty() && ciphertext != null && !ciphertext.isEmpty()
                && keyStore.containsAlias(BIOMETRIC_KEY_ALIAS);
            result.put("isConfigured", configured).put("status", configured ? "configured" : "missing");
            call.resolve(result);
        } catch (Exception e) {
            android.util.Log.e("VaultBridge", "Biometric credential check failed", e);
            call.resolve(result.put("status", "invalid"));
        }
    }

    @PluginMethod
    public void verifyBiometric(PluginCall call) {
        if (!(getActivity() instanceof FragmentActivity)) {
            call.reject("Biometric authentication requires an Android activity");
            return;
        }
        if (!beginBiometricOperation(call)) return;

        FragmentActivity activity = (FragmentActivity) getActivity();
        activity.runOnUiThread(() -> {
            try {
                BiometricPrompt prompt = createPrompt(activity,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            finishBiometricOperation();
                            call.resolve();
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            finishBiometricOperation();
                            call.reject(errString.toString());
                        }
                    });
                prompt.authenticate(buildPromptInfo());
            } catch (Exception e) {
                finishBiometricOperation();
                android.util.Log.e("VaultBridge", "Failed to show biometric verification prompt", e);
                call.reject("Failed to start biometric authentication", e);
            }
        });
    }

    @PluginMethod
    public void saveBiometricCredentials(PluginCall call) {
        String email = call.getString("email", null);
        String password = call.getString("password", null);
        if (email == null || email.isEmpty() || password == null || password.isEmpty()) {
            call.reject("Email and password are required");
            return;
        }
        if (!(getActivity() instanceof FragmentActivity)) {
            call.reject("Biometric authentication requires an Android activity");
            return;
        }
        if (!beginBiometricOperation(call)) return;

        try {
            SecretKey key = getOrCreateBiometricKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            FragmentActivity activity = (FragmentActivity) getActivity();
            activity.runOnUiThread(() -> {
                try {
                    BiometricPrompt prompt = createPrompt(activity,
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                                try {
                                    Cipher authenticatedCipher = result.getCryptoObject().getCipher();
                                    byte[] ciphertext = authenticatedCipher.doFinal(password.getBytes(StandardCharsets.UTF_8));
                                    getContext().getApplicationContext().getSharedPreferences(BIOMETRIC_PREFS_FILE, Context.MODE_PRIVATE)
                                        .edit()
                                        .putString(BIOMETRIC_EMAIL, email)
                                        .putString(BIOMETRIC_IV, Base64.encodeToString(authenticatedCipher.getIV(), Base64.NO_WRAP))
                                        .putString(BIOMETRIC_CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                                        .apply();
                                    call.resolve();
                                } catch (Exception e) {
                                    android.util.Log.e("VaultBridge", "Failed to protect biometric credentials", e);
                                    call.reject("Failed to protect biometric credentials", e);
                                } finally {
                                    finishBiometricOperation();
                                }
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                                finishBiometricOperation();
                                call.reject(errString.toString());
                            }
                        });
                    prompt.authenticate(buildPromptInfo(), new BiometricPrompt.CryptoObject(cipher));
                } catch (Exception e) {
                    finishBiometricOperation();
                    android.util.Log.e("VaultBridge", "Failed to show biometric enrollment prompt", e);
                    call.reject("Failed to start biometric enrollment", e);
                }
            });
        } catch (KeyPermanentlyInvalidatedException e) {
            finishBiometricOperation();
            clearBiometricStore();
            call.reject("Biometric credentials expired after a fingerprint change. Please enroll again.");
        } catch (Exception e) {
            finishBiometricOperation();
            android.util.Log.e("VaultBridge", "Failed to initialize biometric enrollment cipher", e);
            call.reject("Failed to initialize biometric storage", e);
        }
    }

    @PluginMethod
    public void loadBiometricCredentials(PluginCall call) {
        if (!(getActivity() instanceof FragmentActivity)) {
            call.reject("Biometric authentication requires an Android activity");
            return;
        }
        if (!beginBiometricOperation(call)) return;

        SharedPreferences prefs = getContext().getApplicationContext().getSharedPreferences(BIOMETRIC_PREFS_FILE, Context.MODE_PRIVATE);
        String email = prefs.getString(BIOMETRIC_EMAIL, null);
        String ivValue = prefs.getString(BIOMETRIC_IV, null);
        String ciphertextValue = prefs.getString(BIOMETRIC_CIPHERTEXT, null);
        if (email == null || ivValue == null || ciphertextValue == null) {
            finishBiometricOperation();
            call.reject("No biometric credentials found");
            return;
        }

        try {
            SecretKey key = getOrCreateBiometricKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key,
                new GCMParameterSpec(128, Base64.decode(ivValue, Base64.NO_WRAP)));
            FragmentActivity activity = (FragmentActivity) getActivity();
            activity.runOnUiThread(() -> {
                try {
                    BiometricPrompt prompt = createPrompt(activity,
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                                try {
                                    Cipher authenticatedCipher = result.getCryptoObject().getCipher();
                                    String password = new String(
                                        authenticatedCipher.doFinal(Base64.decode(ciphertextValue, Base64.NO_WRAP)),
                                        StandardCharsets.UTF_8
                                    );
                                    call.resolve(new JSObject().put("username", email).put("password", password));
                                } catch (Exception e) {
                                    android.util.Log.e("VaultBridge", "Failed to decrypt biometric credentials", e);
                                    call.reject("Failed to decrypt biometric credentials", e);
                                } finally {
                                    finishBiometricOperation();
                                }
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                                finishBiometricOperation();
                                call.reject(errString.toString());
                            }
                        });
                    prompt.authenticate(buildPromptInfo(), new BiometricPrompt.CryptoObject(cipher));
                } catch (Exception e) {
                    finishBiometricOperation();
                    android.util.Log.e("VaultBridge", "Failed to show biometric unlock prompt", e);
                    call.reject("Failed to start biometric unlock", e);
                }
            });
        } catch (KeyPermanentlyInvalidatedException e) {
            finishBiometricOperation();
            clearBiometricStore();
            call.reject("Biometric credentials expired after a fingerprint change. Please enroll again.");
        } catch (Exception e) {
            finishBiometricOperation();
            android.util.Log.e("VaultBridge", "Failed to initialize biometric unlock cipher", e);
            call.reject("Failed to initialize biometric storage", e);
        }
    }

    @PluginMethod
    public void clearBiometricCredentials(PluginCall call) {
        try {
            clearBiometricStore();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear biometric credentials", e);
        }
    }

    private void clearBiometricStore() {
        try {
            getContext().getApplicationContext().getSharedPreferences(BIOMETRIC_PREFS_FILE, Context.MODE_PRIVATE)
                .edit().clear().apply();
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            if (keyStore.containsAlias(BIOMETRIC_KEY_ALIAS)) {
                keyStore.deleteEntry(BIOMETRIC_KEY_ALIAS);
            }
        } catch (Exception e) {
            android.util.Log.e("VaultBridge", "Failed to clear biometric store", e);
        }
    }

    private SecretKey getOrCreateBiometricKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(BIOMETRIC_KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(BIOMETRIC_KEY_ALIAS, null)).getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
            BIOMETRIC_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(
                0,
                KeyProperties.AUTH_BIOMETRIC_STRONG
            );
        } else {
            builder.setUserAuthenticationRequired(true)
                .setUserAuthenticationValidityDurationSeconds(-1)
                .setInvalidatedByBiometricEnrollment(true);
        }

        generator.init(builder.build());
        return generator.generateKey();
    }

    private boolean beginBiometricOperation(PluginCall call) {
        if (biometricOperationInProgress.compareAndSet(false, true)) return true;
        call.reject("Biometric authentication is already in progress");
        return false;
    }

    private void finishBiometricOperation() {
        biometricOperationInProgress.set(false);
    }

    private BiometricPrompt.PromptInfo buildPromptInfo() {
        BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
            .setTitle("Biometric Unlock")
            .setSubtitle("Authenticate to access your VaultGuard credentials")
            .setDescription("Use your enrolled fingerprint or strong biometric.")
            .setAllowedAuthenticators(BIOMETRIC_AUTHENTICATORS)
            .setNegativeButtonText("Cancel");
        return builder.build();
    }

    private String biometricStatus(int result) {
        if (result == BiometricManager.BIOMETRIC_SUCCESS) return "available";
        if (result == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) return "none_enrolled";
        if (result == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE) return "no_hardware";
        if (result == BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE) return "hardware_unavailable";
        return "unsupported";
    }

    private BiometricPrompt createPrompt(
        FragmentActivity activity,
        BiometricPrompt.AuthenticationCallback callback
    ) {
        Executor executor = ContextCompat.getMainExecutor(activity);
        return new BiometricPrompt(activity, executor, callback);
    }

    /**
     * Diagnostic method to verify credentials are stored and readable.
     * Returns the count of stored entries and a preview of the data.
     */
    @PluginMethod
    public void diagnose(PluginCall call) {
        JSObject result = new JSObject();
        try {
            SharedPreferences prefs = getEncryptedPrefs();
            if (prefs == null) {
                result.put("status", "ERROR");
                result.put("message", "Failed to open SharedPreferences");
                result.put("count", 0);
                call.resolve(result);
                return;
            }

            String rawJson = prefs.getString(KEY_ENTRIES, null);
            if (rawJson == null || rawJson.isEmpty()) {
                result.put("status", "EMPTY");
                result.put("message", "No credentials stored in SharedPreferences");
                result.put("count", 0);
            } else {
                org.json.JSONArray entries = new org.json.JSONArray(rawJson);
                result.put("status", "OK");
                result.put("count", entries.length());
                result.put("message", entries.length() + " credentials stored and readable");

                // Include first entry title as preview (no sensitive data)
                if (entries.length() > 0) {
                    org.json.JSONObject first = entries.getJSONObject(0);
                    result.put("firstEntryTitle", first.optString("title", "Unknown"));
                    result.put("firstEntryWebsite", first.optString("website", "None"));
                }
            }
        } catch (Exception e) {
            result.put("status", "ERROR");
            result.put("message", "Exception: " + e.getMessage());
            result.put("count", 0);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void isAutofillMode(PluginCall call) {
        JSObject result = new JSObject();
        boolean isAutofill = (getActivity() instanceof AutofillActivity);
        result.put("isAutofill", isAutofill);
        call.resolve(result);
    }

    @PluginMethod
    public void selectCredential(PluginCall call) {
        final String username = call.getString("username");
        final String password = call.getString("password");

        if (activeAutofillActivity != null) {
            final AutofillActivity activity = activeAutofillActivity;
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    activity.onCredentialSelected(username, password);
                }
            });
            call.resolve();
        } else {
            call.reject("No active Autofill activity found");
        }
    }
}
