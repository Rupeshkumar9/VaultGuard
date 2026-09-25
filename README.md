# 🔐 VaultGuard

VaultGuard is a self-hosted password-manager project for the Web, Android, Chrome, and Firefox. The current code is suitable for careful single-user/personal testing, but it has not had an independent security audit and must not yet be described as enterprise-grade or as a generally production-ready password manager.

The design keeps the raw master password out of backend requests and encrypts credential secrets on the client before synchronization. The exact privacy boundary and the remaining production work are documented below.


---

## 🧪 Test / Play Account

Want to explore VaultGuard without creating a new account? Use the public test account below:

**Email:** `john@gmail.com`  
**Password:** `Mfd2AVwi231tWMYv`

> **Note:** This is a public test account intended only for exploring and testing VaultGuard. Do not store any real passwords, personal information, financial data, or other sensitive credentials in this account.

You can also create your own account using the **Sign Up** option to test VaultGuard independently.

### ⚠️ Beta Notice

VaultGuard is currently in beta and is primarily intended as a demonstration and testing project. While it implements the core features and security architecture of a modern password manager, it should not yet be used to store real-world sensitive credentials.

---

## 🚀 Key Architectural Pillars

### 1. Zero-Knowledge Scope (Client-Side Encryption)

VaultGuard currently has a **zero-knowledge boundary for the raw master password and the sensitive credential payload**, not for every piece of vault metadata.

* **OPAQUE authentication**: Registration and login use OPAQUE messages. The client supplies the raw master password only to the local OPAQUE library; the HTTP API receives protocol messages and stores an OPAQUE registration record. The current server has no bcrypt dependency and does not receive a bcrypt value or the raw password.
* **Vault key derivation**: The client derives the AES vault key with PBKDF2-HMAC-SHA-256 (600,000 iterations) from the master password and a deterministic salt derived from the normalized account email.
* **Client-side encryption**: Credential usernames, passwords, and notes are encrypted locally with AES-256-GCM and a fresh 12-byte IV before synchronization.
* **Metadata visible to the server**: Account email, display name, master-password hint, entry title, website, category, favorite/trash state, timestamps, and usage time are plaintext. MongoDB also stores the ciphertext, IV, and a legacy/sentinel `salt` field. The current per-entry `salt` field is not a random KDF salt.

### 2. Client-Server Web Architecture

The Web Dashboard operates under a secure online client-server model:
* **OPAQUE Authentication**: The client proves knowledge of the master password using the OPAQUE PAKE protocol; the raw password is never sent to or stored by the backend. Successful authentication produces a signed, expiring JWT that the API validates on protected requests.
* **Web caching boundary**: The Web client does not persist vault entries in IndexedDB. It does cache the minimal account ID/name/email in `localStorage`, keeps the JWT in memory plus an `HttpOnly` cookie, and keeps the derived vault key in tab-scoped `sessionStorage` as described below.
* **Tab-scoped key persistence**: The Web client stores an exportable copy of the derived AES vault key in `sessionStorage` so a page refresh does not relock the tab. It is cleared on lock/tab close, but it is still readable by JavaScript running in that origin and must not be described as memory-only storage.

### 3. Native Android Integration (Offline-First Vault)

VaultGuard hooks directly into native Android APIs to support secure, offline-first vault reads:
* **True Offline Access**: The Android app sends the decrypted active vault to the native bridge, which persists it using **`EncryptedSharedPreferences`**. The preference keys/values are encrypted with keys managed by Android Keystore. Hardware backing depends on the device and must not be assumed on every phone.
* **Native Autofill Service**: The native `VaultAutofillService` reads vault data from this Keystore-backed encrypted local storage. Suggestions are generated and autofilled completely offline with **zero network dependencies**, providing instant keyboard inline suggestions (for Gboard) and standard dropdown presentations even without internet access.
* **Device Lock & Biometrics**: Optional biometric unlock stores the master password encrypted by an Android Keystore AES-GCM key that requires a strong biometric for use. This is a deliberate device-local exception to the normal raw-password lifetime.
* **"Open VaultGuard" Context Menu (PROCESS_TEXT)**: Declares a `ProcessTextActivity` that hooks into Android's native text selection context menu. You can select text anywhere on Android, click the 3-dot context menu, choose **"Open VaultGuard"**, and the main app will launch as a seamless floating overlay directly on top of the current app.

