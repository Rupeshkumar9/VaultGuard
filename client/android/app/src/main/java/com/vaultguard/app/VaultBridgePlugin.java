package com.vaultguard.app;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VaultBridge")
public class VaultBridgePlugin extends Plugin {

    private static final String PREFS_FILE = "vaultguard_secure_prefs";
    private static final String KEY_ENTRIES = "decrypted_entries";

    private SharedPreferences getEncryptedPrefs() {
        try {
            Context context = getContext();
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
            e.printStackTrace();
            return null;
        }
    }

    @PluginMethod
    public void updateVault(PluginCall call) {
        JSArray entries = call.getArray("entries");
        if (entries == null) {
            call.reject("Missing entries list");
            return;
        }

        try {
            SharedPreferences prefs = getEncryptedPrefs();
            if (prefs == null) {
                call.reject("Failed to initialize secure storage");
                return;
            }

            prefs.edit().putString(KEY_ENTRIES, entries.toString()).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to save entries: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearVault(PluginCall call) {
        try {
            SharedPreferences prefs = getEncryptedPrefs();
            if (prefs != null) {
                prefs.edit().remove(KEY_ENTRIES).apply();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear secure storage: " + e.getMessage());
        }
    }
}
