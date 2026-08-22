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
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import android.security.keystore.KeyGenParameterSpec;
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
    private static final String BIOMETRIC_PREFS_FILE = "vaultguard_biometric_store";
    private static final String BIOMETRIC_KEY_ALIAS = "vaultguard_biometric_master";
    private static final String BIOMETRIC_IV = "iv";
    private static final String BIOMETRIC_CIPHERTEXT = "ciphertext";
    private static final String BIOMETRIC_EMAIL = "email";

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
    public void isBiometricAvailable(PluginCall call) {
        if (!(getActivity() instanceof FragmentActivity)) {
            call.resolve(new JSObject().put("isAvailable", false));
            return;
        }

        int result = BiometricManager.from((FragmentActivity) getActivity()).canAuthenticate();
        call.resolve(new JSObject().put("isAvailable", result == BiometricManager.BIOMETRIC_SUCCESS));
    }

    @PluginMethod
    public void verifyBiometric(PluginCall call) {
        if (!(getActivity() instanceof FragmentActivity)) {
            call.reject("Biometric authentication requires an Android activity");
            return;
        }

        BiometricPrompt prompt = createPrompt((FragmentActivity) getActivity(),
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    call.resolve();
                }

                @Override
                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                    call.reject(errString.toString());
                }
            });
        prompt.authenticate(buildPromptInfo(false));
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

        try {
            SecretKey key = getOrCreateBiometricKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            BiometricPrompt prompt = createPrompt((FragmentActivity) getActivity(),
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
                            call.reject("Failed to protect biometric credentials", e);
                        }
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        call.reject(errString.toString());
                    }
                });
            prompt.authenticate(buildPromptInfo(true), new BiometricPrompt.CryptoObject(cipher));
        } catch (Exception e) {
            call.reject("Failed to initialize biometric storage", e);
        }
    }

    @PluginMethod
    public void loadBiometricCredentials(PluginCall call) {
        if (!(getActivity() instanceof FragmentActivity)) {
            call.reject("Biometric authentication requires an Android activity");
            return;
        }

        SharedPreferences prefs = getContext().getApplicationContext().getSharedPreferences(BIOMETRIC_PREFS_FILE, Context.MODE_PRIVATE);
        String email = prefs.getString(BIOMETRIC_EMAIL, null);
        String ivValue = prefs.getString(BIOMETRIC_IV, null);
        String ciphertextValue = prefs.getString(BIOMETRIC_CIPHERTEXT, null);
        if (email == null || ivValue == null || ciphertextValue == null) {
            call.reject("No biometric credentials found");
            return;
        }

        try {
            SecretKey key = getOrCreateBiometricKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key,
                new GCMParameterSpec(128, Base64.decode(ivValue, Base64.NO_WRAP)));
            BiometricPrompt prompt = createPrompt((FragmentActivity) getActivity(),
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
                            call.reject("Failed to decrypt biometric credentials", e);
                        }
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        call.reject(errString.toString());
                    }
                });
            prompt.authenticate(buildPromptInfo(true), new BiometricPrompt.CryptoObject(cipher));
        } catch (Exception e) {
            call.reject("Failed to initialize biometric storage", e);
        }
    }

    @PluginMethod
    public void clearBiometricCredentials(PluginCall call) {
        try {
            getContext().getApplicationContext().getSharedPreferences(BIOMETRIC_PREFS_FILE, Context.MODE_PRIVATE)
                .edit().clear().apply();
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            if (keyStore.containsAlias(BIOMETRIC_KEY_ALIAS)) {
                keyStore.deleteEntry(BIOMETRIC_KEY_ALIAS);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear biometric credentials", e);
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
                KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL
            );
        } else {
            builder.setUserAuthenticationRequired(true)
                .setUserAuthenticationValidityDurationSeconds(-1);
        }

        generator.init(builder.build());
        return generator.generateKey();
    }

    private BiometricPrompt.PromptInfo buildPromptInfo(boolean allowDeviceCredential) {
        BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
            .setTitle("Biometric Unlock")
            .setSubtitle("Authenticate to access your VaultGuard credentials")
            .setDescription("Use your fingerprint, face, or device credential.");
        if (allowDeviceCredential) {
            builder.setDeviceCredentialAllowed(true);
        } else {
            builder.setNegativeButtonText("Cancel");
        }
        return builder.build();
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
