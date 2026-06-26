# 🔐 VaultGuard

An enterprise-grade, **Zero-Knowledge** password manager designed for Web browsers, Android mobile devices (with native offline Autofill suggestions), and Browser WebExtensions.

VaultGuard is engineered around absolute privacy, ensuring that your raw credentials never touch the internet and are encrypted client-side before being synchronized.

---

## 🚀 Key Architectural Pillars

### 1. Zero-Knowledge Cryptography (Client-Side Encryption)
VaultGuard is built on a **Zero-Knowledge** security model. Your master password is never sent to the server.
* **Key Derivation**: Your master password and email are processed locally on your device using **PBKDF2** to derive a high-entropy master key.
* **Client-Side Encryption**: All credentials (usernames, passwords, notes) are encrypted client-side using **AES-256-GCM** before being synced to the server.
* **Blind Database**: The backend server and MongoDB database only store opaque ciphertext, initialization vectors (`iv`), and random salts. Even if the database is breached, the attacker receives nothing but mathematically useless ciphertext.

### 2. Client-Server Web Architecture
The Web Dashboard operates under a secure online client-server model:
* **Direct Server Authentication**: Master passwords and session tokens are validated in real time against the backend, completely bypassing local browser database caches.
* **Zero Browser Database Caching**: No credentials or user profile metadata are written to persistent browser databases (like IndexedDB) on the web. This prevents cross-user database contamination and guarantees clean, isolated sessions when switching between different accounts on the same browser.
* **Secure Session Memory**: Cryptographic keys are maintained strictly in-memory (`sessionStorage`) for the duration of the browser tab session, ensuring zero persistent traces of raw encryption material are left on the physical disk.

### 3. Native Android Integration (Offline-First Vault)
VaultGuard hooks directly into native Android APIs to support secure, offline-first vault reads:
* **True Offline Access**: The Android app synchronizes and encrypts your credentials, caching them locally in Android's secure **`EncryptedSharedPreferences`**. This storage uses AES-256 GCM keys managed securely by the hardware-backed **Android Keystore System** (TEE/enclave).
* **Native Autofill Service**: The native `VaultAutofillService` reads and decrypts your vault data directly from this hardware-secured local storage. Suggestions are generated and autofilled completely offline with **zero network dependencies**, providing instant keyboard inline suggestions (for Gboard) and standard dropdown presentations even without internet access.
* **Device Lock & Biometrics**: Supports local biometrics (fingerprint/face recognition) and device lock integration, allowing users to securely unlock the offline vault cache instantly without re-typing their master password.
* **"Open VaultGuard" Context Menu (PROCESS_TEXT)**: Declares a `ProcessTextActivity` that hooks into Android's native text selection context menu. You can select text anywhere on Android, click the 3-dot context menu, choose **"Open VaultGuard"**, and the main app will launch as a seamless floating overlay directly on top of the current app.

### 4. Browser WebExtension Architecture (Offline-First Background Worker)
The browser WebExtension is structured around a central background service worker that supports offline credential access:
* **Background Service Worker (`background.js`)**: Manages the active vault state, handles local decryption, caches data in IndexedDB, and handles session auto-lock timers.
* **Offline Credential Support**: The background worker isolates and stores encrypted data locally in the browser extension's IndexedDB, allowing you to search and view your credentials even when offline.
* **Vite API URL Synchronization**: When the extension's React popup mounts, it automatically runs an effect that syncs Vite's build-time environment variable (`VITE_API_URL`) to the service worker via a `'SET_SERVER_URL'` message, storing it in `chrome.storage.local`.
* **Manual Server Override**: Users can override the server URL directly in the extension settings panel, bypassing the build-time configuration.

---

## 📦 Project Ecosystem Structure

The codebase is organized as a clean, decoupled multi-project workspace:

```
VaultGuard/
├── client/          # Vite + React.js + Tailwind CSS Web Client
│   ├── android/     # Capacitor-generated Android Native Project
│   └── src/         # React Components, Contexts, Hooks, and Services
├── server/          # Node.js + Express.js + MongoDB API Backend
│   ├── models/      # MongoDB Mongoose Schemas (User & Vault entries)
│   └── routes/      # Secure JWT Auth & soft-delete Trash routes
└── extension/       # Firefox & Chrome Browser WebExtension files
    ├── react-dist/  # Built React assets copied for the extension popup UI
    └── background.js# Background Service Worker handling encryption & syncing
```

---

## 🛠️ Tech Stack

* **Frontend**: React (v19), Vite (v8), Tailwind CSS, Lucide icons.
* **Mobile Wrapper**: Capacitor (v8) Core, CLI, Android, and HTTP Interceptor (bypasses browser CORS).
* **Backend**: Node.js, Express.js, MongoDB + Mongoose, JSON Web Tokens (JWT) in HTTP-only cookies.
* **Android Native**: Java, Jetpack Security (`EncryptedSharedPreferences`), Android Autofill Framework.
* **Browser Extension**: Manifest V3, Chrome Storage APIs, Chrome Session Storage, IndexedDB.

