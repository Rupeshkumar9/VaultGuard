package com.vaultguard.app;

import android.app.assist.AssistStructure;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.Dataset;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
import android.service.autofill.FillResponse;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveRequest;
import android.text.InputType;
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

    private static final String TAG = "VaultAutofill";
    private static final String PREFS_FILE = "vaultguard_secure_prefs";
    private static final String KEY_ENTRIES = "decrypted_entries";

    // Map well-known native app package names to their website domains
    private static final Map<String, String> PACKAGE_TO_DOMAIN = new HashMap<>();
    static {
        PACKAGE_TO_DOMAIN.put("com.facebook.katana", "facebook.com");
        PACKAGE_TO_DOMAIN.put("com.facebook.orca", "facebook.com");
        PACKAGE_TO_DOMAIN.put("com.instagram.android", "instagram.com");
        PACKAGE_TO_DOMAIN.put("com.twitter.android", "twitter.com");
        PACKAGE_TO_DOMAIN.put("com.google.android.gm", "google.com");
        PACKAGE_TO_DOMAIN.put("com.google.android.gms", "google.com");
        PACKAGE_TO_DOMAIN.put("com.netflix.mediaclient", "netflix.com");
        PACKAGE_TO_DOMAIN.put("com.github.android", "github.com");
        PACKAGE_TO_DOMAIN.put("com.spotify.music", "spotify.com");
        PACKAGE_TO_DOMAIN.put("com.linkedin.android", "linkedin.com");
        PACKAGE_TO_DOMAIN.put("com.whatsapp", "whatsapp.com");
        PACKAGE_TO_DOMAIN.put("com.amazon.mShop.android.shopping", "amazon.com");
        PACKAGE_TO_DOMAIN.put("com.reddit.frontpage", "reddit.com");
        PACKAGE_TO_DOMAIN.put("com.snapchat.android", "snapchat.com");
        PACKAGE_TO_DOMAIN.put("com.pinterest", "pinterest.com");
        PACKAGE_TO_DOMAIN.put("com.discord", "discord.com");
        PACKAGE_TO_DOMAIN.put("com.tumblr", "tumblr.com");
        PACKAGE_TO_DOMAIN.put("tv.twitch.android.app", "twitch.tv");
        PACKAGE_TO_DOMAIN.put("com.microsoft.teams", "teams.microsoft.com");
        PACKAGE_TO_DOMAIN.put("com.Slack", "slack.com");
        PACKAGE_TO_DOMAIN.put("com.dropbox.android", "dropbox.com");
        PACKAGE_TO_DOMAIN.put("com.paypal.android.p2pmobile", "paypal.com");
        PACKAGE_TO_DOMAIN.put("com.zhiliaoapp.musically", "tiktok.com");
    }

    // Known browser package names (exact match for reliability)
    private static final String[] BROWSER_PACKAGES = {
        "com.android.chrome",
        "org.mozilla.firefox",
        "com.opera.browser",
        "com.opera.mini.native",
        "com.microsoft.emmx",
        "com.brave.browser",
        "com.duckduckgo.mobile.android",
        "com.sec.android.app.sbrowser",
        "com.vivaldi.browser",
        "org.chromium.chrome",
        "com.UCMobile.intl",
        "com.kiwibrowser.browser"
    };

    private SharedPreferences getEncryptedPrefs() {
        Context context = getApplicationContext();
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
            android.util.Log.e(TAG, "EncryptedSharedPreferences failed, falling back to standard SharedPreferences", e);
            return context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE);
        }
    }

    private boolean isBrowser(String packageName) {
        if (packageName == null) return false;
        String pkg = packageName.toLowerCase();
        for (String browser : BROWSER_PACKAGES) {
            if (pkg.equals(browser)) return true;
        }
        return false;
    }

    @Override
    public void onFillRequest(FillRequest request, CancellationSignal cancellationSignal, FillCallback callback) {
        android.util.Log.d(TAG, "onFillRequest triggered");

        // Show a toast to confirm the service is being called
        try {
            android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
            mainHandler.post(() -> {
                android.widget.Toast.makeText(getApplicationContext(), "🔐 VaultGuard: Autofill triggered!", android.widget.Toast.LENGTH_SHORT).show();
            });
        } catch (Exception ignored) {}

        List<FillContext> contexts = request.getFillContexts();
        if (contexts == null || contexts.isEmpty()) {
            android.util.Log.d(TAG, "No contexts found");
            callback.onSuccess(null);
            return;
        }

        // Get the latest AssistStructure
        AssistStructure structure = contexts.get(contexts.size() - 1).getStructure();
        String packageName = structure.getActivityComponent().getPackageName();
        android.util.Log.d(TAG, "Focused app package: " + packageName);

        // Skip our own app
        if ("com.vaultguard.app".equals(packageName)) {
            android.util.Log.d(TAG, "Skipping our own app");
            callback.onSuccess(null);
            return;
        }

        // Traverse the node tree to find autofill targets
        AutofillFields autofillFields = new AutofillFields();
        int windowCount = structure.getWindowNodeCount();
        for (int i = 0; i < windowCount; i++) {
            AssistStructure.WindowNode windowNode = structure.getWindowNodeAt(i);
            findAutofillNodes(windowNode.getRootViewNode(), autofillFields);
        }

        android.util.Log.d(TAG, "Username field found: " + (autofillFields.usernameId != null) +
                            ", Password field found: " + (autofillFields.passwordId != null) +
                            ", webUrl: " + autofillFields.webUrl);

        // We need at least a username or a password field to perform autofill
        if (autofillFields.usernameId == null && autofillFields.passwordId == null) {
            android.util.Log.d(TAG, "No username or password field found");
            showDebugToast("VaultGuard: No login fields detected in " + packageName);
            callback.onSuccess(null);
            return;
        }

        // Fetch decrypted entries from securely stored shared preferences
        SharedPreferences prefs = getEncryptedPrefs();
        if (prefs == null) {
            android.util.Log.e(TAG, "Failed to load SharedPreferences");
            showDebugToast("VaultGuard: Storage error");
            callback.onSuccess(null);
            return;
        }

        String rawEntriesJson = prefs.getString(KEY_ENTRIES, null);
        if (rawEntriesJson == null || rawEntriesJson.isEmpty()) {
            android.util.Log.w(TAG, "No credentials synced from client app yet");
            showDebugToast("VaultGuard: No credentials synced yet. Open VaultGuard and unlock your vault first.");
            callback.onSuccess(null);
            return;
        }

        try {
            JSONArray entries = new JSONArray(rawEntriesJson);
            android.util.Log.d(TAG, "Total synced entries in DB: " + entries.length());
            FillResponse.Builder responseBuilder = new FillResponse.Builder();
            int datasetCount = 0;

            // First pass: look for direct domain/package name matches
            for (int i = 0; i < entries.length(); i++) {
                JSONObject entry = entries.getJSONObject(i);
                String website = entry.optString("website", "");
                String title = entry.optString("title", "Credential");
                String username = entry.optString("username", "");
                String password = entry.optString("password", "");

                // Skip entries with no usable data
                if (username.isEmpty() && password.isEmpty()) continue;

                if (isMatch(website, autofillFields.webUrl, packageName)) {
                    Dataset dataset = buildDataset(autofillFields, title, username, password);
                    if (dataset != null) {
                        responseBuilder.addDataset(dataset);
                        datasetCount++;
                        android.util.Log.d(TAG, "Matched entry: " + title);
                    }
                    if (datasetCount >= 5) break;
                }
            }

            // Second pass: if no matches found OR focused app is a browser, offer fallback list
            if (datasetCount < 5 && (datasetCount == 0 || isBrowser(packageName))) {
                android.util.Log.d(TAG, "No matches or in browser, adding fallback suggestions");
                for (int i = 0; i < entries.length(); i++) {
                    JSONObject entry = entries.getJSONObject(i);
                    String title = entry.optString("title", "Credential");
                    String username = entry.optString("username", "");
                    String password = entry.optString("password", "");

                    // Skip entries with no usable data
                    if (username.isEmpty() && password.isEmpty()) continue;

                    // Avoid duplicate suggestions if already matched in first pass
                    String website = entry.optString("website", "");
                    if (isMatch(website, autofillFields.webUrl, packageName)) {
                        continue;
                    }

                    Dataset dataset = buildDataset(autofillFields, title, username, password);
                    if (dataset != null) {
                        responseBuilder.addDataset(dataset);
                        datasetCount++;
                        android.util.Log.d(TAG, "Added fallback suggestion: " + title);
                    }
                    if (datasetCount >= 5) break;
                }
            }

            android.util.Log.d(TAG, "Total suggestions returned to OS: " + datasetCount);
            if (datasetCount > 0) {
                callback.onSuccess(responseBuilder.build());
            } else {
                callback.onSuccess(null);
            }
        } catch (Exception e) {
            android.util.Log.e(TAG, "Error building autofill response", e);
            callback.onSuccess(null);
        }
    }

    @Override
    public void onSaveRequest(SaveRequest request, SaveCallback callback) {
        // We do not handle save requests from native autofill in this version
        callback.onSuccess();
    }

    // --- Helper classes and methods ---

    private static class AutofillFields {
        AutofillId usernameId = null;
        AutofillId passwordId = null;
        String webUrl = null;
    }

    /**
     * Builds a Dataset with proper null-safety. Returns null if no values could be set
     * (prevents the IllegalStateException crash from empty Dataset.Builder.build()).
     */
    private Dataset buildDataset(AutofillFields fields, String title, String username, String password) {
        Dataset.Builder builder = new Dataset.Builder();
        RemoteViews presentation = createPresentation(title, username);
        boolean hasValue = false;

        if (fields.usernameId != null && !username.isEmpty()) {
            builder.setValue(fields.usernameId, AutofillValue.forText(username), presentation);
            hasValue = true;
        }
        if (fields.passwordId != null && !password.isEmpty()) {
            builder.setValue(fields.passwordId, AutofillValue.forText(password), presentation);
            hasValue = true;
        }

        if (!hasValue) return null;

        try {
            return builder.build();
        } catch (Exception e) {
            android.util.Log.e(TAG, "Failed to build dataset for: " + title, e);
            return null;
        }
    }

    /**
     * Recursively traverses the AssistStructure view tree to find username/password fields.
     * Uses multiple detection strategies:
     * 1. Standard autofill hints (AUTOFILL_HINT_USERNAME, AUTOFILL_HINT_PASSWORD, etc.)
     * 2. Hint/placeholder text (e.g., "Enter your email")
     * 3. Resource ID names (e.g., "et_password")
     * 4. InputType flags (TYPE_TEXT_VARIATION_PASSWORD, TYPE_TEXT_VARIATION_EMAIL_ADDRESS, etc.)
     *    This is critical for native apps that don't set autofill hints.
     * 5. HTML input type attributes for WebView-based content
     */
    private void findAutofillNodes(AssistStructure.ViewNode node, AutofillFields fields) {
        if (node == null) return;

        // Capture web domain from browser nodes
        String webDomain = node.getWebDomain();
        if (webDomain != null && !webDomain.isEmpty()) {
            fields.webUrl = webDomain;
        }

        AutofillId nodeAutofillId = node.getAutofillId();

        // Strategy 1: Check standard autofill hints (most reliable)
        String[] hints = node.getAutofillHints();
        if (hints != null) {
            for (String hint : hints) {
                String hintLower = hint.toLowerCase();
                if (hintLower.contains("username") || hintLower.contains("email") ||
                    hint.equalsIgnoreCase(View.AUTOFILL_HINT_USERNAME) ||
                    hint.equalsIgnoreCase(View.AUTOFILL_HINT_EMAIL_ADDRESS)) {
                    if (fields.usernameId == null && nodeAutofillId != null) {
                        fields.usernameId = nodeAutofillId;
                        android.util.Log.d(TAG, "Found username via autofill hint: " + hint);
                    }
                } else if (hintLower.contains("password") ||
                           hint.equalsIgnoreCase(View.AUTOFILL_HINT_PASSWORD)) {
                    if (fields.passwordId == null && nodeAutofillId != null) {
                        fields.passwordId = nodeAutofillId;
                        android.util.Log.d(TAG, "Found password via autofill hint: " + hint);
                    }
                }
            }
        }

        // Strategy 2: Check node placeholder/hint text (e.g., "Email Address", "Master Password")
        CharSequence hintText = node.getHint();
        if (hintText != null && nodeAutofillId != null) {
            String ht = hintText.toString().toLowerCase();
            if (ht.contains("username") || ht.contains("email") || ht.contains("login") ||
                ht.contains("phone") || ht.contains("user id") || ht.contains("account")) {
                if (fields.usernameId == null) {
                    fields.usernameId = nodeAutofillId;
                    android.util.Log.d(TAG, "Found username via hint text: " + hintText);
                }
            } else if (ht.contains("password") || ht.contains("passcode") || ht.contains("pin")) {
                if (fields.passwordId == null) {
                    fields.passwordId = nodeAutofillId;
                    android.util.Log.d(TAG, "Found password via hint text: " + hintText);
                }
            }
        }

        // Strategy 3: Check resource ID names
        String resId = node.getIdEntry();
        if (resId != null && nodeAutofillId != null) {
            String resIdLower = resId.toLowerCase();
            if (resIdLower.contains("username") || resIdLower.contains("email") ||
                resIdLower.contains("login") || resIdLower.contains("user_id") ||
                resIdLower.contains("userid") || resIdLower.contains("phone")) {
                if (fields.usernameId == null) {
                    fields.usernameId = nodeAutofillId;
                    android.util.Log.d(TAG, "Found username via resource ID: " + resId);
                }
            } else if (resIdLower.contains("password") || resIdLower.contains("passwd") ||
                       resIdLower.contains("passcode")) {
                if (fields.passwordId == null) {
                    fields.passwordId = nodeAutofillId;
                    android.util.Log.d(TAG, "Found password via resource ID: " + resId);
                }
            }
        }

        // Strategy 4: Check inputType flags — critical for native apps like Instagram, Reddit
        // Many native apps set inputType on EditText but don't set autofillHints
        if (nodeAutofillId != null) {
            int inputType = node.getInputType();
            if (inputType != 0) {
                int variation = inputType & InputType.TYPE_MASK_VARIATION;
                int cls = inputType & InputType.TYPE_MASK_CLASS;

                // Detect password fields by inputType
                if (fields.passwordId == null) {
                    if (variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
                        variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD ||
                        variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD ||
                        (cls == InputType.TYPE_CLASS_NUMBER && variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD)) {
                        fields.passwordId = nodeAutofillId;
                        android.util.Log.d(TAG, "Found password via inputType: 0x" + Integer.toHexString(inputType));
                    }
                }

                // Detect email/username fields by inputType
                if (fields.usernameId == null) {
                    if (variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS ||
                        variation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS ||
                        (cls == InputType.TYPE_CLASS_TEXT && (
                            variation == InputType.TYPE_TEXT_VARIATION_PERSON_NAME ||
                            variation == InputType.TYPE_TEXT_VARIATION_NORMAL
                        ))) {
                        // Only pick up TYPE_TEXT_VARIATION_NORMAL or PERSON_NAME if the node
                        // looks like an input (has a class containing "Edit" or is focusable)
                        if (variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS ||
                            variation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS) {
                            fields.usernameId = nodeAutofillId;
                            android.util.Log.d(TAG, "Found username via inputType (email): 0x" + Integer.toHexString(inputType));
                        }
                    }
                }
            }
        }

        // Strategy 5: Check HTML input type attribute for WebView content
        String htmlType = node.getHtmlInfo() != null ? getHtmlInputType(node) : null;
        if (htmlType != null && nodeAutofillId != null) {
            if (htmlType.equals("password")) {
                if (fields.passwordId == null) {
                    fields.passwordId = nodeAutofillId;
                    android.util.Log.d(TAG, "Found password via HTML input type");
                }
            } else if (htmlType.equals("email") || htmlType.equals("text")) {
                if (fields.usernameId == null) {
                    fields.usernameId = nodeAutofillId;
                    android.util.Log.d(TAG, "Found username via HTML input type: " + htmlType);
                }
            }
        }

        // Traverse tree recursively
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            findAutofillNodes(node.getChildAt(i), fields);
        }
    }

    /**
     * Extracts the "type" attribute from an HTML input element's HtmlInfo.
     */
    private String getHtmlInputType(AssistStructure.ViewNode node) {
        try {
            android.view.ViewStructure.HtmlInfo htmlInfo = node.getHtmlInfo();
            if (htmlInfo != null && "input".equalsIgnoreCase(htmlInfo.getTag())) {
                List<android.util.Pair<String, String>> attrs = htmlInfo.getAttributes();
                if (attrs != null) {
                    for (android.util.Pair<String, String> attr : attrs) {
                        if ("type".equalsIgnoreCase(attr.first)) {
                            return attr.second != null ? attr.second.toLowerCase() : null;
                        }
                    }
                }
            }
        } catch (Exception e) {
            android.util.Log.w(TAG, "Error reading HTML info", e);
        }
        return null;
    }

    /**
     * Matches a stored credential's website against the current page domain or app package name.
     * Uses proper domain suffix matching to prevent false positives like "mail.com" matching "gmail.com".
     */
    private boolean isMatch(String website, String pageDomain, String packageName) {
        if (website == null || website.isEmpty()) return false;

        String websiteLower = website.toLowerCase();

        // 1. Direct package-to-domain map match (e.g., com.instagram.android → instagram.com)
        if (packageName != null) {
            String mappedDomain = PACKAGE_TO_DOMAIN.get(packageName.toLowerCase());
            if (mappedDomain != null) {
                String cleanWebsite = extractDomain(websiteLower);
                if (domainMatches(cleanWebsite, mappedDomain)) {
                    return true;
                }
            }
        }

        // 2. Web domain match (browser or WebView pages)
        if (pageDomain != null && !pageDomain.isEmpty()) {
            String cleanPageDomain = pageDomain.replace("www.", "").toLowerCase();
            String cleanWebsite = extractDomain(websiteLower);
            if (domainMatches(cleanWebsite, cleanPageDomain)) {
                return true;
            }
        }

        // 3. Keyword package fallback match (e.g., website "facebook.com" matches package "com.facebook.katana")
        if (packageName != null) {
            String cleanWebsite = extractDomain(websiteLower);
            int dotIdx = cleanWebsite.indexOf('.');
            if (dotIdx != -1) {
                String baseWord = cleanWebsite.substring(0, dotIdx);
                // Only match if the base word is substantial (>3 chars) and appears as a
                // discrete segment in the package name (between dots), not just a substring
                if (baseWord.length() > 3) {
                    String[] packageParts = packageName.toLowerCase().split("\\.");
                    for (String part : packageParts) {
                        if (part.equals(baseWord)) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    /**
     * Extracts the domain from a URL (strips protocol, www, and path).
     * e.g., "https://www.facebook.com/login" → "facebook.com"
     */
    private String extractDomain(String url) {
        String clean = url.replace("https://", "").replace("http://", "").replace("www.", "");
        int slashIdx = clean.indexOf('/');
        if (slashIdx != -1) {
            clean = clean.substring(0, slashIdx);
        }
        return clean;
    }

    /**
     * Proper domain suffix matching. Checks if two domains match either exactly or
     * as proper subdomains (e.g., "login.facebook.com" matches "facebook.com",
     * but "mail.com" does NOT match "gmail.com").
     */
    private boolean domainMatches(String domain1, String domain2) {
        if (domain1.equals(domain2)) return true;
        // Check if one is a subdomain of the other
        if (domain1.endsWith("." + domain2)) return true;
        if (domain2.endsWith("." + domain1)) return true;
        return false;
    }

    private RemoteViews createPresentation(String title, String username) {
        RemoteViews presentation = new RemoteViews(getPackageName(), R.layout.autofill_suggestion);
        presentation.setTextViewText(R.id.autofill_title, title);
        presentation.setTextViewText(R.id.autofill_username, username.isEmpty() ? "No username" : username);
        return presentation;
    }

    private void showDebugToast(String message) {
        try {
            android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
            mainHandler.post(() -> {
                android.widget.Toast.makeText(getApplicationContext(), message, android.widget.Toast.LENGTH_LONG).show();
            });
        } catch (Exception ignored) {}
    }
}
