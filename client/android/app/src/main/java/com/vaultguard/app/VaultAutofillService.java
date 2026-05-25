package com.vaultguard.app;

import android.app.assist.AssistStructure;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.Dataset;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
import android.service.autofill.FillResponse;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveRequest;
import android.view.View;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class VaultAutofillService extends AutofillService {

    private static final String PREFS_FILE = "vaultguard_secure_prefs";
    private static final String KEY_ENTRIES = "decrypted_entries";

    private static final Map<String, String> PACKAGE_TO_DOMAIN = new HashMap<>();
    static {
        PACKAGE_TO_DOMAIN.put("com.facebook.katana", "facebook.com");
        PACKAGE_TO_DOMAIN.put("com.facebook.orca", "facebook.com");
        PACKAGE_TO_DOMAIN.put("com.instagram.android", "instagram.com");
        PACKAGE_TO_DOMAIN.put("com.twitter.android", "twitter.com");
        PACKAGE_TO_DOMAIN.put("com.google.android.gms", "google.com");
        PACKAGE_TO_DOMAIN.put("com.netflix.mediaclient", "netflix.com");
        PACKAGE_TO_DOMAIN.put("com.github.android", "github.com");
        PACKAGE_TO_DOMAIN.put("com.spotify.music", "spotify.com");
        PACKAGE_TO_DOMAIN.put("com.linkedin.android", "linkedin.com");
        PACKAGE_TO_DOMAIN.put("com.whatsapp", "whatsapp.com");
        PACKAGE_TO_DOMAIN.put("com.amazon.mShop.android.shopping", "amazon.com");
    }

    private SharedPreferences getEncryptedPrefs() {
        try {
            Context context = getApplicationContext();
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

    @Override
    public void onFillRequest(FillRequest request, CancellationSignal cancellationSignal, FillCallback callback) {
        List<FillContext> contexts = request.getFillContexts();
        if (contexts == null || contexts.isEmpty()) {
            callback.onSuccess(null);
            return;
        }

        // Get the latest AssistStructure
        AssistStructure structure = contexts.get(contexts.size() - 1).getStructure();
        String packageName = structure.getActivityComponent().getPackageName();

        // Traverse the node tree to find autofill targets
        AutofillFields autofillFields = new AutofillFields();
        int windowCount = structure.getWindowNodeCount();
        for (int i = 0; i < windowCount; i++) {
            AssistStructure.WindowNode windowNode = structure.getWindowNodeAt(i);
            findAutofillNodes(windowNode.getRootViewNode(), autofillFields);
        }

        // We need at least a username or a password field to perform autofill
        if (autofillFields.usernameId == null && autofillFields.passwordId == null) {
            callback.onSuccess(null);
            return;
        }

        // Fetch decrypted entries from securely stored shared preferences
        SharedPreferences prefs = getEncryptedPrefs();
        if (prefs == null) {
            callback.onSuccess(null);
            return;
        }

        String rawEntriesJson = prefs.getString(KEY_ENTRIES, null);
        if (rawEntriesJson == null || rawEntriesJson.isEmpty()) {
            callback.onSuccess(null);
            return;
        }

        try {
            JSONArray entries = new JSONArray(rawEntriesJson);
            FillResponse.Builder responseBuilder = new FillResponse.Builder();
            int datasetCount = 0;

            for (int i = 0; i < entries.length(); i++) {
                JSONObject entry = entries.getJSONObject(i);
                String website = entry.optString("website", "");
                String title = entry.optString("title", "Credential");
                String username = entry.optString("username", "");
                String password = entry.optString("password", "");

                if (isMatch(website, autofillFields.webUrl, packageName)) {
                    Dataset.Builder datasetBuilder = new Dataset.Builder();

                    // Create remote views presentation for UI dropdown suggestion
                    RemoteViews presentation = createPresentation(title, username);

                    if (autofillFields.usernameId != null && !username.isEmpty()) {
                        datasetBuilder.setValue(autofillFields.usernameId, AutofillValue.forText(username), presentation);
                    }
                    if (autofillFields.passwordId != null && !password.isEmpty()) {
                        datasetBuilder.setValue(autofillFields.passwordId, AutofillValue.forText(password), presentation);
                    }

                    responseBuilder.addDataset(datasetBuilder.build());
                    datasetCount++;
                    
                    // Cap suggestions at 5 items to keep it clean
                    if (datasetCount >= 5) break;
                }
            }

            if (datasetCount > 0) {
                callback.onSuccess(responseBuilder.build());
            } else {
                callback.onSuccess(null);
            }
        } catch (Exception e) {
            e.printStackTrace();
            callback.onSuccess(null);
        }
    }

    @Override
    public void onSaveRequest(SaveRequest request, SaveCallback callback) {
        // We do not handle save requests from native autofill in this version
        callback.onSuccess();
    }

    private static class AutofillFields {
        AutofillId usernameId = null;
        AutofillId passwordId = null;
        String webUrl = null;
    }

    private void findAutofillNodes(AssistStructure.ViewNode node, AutofillFields fields) {
        if (node == null) return;

        // Check for web URL in browser nodes
        String webDomain = node.getWebDomain();
        if (webDomain != null && !webDomain.isEmpty()) {
            fields.webUrl = webDomain;
        }

        // Check node hints
        String[] hints = node.getAutofillHints();
        if (hints != null) {
            for (String hint : hints) {
                if (hint.equalsIgnoreCase(View.AUTOFILL_HINT_USERNAME) ||
                    hint.equalsIgnoreCase(View.AUTOFILL_HINT_EMAIL_ADDRESS)) {
                    fields.usernameId = node.getAutofillId();
                } else if (hint.equalsIgnoreCase(View.AUTOFILL_HINT_PASSWORD)) {
                    fields.passwordId = node.getAutofillId();
                }
            }
        }

        // Fallback checks using resource ID and class name
        if (node.getClassName() != null && node.getClassName().toString().contains("EditText")) {
            String resId = node.getIdEntry();
            if (resId != null) {
                String resIdLower = resId.toLowerCase();
                if (resIdLower.contains("username") || resIdLower.contains("email") || resIdLower.contains("login")) {
                    if (fields.usernameId == null) fields.usernameId = node.getAutofillId();
                } else if (resIdLower.contains("password") || resIdLower.contains("pass")) {
                    if (fields.passwordId == null) fields.passwordId = node.getAutofillId();
                }
            }
        }

        // Traverse tree recursively
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            findAutofillNodes(node.getChildAt(i), fields);
        }
    }

    private boolean isMatch(String website, String pageDomain, String packageName) {
        if (website == null || website.isEmpty()) return false;

        String websiteLower = website.toLowerCase();

        // 1. Direct package map match
        if (packageName != null) {
            String mappedDomain = PACKAGE_TO_DOMAIN.get(packageName.toLowerCase());
            if (mappedDomain != null && websiteLower.contains(mappedDomain)) {
                return true;
            }
        }

        // 2. Web domain match
        if (pageDomain != null && !pageDomain.isEmpty()) {
            String cleanPageDomain = pageDomain.replace("www.", "").toLowerCase();
            String cleanWebsite = websiteLower.replace("https://", "").replace("http://", "").replace("www.", "");
            int slashIdx = cleanWebsite.indexOf('/');
            if (slashIdx != -1) {
                cleanWebsite = cleanWebsite.substring(0, slashIdx);
            }
            if (cleanWebsite.equals(cleanPageDomain) || cleanWebsite.contains(cleanPageDomain) || cleanPageDomain.contains(cleanWebsite)) {
                return true;
            }
        }

        // 3. Keyword package fallback match (e.g. website has "facebook" and package has "facebook")
        if (packageName != null) {
            String cleanPackage = packageName.toLowerCase();
            String cleanWebsite = websiteLower.replace("https://", "").replace("http://", "").replace("www.", "");
            int slashIdx = cleanWebsite.indexOf('/');
            if (slashIdx != -1) {
                cleanWebsite = cleanWebsite.substring(0, slashIdx);
            }
            int dotIdx = cleanWebsite.indexOf('.');
            if (dotIdx != -1) {
                String baseWord = cleanWebsite.substring(0, dotIdx);
                if (baseWord.length() > 3 && cleanPackage.contains(baseWord)) {
                    return true;
                }
            }
        }

        return false;
    }

    private RemoteViews createPresentation(String title, String username) {
        RemoteViews presentation = new RemoteViews(getPackageName(), android.R.layout.simple_list_item_1);
        String label = title + " (" + (username.isEmpty() ? "No Username" : username) + ")";
        presentation.setTextViewText(android.R.id.text1, label);
        return presentation;
    }
}
