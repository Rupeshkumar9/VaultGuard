package com.vaultguard.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/**
 * Lightweight transparent activity that handles the Android text selection
 * context menu action "Open VaultGuard".
 * 
 * When a user selects text anywhere on Android, taps the three-dot overflow
 * menu, and chooses "Open VaultGuard", this activity receives the
 * ACTION_PROCESS_TEXT intent and launches the main VaultGuard app.
 */
public class ProcessTextActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Launch the main VaultGuard app
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(mainIntent);

        // Finish this transparent activity immediately
        finish();
    }
}
