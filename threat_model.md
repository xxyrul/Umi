# Threat Model

## Project Overview

Umi is a real estate case-tracking SaaS mobile app for property agents. Built with React Native + Expo Router (SDK 57), it uses Firebase (Firestore, Auth, Storage) as its sole backend. Agents manage property listings, track cases end-to-end, schedule tasks, and share property documents. Authentication is via Firebase email/password and Google Sign-In. The app is not currently deployed to Replit; production distribution is via EAS (Expo Application Services) native Android builds.

**Stack:** React Native 0.86 · Expo Router · Firebase (Firestore + Auth + Storage) · NativeWind · Sentry · EAS

## Assets

- **Case records** — buyer/vendor names, financial notes, status, deal amounts. Private to each agent.
- **Listing documents** — land title (geran), owner IC copies, SPA agreements, utility bills uploaded to Firebase Storage. Highly sensitive PII.
- **Firebase API key & OAuth client IDs** — embedded in `google-services.json`, committed to source control.
- **App-lock PIN** — stored in AsyncStorage, controls access to the app on the device.
- **Firebase credentials at rest** — user sessions managed by Firebase Auth SDK.
- **Sentry DSN + crash telemetry** — crash events include PII because `sendDefaultPii: true`.

## Trust Boundaries

- **Mobile Client / Firebase** — all Firestore and Storage operations cross this boundary; security relies entirely on Firebase Security Rules enforced server-side.
- **Authenticated / Unauthenticated** — Firebase Auth determines whether a request carries a valid UID; rules gate access on `request.auth != null`.
- **Per-user data isolation (cases)** — cases are scoped to `userId`; the Firestore rule must enforce this on both read and write paths.
- **Cross-agent data (listings)** — listings are readable by all authenticated agents; owner documents (IC, geran, SPA) are part of the listing document.
- **Device / App** — the app-lock PIN provides a device-level access control layer on top of Firebase Auth.

## Scan Anchors

- **Security rules**: `.uploaded-umi-build/firestore.rules`, `.uploaded-umi-build/storage.rules`
- **Auth & PIN logic**: `src/services/auth.ts`, `src/services/security.ts`
- **Firestore operations**: `src/services/storage.ts` (cases + listings CRUD)
- **App entry/auth guard**: `app/_layout.tsx`
- **Sensitive config**: `google-services.json` (committed API key)
- **Dev-only**: `app/_layout.tsx` Sentry test button (`__DEV__` guarded)

## Threat Categories

### Broken Object-Level Authorization (IDOR)

The Firestore rule for `/cases/{caseId}` uses a single ternary that checks `request.resource.data.userId` for updates rather than the *existing* document's `resource.data.userId`. This allows any authenticated user to overwrite a case they don't own by supplying their own UID in the payload — a classic BOLA/IDOR pattern. Must enforce ownership on both the existing document and the incoming write.

### Information Disclosure

All authenticated agents can read **any** listing, including sensitive attached documents (owner IC, land title, SPA). The Storage rules use a path pattern that doesn't match the actual upload paths, meaning effective storage security falls to the catch-all `allow read, write: if false` — uploads rely on rules matching. Sentry is configured with `sendDefaultPii: true`, sending IP addresses and user session data to a third-party service.

### Cryptographic Failures

`google-services.json` (containing the Firebase API key and OAuth client IDs) is committed to the repository. While Android Firebase keys are intentionally bundled into APKs, committing them to source control exposes them to anyone with repo access and makes rotation harder. The app-lock PIN is stored as plaintext in AsyncStorage — readable on rooted devices without any hashing or secure enclave protection.

### Elevation of Privilege

The `verifyAppLockPin` function returns `true` when no PIN is stored (`if (!storedPin) return true`), which could allow bypassing the PIN prompt if storage is cleared or on first setup while the lock screen is displayed.
