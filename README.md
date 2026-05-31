# 🔐 VaultGuard

An open-source, **Zero-Knowledge**, **Offline-First** password manager designed for Web, Android (with native Autofill suggestions), and Browser Extensions. 

VaultGuard is engineered around absolute privacy, ensuring that your raw credentials never touch the internet and are encrypted client-side before being synchronized.

---

## 🚀 Key Architectural Pillars

### 1. Zero-Knowledge Cryptography (Client-Side Encryption)
VaultGuard is built on a **Zero-Knowledge** architecture. Your master password is used to derive a high-entropy key locally in your browser/device using **PBKDF2**.
* All sensitive credentials (usernames, passwords, notes) are encrypted client-side using **AES-256-GCM** before being synced.
* The server only receives and stores opaque, encrypted ciphers, initialization vectors (`iv`), and random salts.
* **The database is completely blind**: Even if the backend server or MongoDB database is breached, the attacker receives nothing but mathematically useless ciphertext.

### 2. Offline-First Performance
Designed to work flawlessly in Airplane Mode or under unstable connections:
* **IndexedDB Cache**: The web client caches your encrypted vault locally. When you unlock the vault, it decrypts and renders your credentials in-memory instantly, with zero latency or network requests.
* **Hardware-Backed Device Sync**: The Android mobile app automatically pushes your decrypted credentials across a native Capacitor bridge into Android’s secure **`EncryptedSharedPreferences`**. This storage uses AES-256 GCM keys managed securely by the **Android Keystore System** (hardware enclave).

### 3. Native Android Autofill Integration
VaultGuard hooks directly into the system-level Android Autofill framework:
* **Zero-Latency Suggestions**: When tapping a credential input in native apps (like Instagram) or browsers (like Chrome), the native `VaultAutofillService` queries your hardware-secured on-device storage completely offline with **zero network dependencies**.
* **Clean UI Suggestions**: Suggests logins in a modern, customized RemoteViews layout box with a `minWidth="320dp"`, bold titles, clear email alignments, and standard lock icon indicators.
* **Dynamic Matching**: Uses package-to-domain mapping and suffix domain checks to prevent false matches (e.g. matching `login.github.com` to `github.com` but blocking `fake-github.com`).

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
```

---

## 🛠️ Tech Stack

* **Frontend**: React (v19), Vite (v8), Tailwind CSS, Lucide icons.
* **Mobile Wrapper**: Capacitor (v8) Core, CLI, Android, and HTTP Interceptor (bypasses browser CORS).
* **Backend**: Node.js, Express.js, MongoDB + Mongoose, JSON Web Tokens (JWT) in HTTP-only cookies.
* **Android Native**: Java, Jetpack Security (`EncryptedSharedPreferences`), Android Autofill Framework.

---

## 💻 Local Setup & Development

### 1. Running the Express.js Backend
1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file inside `/server` with the following:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_signing_secret
   CLIENT_URL=http://localhost:5173
   ```
4. Start the development server:
   ```bash
   npm start
   ```

### 2. Running the Web Frontend
1. Navigate to the client folder:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch the Vite dev server:
   ```bash
   npm run dev
   ```


### 3. Compiling the Android Mobile App
1. Build the web assets and synchronize them with the native Capacitor project:
   ```bash
   cd client
   npm run build
   npx cap sync android
   ```
2. Navigate to the native Android directory and compile the debug APK:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
   *(On Windows, use `.\gradlew.bat assembleDebug` instead).*

*The compiled debug APK will be generated at:*  
`client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔒 Security Practices
* **Client-Side Derivation**: User passwords are ran through PBKDF2 with a dynamic salt before verification.
* **HTTP-Only Cookies**: JWT tokens are transmitted via `HttpOnly` and `SameSite` secure cookie flags to protect against XSS session hijacks.
* **Secure Key Injection**: Cryptographic keys are never hardcoded and are generated on the fly.
* **Git Safe**: Key Android build configurations (`local.properties`), keystores (`*.jks`, `*.keystore`), and `.env` files are globally ignored to prevent credential leaks.

---

## 📄 License
This project is licensed under the MIT License.
