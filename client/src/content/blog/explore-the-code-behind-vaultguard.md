---
slug: explore-the-code-behind-vaultguard
title: Explore the code behind VaultGuard
summary: A guided look at the client, security services, and ways to contribute.
topicId: open-source
badge: OPEN SOURCE
eyebrow: OPEN SOURCE
readTime: 6 min read
iconKey: iconCodeCover
publishedAt: 2026-11-10
featured: false
---

VaultGuard is designed to be inspected, not just trusted. Authentication, client-side cryptography, and vault state management are organized into readable, dedicated modules across the repository.

## How the client security layers fit together

1. **Zero-knowledge authentication (`opaqueAuth.js`):** Registration and sign-in use `@serenity-kit/opaque` so your master password is never sent to the server in plaintext.
2. **Client-side cryptography (`crypto.js`):** Vault entries are encrypted and decrypted locally in the browser, extension worker, or Android WebView before any payload reaches the backend API.
3. **Platform-aware storage:** On the web, session keys stay scoped in memory/session storage with auto-lock timers; on Chrome/Firefox extensions and Android, dedicated background and native bridges handle secure state.

## Project structure at a glance

```text
VaultGuard/
├── client/      # React + Vite web app, SSG pages, Capacitor Android
├── extension/   # Chrome & Firefox MV3 extension + autofill scripts
└── server/      # Express 5 + Mongoose OPAQUE auth & encrypted vault API
```

## Ways to explore or contribute

Inspect the authentication and cryptography modules directly in the [VaultGuard repository](https://github.com/rupeshkumar9), run the extension unit tests via `npm run test:extension`, or share improvements across UI accessibility, autofill heuristics, and documentation.
