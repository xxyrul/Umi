# 🏢 Artha (Umi) — Real Estate CaseFlow & Master Listing CRM

[![Version](https://img.shields.io/badge/version-1.4.2%20(Build%2054)-E11D48.svg)](https://umiren-d6a66.web.app/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-52-000000.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6.svg)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Functions-FFCA28.svg)](https://firebase.google.com/)

**Artha (Umi)** is an internal real estate case management and master property listing SaaS platform designed specifically for Malaysian Real Estate Negotiators (RENs) and property agencies.

---

## 🌟 Core Features & Modules

### 1. 🏡 Master Listing & Smart Geocoding
* **3-Way View Switcher:** Toggle seamlessly between **Compact List**, **Fluid 2-Column Grid**, and **Live Google Maps View**.
* **Town-Level Malaysian Location Intelligence:** Automatic district and town detection with smart GPS marker pinning.
* **Lightning-Fast Search & Filters:** Status filtering (*Active, Booking, Sold*), property type, tenure (*Freehold / Leasehold*), and price range.
* **Glitch-Free Image Caching:** High-performance image rendering powered by `@shopify/flash-list` and `expo-image` with isolated recycling keys.

### 2. 🧮 Loan & Financial Calculators
* **1-Tap Listing Mortgage Estimator:** Live monthly installment estimates (`~RM .../bln`) embedded directly on listing details with an interactive drawer for downpayments (`0% Full Loan`, `10%`, `20%`) and bank/LPPSA rates.
* **Full DSR (Debt Service Ratio) Calculator:** Calculate maximum buyer housing loan eligibility based on 6-month average income, commitments (car loans, CC, personal loans, PTPTN), and generate WhatsApp consultation reports.

### 3. 📸 Streamlined Multi-Photo Share Sheet
* **Multi-Photo Album Downloader:** Download complete property photo albums with a live progress bar directly into WhatsApp or Telegram without repeating image captions.
* **1-Tap Copywriting Generator:** Automated copywriting with embedded price/sqft and monthly bank loan calculations.

### 4. 📑 Secure Offline Document Vault
* **Encrypted Document Storage:** Safely store Land Titles (*Geran*), SPA contracts, IC copies, keys, and utility bills with offline-first SQLite synchronization.
* **Privacy Isolation:** Guaranteed strict agent-only privacy enforced by Firestore security rules.

### 5. 🔔 Real-Time Notifications & Account Cloud Sync
* **Dual Notification Channel:** Android System Push Notifications (FCM) + In-App Notification Bell Inbox.
* **Real-Time `onSnapshot` Sync:** Instant delivery of team announcements and update notes without manual page refresh.
* **Account Cloud Persistence:** Read notifications and dismissed announcement cards sync directly to `users/{uid}` in Firestore, ensuring zero stale popups after reinstalling or clearing app data.

### 6. 🔒 Server-Side Admin Portal & Distribution
* **Secure Web Portal:** Server-side HMAC-SHA256 passcode verification via Google Cloud Functions (`verifyAdminAccessCode`).
* **Live Agent & Code Management:** Batch generation and tracking of agent registration access codes.
* **Over-The-Air (OTA) & Direct APK Distribution:** Live landing page ([`https://umiren-d6a66.web.app/`](https://umiren-d6a66.web.app/)) serving automated release manifests (`latest.json`, `history.json`) and universal APKs.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Mobile App** | React Native, Expo SDK 52, Expo Router (`app/`), TypeScript |
| **UI & Animation** | React Native Reanimated, Safe Area Context, Vector Icons, SVG |
| **List Performance** | Shopify FlashList, Expo Image (memory-disk cache) |
| **Backend & Cloud** | Firebase Authentication, Cloud Firestore, Cloud Storage |
| **Cloud Compute** | Google Cloud Functions (2nd Gen / Node 20, Cloud Run) |
| **Push Notifications** | Firebase Cloud Messaging (FCM v1 HTTP API), Expo Notifications |
| **Web & Hosting** | Firebase Hosting, Vanilla ES6 Modules, Modern Responsive CSS |

---

## 📁 Repository Structure

```
c:\Umi\
├── android\                 # Native Android project files & Gradle configuration
├── app\                     # Expo Router file-based screens
│   ├── (tabs)\              # Main floating tab bar routes (Dashboard, Cases, Listings, Profile)
│   ├── listing\[id].tsx     # Full property details, photo carousel & loan calculator drawer
│   ├── notifications.tsx    # Real-time in-app announcement inbox
│   ├── tambah.tsx           # Responsive listing creator & fluid 3-column photo grid
│   └── _layout.tsx          # Root app layout, auth guard & push notification routing
├── dist\                    # Firebase Hosting static web assets
│   ├── admin.html / .js     # Secured Admin Portal & access code generator
│   ├── index.html           # Live APK download landing page & release history
│   └── releases\            # Release manifests (latest.json, history.json) & APKs
├── functions\               # 2nd Gen Firebase Cloud Functions
│   └── index.js             # verifyAdminAccessCode server endpoint
├── scripts\                 # Automated deployment & notification tools
│   ├── notify-release.mjs   # Language-aware FCM release broadcaster
│   └── send-feature-broadcast.mjs # In-app announcement & push notification broadcaster
├── src\                     # Shared application logic
│   ├── components\          # Reusable UI cards, skeletons, modals & steppers
│   ├── context\             # Global AppSettingsContext (Language, Theme)
│   ├── services\            # Firebase, Auth, NotificationStorage & Sync
│   └── utils\               # Responsive scaling (wp/hp), Loan calculations, Geocoding
├── firestore.rules          # Strict multi-tenant security rules
└── package.json             # Dependencies and build scripts
```

---

## 🚀 Development & Build Workflows

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Expo Dev Server
```bash
npx expo start -c
```

### 3. Compile Production Android Release APK
```bash
cd android
.\gradlew.bat assembleRelease
```
*Compiled APK Output:* `android/app/build/outputs/apk/release/app-release.apk`

### 4. Deploy Web Portal & Release APK to Firebase Hosting
```bash
Copy-Item android/app/build/outputs/apk/release/app-release.apk dist/releases/artha-1.4.2.apk -Force
npx firebase-tools deploy --only hosting
```

### 5. Broadcast Release Update Notification to Devices
```bash
node scripts/notify-release.mjs --force
```

---

## 🔒 Security & Privacy

* **Multi-Tenant Data Guard:** Strict Firestore Security Rules isolate cases, private client records, and document vault uploads by `request.auth.uid`.
* **Zero Hardcoded Secrets:** Admin portal credentials and master elevation keys are validated strictly on server-side Cloud Run instances.
* **Signed Release Binaries:** Android APKs are signed with a dedicated release keystore for secure direct installation.

---

## 📄 License & Confidentiality

Copyright © 2026 **Artha (Umi)**. All rights reserved.

This repository and its codebase are proprietary and confidential. Unauthorized copying, distribution, decompilation, or deployment without explicit authorization is strictly prohibited.