### 4. Browser WebExtension Architecture (Offline-First Background Worker)

The browser WebExtension is structured around a central background service worker that supports offline credential access:
* **Background Service Worker (`background.js`)**: Manages the active vault state, handles local decryption, caches data in IndexedDB, and handles session auto-lock timers.
* **Offline Credential Support**: The background worker isolates and stores encrypted data locally in the browser extension's IndexedDB, allowing you to search and view your credentials even when offline.
* **Optional “never lock” state**: When explicitly selected, the extension persists the master password and JWT inside an AES-GCM-wrapped IndexedDB record. The non-exportable wrapping key is stored in the same extension database. This deters casual file inspection, but it is not hardware-backed protection against compromised extension code or a compromised browser profile.
* **Private Build URL Synchronization**: When the extension popup mounts, it transfers `VITE_API_URL` and `VITE_FRONTEND_URL` from the ignored/private build environment into extension-local storage. No personal deployment address is kept in tracked source.

---

## 📦 Project Ecosystem Structure and Entry Points

The codebase is a multi-surface workspace. These are the important starting points when reading it:

```
VaultGuard/
├── client/              # Shared Vite/React UI used by Web, Capacitor, and extension popup
│   ├── src/             # Pages, components, contexts, hooks, services, and utilities
│   ├── tests/           # Current Node tests for site identity and viewport behavior
│   └── android/         # Capacitor Android project and native Autofill implementation
├── server/              # Express API and Mongoose persistence
├── extension/           # Chrome/Firefox manifests, content script, worker source, local DB
├── docker/              # Local MongoDB replica-set bootstrap
└── docker-compose.yml   # Development-only MongoDB service
```

| Surface | Entry point | Responsibilities |
| --- | --- | --- |
| Express API | `server/server.js` | Environment loading, proxy/CORS policy, Helmet, rate limits, parsers, routes, error handling, and server startup |
| Authentication | `server/routes/auth.js` | OPAQUE registration/login, JWT cookie/token issuance, profile/email rekey, password rekey, logout, and account deletion |
| OPAQUE state | `server/opaqueAuth.js` | Stable server setup lookup and two-minute in-memory registration/login/password challenges |
| Authorization | `server/middleware/auth.js` | Bearer/cookie JWT verification and user lookup |
| Vault API | `server/routes/vault.js` | User-scoped CRUD, search, trash, favorite, last-used, and bulk operations |
| Database models | `server/models/User.js`, `server/models/VaultEntry.js` | Plaintext/encrypted field boundary, validation, and indexes |
| React bootstrap/router | `client/src/main.jsx`, `client/src/App.jsx` | Runtime bootstrap, platform router selection, providers, and routes |
| Client session/crypto/vault | `client/src/contexts/AuthContext.jsx`, `CryptoContext.jsx`, `VaultContext.jsx` | Authentication state, local key lifetime/rekeying, encryption/decryption, synchronization, and platform dispatch |
| Crypto/auth transport | `client/src/services/crypto.js`, `opaqueAuth.js`, `api.js` | PBKDF2/AES-GCM, OPAQUE client messages, and HTTP requests |
| Extension entry points | `extension/manifest.json`, `manifest.firefox.json`, `background.js`, `content.js`, `local-db.js` | Permissions, background secrets/sync, page-field detection/autofill, and encrypted offline storage |
| Extension build | `client/build-extension-worker.js`, `client/copy-build.js` | Bundle the worker/UI and assemble Chrome/Firefox archives |
| Android entry points | `MainActivity.java`, `VaultBridgePlugin.java`, `VaultAutofillService.java`, `AutofillActivity.java`, `ProcessTextActivity.java` | Capacitor bridge, encrypted native cache/biometrics, Autofill service, credential picker, and text-selection launcher |
| Local database | `docker-compose.yml`, `docker/mongodb/entrypoint.sh` | Single-node MongoDB replica set needed by rekey transactions; local development only |

Start a security review at `server/server.js`, follow the mounted authentication and vault routes, then trace `api.js`/`opaqueAuth.js`/`crypto.js` into the three client-specific storage layers.

---

## 🛡️ Security Readiness Snapshot (2026-08-28)

