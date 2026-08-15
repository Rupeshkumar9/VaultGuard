package com.vaultguard.app;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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
            android.util.Log.e("VaultBridge", "EncryptedSharedPreferences failed, falling back to standard SharedPreferences", e);
            return context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE);
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
