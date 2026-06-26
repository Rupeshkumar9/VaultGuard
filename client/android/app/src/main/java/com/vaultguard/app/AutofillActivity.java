package com.vaultguard.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillManager;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;
import android.service.autofill.Dataset;
import com.getcapacitor.BridgeActivity;

public class AutofillActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VaultBridgePlugin.class);
        super.onCreate(savedInstanceState);

        // Register this active activity instance in the bridge
        VaultBridgePlugin.registerAutofillActivity(this);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        // Unregister to prevent memory leaks
        VaultBridgePlugin.unregisterAutofillActivity(this);
    }

    /**
     * Callback called by the Capacitor bridge when the user selects a credential in React.
     */
    public void onCredentialSelected(String username, String password) {
        AutofillId usernameId = getIntent().getParcelableExtra("username_id");
        AutofillId passwordId = getIntent().getParcelableExtra("password_id");
        AutofillId focusedId = getIntent().getParcelableExtra("focused_id");

        Dataset.Builder datasetBuilder = new Dataset.Builder();
        
        // Android Autofill requires a presentation RemoteViews for returned datasets
        RemoteViews presentation = new RemoteViews(getPackageName(), R.layout.autofill_suggestion);
        presentation.setTextViewText(R.id.autofill_title, "VaultGuard Selection");
        presentation.setTextViewText(R.id.autofill_username, username);
        presentation.setViewVisibility(R.id.autofill_password, View.GONE);

        boolean hasValue = false;
        if (usernameId != null && username != null && !username.isEmpty()) {
            datasetBuilder.setValue(usernameId, AutofillValue.forText(username), presentation);
            hasValue = true;
        }
        if (passwordId != null && password != null && !password.isEmpty()) {
            datasetBuilder.setValue(passwordId, AutofillValue.forText(password), presentation);
            hasValue = true;
        }
        if (!hasValue && focusedId != null) {
            String valueToFill = (username != null && !username.isEmpty()) ? username : password;
            if (valueToFill != null && !valueToFill.isEmpty()) {
                datasetBuilder.setValue(focusedId, AutofillValue.forText(valueToFill), presentation);
                hasValue = true;
            }
        }

        if (hasValue) {
            Intent result = new Intent();
            result.putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, datasetBuilder.build());
            setResult(RESULT_OK, result);
        } else {
            setResult(RESULT_CANCELED);
        }
        finish();
    }
}