**Current classification:** personal/self-hosted beta. The application can be used by one informed user behind HTTPS with a private database, strong unique master password, short sessions, reliable encrypted backups, and tightly controlled client builds. It is not ready for untrusted multi-user/public production or for storing the only copy of high-impact credentials.

The code currently have no obvious cross-user IDOR in the vault routes: CRUD and bulk database filters include the authenticated user ID. React rendering uses normal escaped text, and the extension content UI uses `textContent` rather than HTML injection sinks. Helmet and the client CSP provide a useful baseline. These controls reduce XSS and authorization risk, but do not replace deployment-header verification or adversarial testing.

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
   # Local server port (Render supplies PORT automatically in production)
   PORT=5000
   NODE_ENV=development

   # MongoDB Database Connection
   # Use the complete URI from MongoDB Atlas or your local MongoDB server.
   # Atlas example:
   MONGODB_URI=mongodb+srv://<db_username>:<db_password>@cluster0.5gxxrru.mongodb.net/vaultguard?retryWrites=true&w=majority&appName=Cluster0
   # Local Docker MongoDB example (see docker-compose.yml):
   # MONGODB_URI=mongodb://vaultguard_local:vaultguard_local_dev_password@localhost:27017/vaultgaurd?authSource=admin&replicaSet=rs0
   # If the username or password contains characters such as @, :, /, or #,
   # URL-encode those values before placing them in the URI.

   # Start the local MongoDB replica set from the repository root:
   # docker compose up -d --build
   # The existing Docker volume is preserved when the container is recreated.

   # Generate independent high-entropy values; do not reuse examples.
   JWT_SECRET=your_jwt_signing_secret_here
   JWT_EXPIRES_IN=7d

   # OPAQUE PAKE server setup. Generate once and keep unchanged.
   # Example: node -e "const o=require('@serenity-kit/opaque'); o.ready.then(()=>console.log(o.server.createSetup()))"
   OPAQUE_SERVER_SETUP=your_stable_opaque_server_setup_here

   # Exact frontend origins, comma-separated when needed.
   CLIENT_URL=http://localhost:5173
   # Production should explicitly list the packaged extension origins/IDs.
   EXTENSION_ORIGINS=chrome-extension://your_chrome_extension_id,moz-extension://your_firefox_extension_id

   # For a same-site Web deployment prefer lax/strict. Cross-site cookie
   # deployments require HTTPS and a complete CSRF/origin policy.
   COOKIE_SECURE=false
   COOKIE_SAME_SITE=lax
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

1. **Configure the private build environment**:
   Set `VITE_API_URL` and `VITE_FRONTEND_URL` in an ignored local `.env` file or in your deployment provider's environment settings. Do not commit the file.
2. **Build the extension**:
   The extension popup and service worker are compiled from source. Build them and automatically copy the generated assets into the ignored extension output directories:
   ```bash
   cd client
   ```
   Ensure the private environment contains both URLs, then run:
   ```bash
   npm run build
   ```
   *(This creates `extension/react-dist` and `extension/worker-dist`. Both directories are build artifacts and are excluded from Git.)*
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

4. **Read Live Error/Autofill Logs**:
   To debug the native Android Autofill service and page domain matching logic in real time:
   ```bash
   adb logcat -s VaultAutofill:D
   ```

---

## 🔒 Security Practices

* **Separate authentication and encryption**: OPAQUE proves the master password to the backend without transmitting it. PBKDF2 derives the separate client-side AES vault key.
* **Authenticated encryption**: Credential secrets use AES-256-GCM with a fresh random IV per encryption. The format still needs versioned AAD and rollback protection as noted above.
* **Authorization scoping**: Vault database operations include the authenticated user ID in their filters.
* **Browser controls**: API responses use Helmet; the Web build has a baseline CSP; the extension limits sensitive messages by sender type and keeps secret storage accessible to trusted extension contexts.
* **Android controls**: Cleartext network traffic and Android backup are disabled; local Autofill data uses encrypted preferences; optional master-password recovery uses a strong-biometric-gated Keystore key.
* **Secret hygiene**: `.env`, Android keystores, local SDK settings, and private extension build outputs are ignored. Deployment secrets must still be generated independently, kept out of logs/images, rotated, and backed up where loss would make data inaccessible.

---

## 📄 License

This project is licensed under the MIT License.