---

## 💻 Local Setup & Development

Follow these steps to run VaultGuard locally on your machine.

### Prerequisites
* **Node.js** (v18+) & **npm** installed.
* **MongoDB** (local installation or MongoDB Atlas cluster).
* **Android Studio** & **Android SDK** (for compiling the mobile app).
* **USB Debugging** enabled on your physical device (for testing the Android app).

---

### 1. Running the Express.js Backend

1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file inside `/server` with the following configuration:
   ```env
   # Server Port
   PORT=your_port_no
   NODE_ENV=development

   # MongoDB Database Connection
   # For local MongoDB: mongodb://localhost:27017/vaultguard
   # For MongoDB Atlas, use your full connection string:
   DB_USER=your_database_username
   DB_PASSWORD=your_database_password
   # Alternatively, specify direct URI:
   # MONGO_URI=mongodb+srv://...

   # JWT Secret - Change this to a strong random string
   JWT_SECRET=your_jwt_signing_secret_here
   JWT_EXPIRES_IN=your_jwt_expiration_time

   # Encryption - Number of salt rounds for bcrypt
   BCRYPT_SALT_ROUNDS=your_bcrypt_salt_rounds_here

   # CORS - Allowed Frontend origin URL
   CLIENT_URL= your_localHost_address
   ```
4. Start the development server:
   ```bash
   npm start
   ```

---

### 2. Running the Web Frontend

1. Navigate to the client folder:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the environment variables. Create a `.env.development` file for local development:
   ```env
   # LOCAL DEVELOPMENT CONFIGURATION
   # Loaded automatically by Vite during local development (npm run dev).
   VITE_API_URL=localHost_server_address
   VITE_FRONTEND_URL= vite_dev_server_client_address
   ```
   *(For production builds, configure these in `.env` to point to your live hosted servers).*
4. Launch the Vite dev server:
   ```bash
   npm run dev
   ```

---

### 3. Setting Up the Browser Extension

1. **Configure Background Fallback URL**:
   Before building, you can configure the default fallback URL in the extension service worker. Open `extension/background.js` and modify line 9:
   ```javascript
   const DEFAULT_SERVER_URL = your_server_url; // Change this to your local or cloud server url
   ```
2. **Build the extension UI**:
   The extension popup UI is compiled from the React client. Build it and automatically copy the assets to the extension directory:
   ```bash
   cd client
   ```
   Ensure `.env` contains the correct API URL, then run:
   ```bash
   npm run build
   ```
   *(This builds Vite and executes `node copy-build.js` which syncs the built web files to `extension/react-dist`).*
3. **Load the Extension in Chrome**:
   * Open Google Chrome and navigate to `chrome://extensions/`.
   * Enable **Developer mode** (toggle in the top-right corner).
   * Click **Load unpacked** in the top-left corner.
   * Select the `extension` folder from the root of this project.

---

### 4. Compiling and Installing the Android Mobile App

1. Build the React web client and sync the assets to Capacitor:
   ```bash
   cd client
   npm run build
   npx cap sync android
   ```
2. **Compile the APK**:
   * **Option A: Android Studio (Recommended)**:
     * Open Android Studio.
     * Select **Open an Existing Project** and choose the `client/android` folder.
     * Wait for Gradle sync to complete, then go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
     * The compiled APK will be located under: `client/android/app/build/outputs/apk/debug/app-debug.apk`.
   * **Option B: Command Line (Android SDK)**:
     * Navigate to the `client/android` directory:
       ```bash
       cd android
       ```
     * Compile using Gradle:
       * **Windows**: `.\gradlew.bat assembleDebug`
       * **macOS/Linux**: `./gradlew assembleDebug`

3. **Install on Phone via ADB**:
   Ensure USB Debugging is active on your mobile device and it is listed under `adb devices`. Install the compiled APK using ADB:
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

5. **Read Live Error/Autofill Logs**:
   To debug the native Android Autofill service and page domain matching logic in real time:
   ```bash
   adb logcat -s VaultAutofill:D
   ```

---

## 🔒 Security Practices

* **Client-Side Derivation**: User passwords are run through PBKDF2 with a dynamic salt before verification.
* **HTTP-Only Cookies**: JWT tokens are transmitted via `HttpOnly` and `SameSite` secure cookie flags to protect against XSS session hijacks.
* **Secure Key Injection**: Cryptographic keys are never hardcoded and are generated on the fly.
* **Git Safe**: Key Android build configurations (`local.properties`), keystores (`*.jks`, `*.keystore`), and `.env` files are globally ignored to prevent credential leaks.

---

## 📄 License
This project is licensed under the MIT License.
