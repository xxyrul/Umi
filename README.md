# 🏢 Artha (Umi) — Real Estate CaseFlow & Master Listing CRM

[![Version](https://img.shields.io/badge/version-2.0.0%20(Build%2060)-E11D48.svg)](https://artharen.web.app)
[![Platform](https://img.shields.io/badge/Platform-Android%208.0+-3DDC84.svg)](https://artharen.web.app/releases/artha-latest.apk)
[![Flutter](https://img.shields.io/badge/Flutter-3.41+-02569B.svg)](https://flutter.dev/)
[![Dart](https://img.shields.io/badge/Dart-3.11+-0175C2.svg)](https://dart.dev/)
[![State](https://img.shields.io/badge/State-Riverpod-00599C.svg)](https://riverpod.dev/)
[![Firebase Hosting](https://img.shields.io/badge/Firebase%20Hosting-artharen.web.app-FFCA28.svg)](https://artharen.web.app)

**Artha** is the all-in-one Master Listing CRM and Case Transaction Management Suite engineered specifically for Malaysian Real Estate Negotiators (RENs).

🔗 **Official Web Portal & Landing Page**: [https://artharen.web.app](https://artharen.web.app)  
📲 **Direct APK Download**: [artha-latest.apk](https://artharen.web.app/releases/artha-latest.apk)

---

## 🌟 What's New in v2.0.0 (Build 60)

- 🚀 **Full Native Flutter Architecture**: High-performance Flutter 3.x engine with Riverpod state management and 120fps AMOLED pitch-black dark mode.
- 🔄 **Smart In-App Updater**: Dual-channel release pipeline (Stable & Beta), background APK downloads, and seamless local package installation.
- 🏛️ **LPPSA & Banking DSR Suite**: Civil servant financing suite with automatic 60%/50% deduction ceilings, 4.0% rate, tiered legal fees/MOT stamp duty, and WhatsApp summary dispatch.
- 🛡️ **Hardened Security & Device Lock**: Biometric fingerprint / PIN app lock, anti-screenshot protection, and locked-down Firestore security rules.
- 📢 **Admin Broadcast Hub**: Real-time push announcements targeted to All Agents or isolated Beta Testers via Firebase Cloud Messaging.
- 🤝 **Co-Broke Broadcast Share Kit**: 1-tap REN-to-REN WhatsApp broadcast formatting in listing share sheets.

---

## 🚀 Core Features

### 🏡 Master Listing & Multi-Channel Sharing
- **Co-Broke WhatsApp Kit**: 1-tap formatted broadcasts tailored for agent-to-agent co-broking with commission splits.
- **Multi-Photo Album Sharing**: Download and prepare entire photo albums with automated property captions.
- **Smart GPS Geocoding**: Interactive map location picker with automatic address parsing from Google Maps and Waze URLs.
- **Instant Search & Filters**: High-performance filtering by property type, tenure, state, price range, and listing status.

### 🧮 Malaysian Financing & DSR Suite
- **LPPSA Government Loan**: Civil servant financing suite with automatic 60%/50% deduction ceilings, 4.0% rate, and direct WhatsApp summary.
- **Commercial Housing Loan & DSR**: Approval health gauge, Bank Negara DSR rules, and dedicated PTPTN deduction tracking.
- **MOT Stamp Duty & RPGT**: 1-tap First-Time Home Buyer exemption toggle with instant live cash savings computation.
- **Loan Insurance Estimator**: MRTT/MRTA and Houseowner/Fire Insurance calculations with financing inclusion options.

### 📑 Encrypted Document Vault & CaseFlow
- **Confidential Document Vault**: Secure client land titles (Geran), SPA copies, assessment taxes, and keys with offline-first caching.
- **Milestone Stepper Pipeline**: Visual tracking from Booking Paid $\rightarrow$ Loan Approval $\rightarrow$ SPA Signed $\rightarrow$ Handover.
- **Follow-up Reminders**: Scheduled client reminders integrated directly with native calendar and WhatsApp.

### 📲 Smart Updates & Automation
- **Self-Healing In-App Updater**: Background APK downloads with progress reporting, dual-domain CDN resolution, and direct native installation.
- **9:00 AM Daily Morning Briefing**: Cloud Function cron delivering daily active pipeline summaries directly to agent notification centers.

---

## 🛠️ Tech Stack & Architecture

- **Mobile Application**: Flutter 3.41+ (Dart 3.11+), Flutter Riverpod State Management, GoRouter
- **Design & Theme**: Material 3, Pure AMOLED Dark Mode (`#000000`), Haptic Feedback
- **Cloud Backend**: Firebase Firestore (Offline-First Cache), Firebase Storage, Firebase Auth, Cloud Functions v2
- **Push & Crons**: Firebase Cloud Messaging (FCM) + Google Cloud Scheduler (9:00 AM Daily Briefing & Update Nudge)
- **Web Admin Portal**: Single-Page Admin Hub on Firebase Hosting (`artharen.web.app/admin`)
- **Distribution**: Dual-Site Firebase Hosting (`artharen.web.app` & `umiren-d6a66.web.app`)

---

## 💻 Developer & Release Commands

### 1. Run Flutter Development App
```bash
cd flutter_app
flutter run
```

### 2. Build Android Release APK
```bash
cd flutter_app
flutter build apk --release
```

### 3. Deploy Cloud Functions & Web Admin
```bash
# Deploy Firebase Cloud Functions
firebase deploy --only functions

# Deploy Firebase Hosting Web Portal
firebase deploy --only hosting
```
