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

// Inline suggestions and intent authentication imports
import android.service.autofill.InlinePresentation;
import android.widget.inline.InlinePresentationSpec;
import android.view.inputmethod.InlineSuggestionsRequest;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentSender;
import android.view.autofill.AutofillManager;
import androidx.autofill.inline.v1.InlineSuggestionUi;

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
        "com.opera.gx",
        "com.opera.browser.beta",
        "com.opera.mini.native.beta",
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

        // Skip phone dialer / contacts / telephony apps
        if (packageName != null) {
            String pkgLower = packageName.toLowerCase();
            if (pkgLower.contains("dialer") || pkgLower.contains("contacts") || pkgLower.endsWith(".phone") || pkgLower.contains("telephony")) {
                android.util.Log.d(TAG, "Skipping dialer/contacts/phone app: " + packageName);
                callback.onSuccess(null);
                return;
            }
        }

        boolean isBrowserApp = isBrowser(packageName);

        // Traverse the node tree to find autofill targets
        AutofillFields autofillFields = new AutofillFields();
        int windowCount = structure.getWindowNodeCount();
        for (int i = 0; i < windowCount; i++) {
            AssistStructure.WindowNode windowNode = structure.getWindowNodeAt(i);
            findAutofillNodes(windowNode.getRootViewNode(), autofillFields, isBrowserApp);

            // Fallback: try extracting domain from window title (e.g. Opera shows "Sign in · GitHub")
            if (autofillFields.webUrl == null && isBrowserApp) {
                CharSequence windowTitle = windowNode.getTitle();
                if (windowTitle != null) {
                    String titleStr = windowTitle.toString().trim();
                    // Try to find a domain-like pattern in the window title
                    java.util.regex.Matcher matcher = java.util.regex.Pattern
                        .compile("([a-zA-Z0-9-]+\\.(?:com|org|net|io|dev|co|me|app|tv|edu|gov|info|biz|us|uk|de|fr|jp|in|au|ca|br|ru|nl|se|no|fi|dk|ch|at|be|es|it|pt|pl|cz|hu|ro|bg|hr|sk|si|lt|lv|ee|ie|lu|mt|gr|cy|is)(?:\\.[a-z]{2})?)")
                        .matcher(titleStr.toLowerCase());
                    if (matcher.find()) {
                        autofillFields.webUrl = matcher.group(1).replace("www.", "");
                        android.util.Log.d(TAG, "Extracted domain from window title: " + autofillFields.webUrl + " (title: " + titleStr + ")");
                    }
                }
            }
        }

        android.util.Log.d(TAG, "Username field found: " + (autofillFields.usernameId != null) +
                            ", Password field found: " + (autofillFields.passwordId != null) +
                            ", focused field found: " + (autofillFields.focusedId != null) +
                            ", webUrl: " + autofillFields.webUrl);

        // Fetch Gboard inline suggestions request specifications
        InlineSuggestionsRequest inlineRequest = request.getInlineSuggestionsRequest();
        InlinePresentationSpec inlineSpec = null;
        if (inlineRequest != null && inlineRequest.getInlinePresentationSpecs().size() > 0) {
            inlineSpec = inlineRequest.getInlinePresentationSpecs().get(0);
        }

        // Determine if this is a manual request (user long-pressed and selected Autofill)
        boolean isManualRequest = (request.getFlags() & FillRequest.FLAG_MANUAL_REQUEST) != 0;

        // If it's a manual request, we only need a focused field to show the search chip.
        // Otherwise (automatic request), we require a username or password field.
        // Special case for browsers: if we have a focused field + detected webUrl, allow autofill
        // even without explicit username/password field detection (fixes Opera browser).
        boolean canAutofill = (autofillFields.usernameId != null || autofillFields.passwordId != null) 
                           || (isManualRequest && autofillFields.focusedId != null)
                           || (isBrowserApp && autofillFields.focusedId != null && autofillFields.webUrl != null);

        if (!canAutofill) {
            android.util.Log.d(TAG, "Autofill conditions not met (manual: " + isManualRequest + ")");
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
                    Dataset dataset = buildDataset(autofillFields, title, username, password, inlineSpec);
                    if (dataset != null) {
                        responseBuilder.addDataset(dataset);
                        datasetCount++;
                        android.util.Log.d(TAG, "Matched entry: " + title);
                    }
                    if (datasetCount >= 5) break;
                }
            }



            // Always append the "Search in VaultGuard" auth dataset (displays as compact 🔍 keyboard chip)
            Dataset searchDataset = buildSearchDataset(autofillFields, inlineSpec);
            if (searchDataset != null) {
                responseBuilder.addDataset(searchDataset);
                datasetCount++;
                android.util.Log.d(TAG, "Appended Search VaultGuard option");
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
        AutofillId focusedId = null;
        String webUrl = null;
    }

    /**
     * Builds a Dataset with proper null-safety. Returns null if no values could be set
     * (prevents the IllegalStateException crash from empty Dataset.Builder.build()).
     */
    private Dataset buildDataset(AutofillFields fields, String title, String username, String password, InlinePresentationSpec inlineSpec) {
        Dataset.Builder builder = new Dataset.Builder();
        RemoteViews presentation = createPresentation(title, username, password);
        boolean hasValue = false;

        // Build inline suggestion presentation if specs are provided by Gboard/Keyboard
        InlinePresentation inlinePresentation = null;
        if (inlineSpec != null) {
            try {
                androidx.autofill.inline.v1.InlineSuggestionUi.Content content = 
                    androidx.autofill.inline.v1.InlineSuggestionUi.newContentBuilder(
                        PendingIntent.getActivity(this, 0, new Intent(), PendingIntent.FLAG_IMMUTABLE)
                    )
                    .setTitle(title)
                    .setSubtitle(username)
                    .build();
                inlinePresentation = new InlinePresentation(content.getSlice(), inlineSpec, false);
            } catch (Exception e) {
                android.util.Log.e(TAG, "Error building inline presentation", e);
            }
        }

        AutofillId usernameTarget = fields.usernameId != null ? fields.usernameId : fields.focusedId;
        AutofillId passwordTarget = fields.passwordId;

        if (usernameTarget != null && !username.isEmpty()) {
            if (inlinePresentation != null) {
                builder.setValue(usernameTarget, AutofillValue.forText(username), presentation, inlinePresentation);
            } else {
                builder.setValue(usernameTarget, AutofillValue.forText(username), presentation);
            }
            hasValue = true;
        }
        if (passwordTarget != null && !password.isEmpty()) {
            if (inlinePresentation != null) {
                builder.setValue(passwordTarget, AutofillValue.forText(password), presentation, inlinePresentation);
            } else {
                builder.setValue(passwordTarget, AutofillValue.forText(password), presentation);
            }
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
    private void findAutofillNodes(AssistStructure.ViewNode node, AutofillFields fields, boolean isBrowserApp) {
        if (node == null) return;

        // Skip phone number input fields entirely
        int inputType = node.getInputType();
        if ((inputType & InputType.TYPE_MASK_CLASS) == InputType.TYPE_CLASS_PHONE) {
            return;
        }

        // Capture web domain from browser nodes
        String webDomain = node.getWebDomain();
        if (webDomain != null && !webDomain.isEmpty()) {
            fields.webUrl = webDomain;
        } else if (fields.webUrl == null) {
            // Try to extract webUrl from browser address bar node text
            CharSequence text = node.getText();
            if (text != null && text.length() > 0) {
                String textStr = text.toString().trim();
                if (textStr.contains(".") && !textStr.contains(" ") && textStr.length() > 3) {
                    boolean isUrl = textStr.startsWith("http://") || textStr.startsWith("https://");
                    if (!isUrl && node.getIdEntry() != null) {
                        String idLower = node.getIdEntry().toLowerCase();
                        isUrl = idLower.contains("url") || idLower.contains("address") || idLower.contains("location")
                             || idLower.contains("search") || idLower.contains("edit") || idLower.contains("field")
                             || idLower.contains("bar") || idLower.contains("title");
                    }
                    // For browser apps, accept ANY text node that looks like a domain
                    // This fixes Opera which doesn't set webDomain or standard resource IDs
                    if (!isUrl && isBrowserApp) {
                        String possibleDomain = textStr;
                        int slashIdx = possibleDomain.indexOf('/');
                        if (slashIdx != -1) {
                            possibleDomain = possibleDomain.substring(0, slashIdx);
                        }
                        // Accept if it matches a domain pattern
                        isUrl = possibleDomain.matches("^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$");
                    }

                    if (isUrl) {
                        fields.webUrl = extractDomain(textStr);
                        android.util.Log.d(TAG, "Extracted browser webUrl: " + fields.webUrl + " from node: " + node.getIdEntry() + " with text: " + textStr);
                    }
                }
            }
        }

        AutofillId nodeAutofillId = node.getAutofillId();

        if (node.isFocused() && nodeAutofillId != null) {
            fields.focusedId = nodeAutofillId;
        }

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
            findAutofillNodes(node.getChildAt(i), fields, isBrowserApp);
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

        // 0. Direct package name match
        if (packageName != null) {
            String cleanWebsite = extractDomain(websiteLower);
            if (cleanWebsite.equalsIgnoreCase(packageName.toLowerCase())) {
                return true;
            }
        }

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
        String clean = url.replace("https://", "")
                          .replace("http://", "")
                          .replace("android://", "")
                          .replace("www.", "");
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

    private Dataset buildSearchDataset(AutofillFields fields, InlinePresentationSpec inlineSpec) {
        Dataset.Builder builder = new Dataset.Builder();

        // 1. Build standard dropdown presentation
        RemoteViews presentation = new RemoteViews(getPackageName(), R.layout.autofill_suggestion);
        presentation.setTextViewText(R.id.autofill_title, "🔍 Search in VaultGuard");
        presentation.setTextViewText(R.id.autofill_username, "Select credential from vault");
        presentation.setViewVisibility(R.id.autofill_password, View.GONE);

        // 2. Setup launch intent pointing to AutofillActivity
        Intent intent = new Intent(this, AutofillActivity.class);
        intent.putExtra("username_id", fields.usernameId);
        intent.putExtra("password_id", fields.passwordId);
        intent.putExtra("focused_id", fields.focusedId);
        
        // Pass FLAG_MUTABLE because Android Autofill intercepts and decorates the intent sender
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 1002, intent, PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_MUTABLE
        );
        IntentSender intentSender = pendingIntent.getIntentSender();

        // 3. Build inline suggestion presentation (Gboard chip)
        // User requested: only "🔍" icon should be shown to maintain keyboard space!
        InlinePresentation inlinePresentation = null;
        if (inlineSpec != null) {
            try {
                androidx.autofill.inline.v1.InlineSuggestionUi.Content content = 
                    androidx.autofill.inline.v1.InlineSuggestionUi.newContentBuilder(pendingIntent)
                    .setTitle("🔍 Search") // Text label ensures Gboard renders the chip visibly
                    .setContentDescription("Search in VaultGuard")
                    .build();
                inlinePresentation = new InlinePresentation(content.getSlice(), inlineSpec, false);
            } catch (Exception e) {
                android.util.Log.e(TAG, "Error building search inline presentation", e);
            }
        }

        // Attach the auth intent to the dataset
        boolean hasField = false;
        AutofillId targetId = fields.usernameId != null ? fields.usernameId : 
                             (fields.passwordId != null ? fields.passwordId : fields.focusedId);
        
        if (targetId != null) {
            if (inlinePresentation != null) {
                builder.setValue(targetId, null, presentation, inlinePresentation);
            } else {
                builder.setValue(targetId, null, presentation);
            }
            hasField = true;
        }

        if (!hasField) return null;

        builder.setAuthentication(intentSender);
        return builder.build();
    }

    private RemoteViews createPresentation(String title, String username, String password) {
        RemoteViews presentation = new RemoteViews(getPackageName(), R.layout.autofill_suggestion);
        presentation.setTextViewText(R.id.autofill_title, title);
        presentation.setTextViewText(R.id.autofill_username, username.isEmpty() ? "No username" : username);
        
        if (password == null || password.isEmpty()) {
            presentation.setViewVisibility(R.id.autofill_password, View.GONE);
        } else {
            presentation.setViewVisibility(R.id.autofill_password, View.VISIBLE);
            presentation.setTextViewText(R.id.autofill_password, "••••••••");
        }
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
