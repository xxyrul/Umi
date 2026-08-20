# 🏢 Master Listing (Internal CRM)

Private repository for the DRT Master Listing real estate management mobile application.

---

## 🛠️ Stack & Environment

* **Framework:** React Native / Expo (Expo Router `app/` structure)
* **Language:** TypeScript
* **Backend & Auth:** Firebase (Authentication, Firestore, Cloud Storage)
* **Design Language:** Custom Dark Theme / Safe Area Aware Floating Navigation

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install

```

### 2. Environment Variables

Ensure your local `.env` or `firebaseConfig.js` contains the required Firebase credentials:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

```

### 3. Run Locally

```bash
npx expo start -c

```

---

## 📁 Key File Locations

* `app/(tabs)/_layout.tsx` — Custom floating bottom navigation bar
* `app/(tabs)/index.tsx` — Agent dashboard, KPI summary, and performance charts
* `app/(tabs)/cases.tsx` — Case progression, stage status, and contact routing
* `app/(tabs)/listings.tsx` — Master property inventory feed & buyer criteria modal
* `app/(tabs)/profile.tsx` — User settings, multi-language toggles & dynamic CSV export
* `app/listings/[id].tsx` — Property detail screen, photo carousel & WhatsApp action handlers
* `app/tambah.tsx` — New listing creation form

---

## 🔒 License & Confidentiality

Copyright © 2026 DRT Master Listing. All rights reserved.

This repository and its contents are proprietary and confidential. Unauthorized copying, modification, distribution, reverse engineering, or public deployment of this codebase via any medium is strictly prohibited.
