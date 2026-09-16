# 🏢 Artha (Umi) — Real Estate CaseFlow & Master Listing CRM

[![Version](https://img.shields.io/badge/version-1.6.1%20(Build%2059)-E11D48.svg)](https://artharen.web.app)
[![Vibecoded](https://img.shields.io/badge/built%20with-vibecoding%20⚡-8B5CF6.svg)](#)
[![Android](https://img.shields.io/badge/Platform-Android%208.0+-3DDC84.svg)](https://artharen.web.app/releases/artha-latest.apk)
[![Hosting](https://img.shields.io/badge/Firebase%20Hosting-artharen.web.app-FFCA28.svg)](https://artharen.web.app)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-52-000000.svg)](https://expo.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Backend-FFCA28.svg)](https://firebase.google.com/)

**Artha** is the all-in-one Master Listing CRM and Case Transaction Management Suite engineered specifically for Malaysian Real Estate Negotiators (RENs).

🔗 **Official Web Portal & Landing Page**: [https://artharen.web.app](https://artharen.web.app)  
📲 **Direct APK Download**: [artha-1.6.1.apk](https://artharen.web.app/releases/artha-latest.apk)

---

## 🌟 What's New in v1.6.1 (Build 59)

- 📱 Fixed Android Keyboard Overlay: Add Listing description, notes, and Next button now dynamically lift cleanly above the keyboard on all Android devices.
- 🏛️ LPPSA Government Loan Calculator: Dedicated civil servant financing suite with automatic 60%/50% salary deduction limits, 4.0% fixed rate, and WhatsApp summary dispatch.
- 🤝 Co-Broke Broadcast Share Kit: 1-tap REN-to-REN WhatsApp broadcast formatting in listing share sheets.
- ⚡ Consolidated Quick Utilities: Streamlined 3-button action hub on homescreen (New Case, New Listing, Calculator).
- 📢 Integrated Notices & Action Items: System announcements now live seamlessly inside Today's Action Items.
- ✨ Fluid Card Physics & Shimmer Skeletons: Interactive spring touch feedback and smooth shimmer skeleton placeholders on case lists.
- 🛡️ Comprehensive Security Hardening: Locked down Firestore rules against privilege escalation, secured Storage document vaults, and protected Cloud Function endpoints.

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

- **Frontend**: React Native, Expo SDK 52, Expo Router v4 (File-based routing)
- **Styling & Physics**: Tailwind CSS (NativeWind) + React Native Reanimated
- **Backend**: Firebase Firestore (Offline-First Cache), Firebase Storage, Firebase Auth, Cloud Functions v2
- **Push & Crons**: Firebase Cloud Messaging (FCM) + Google Cloud Scheduler
- **Distribution**: Dual-Site Firebase Hosting (`artharen.web.app` & `umiren-d6a66.web.app`)

---

## 💻 Developer & Release Commands

### 1. Run Development Server
```bash
npx expo start -c
```

### 2. Pre-Flight Verification & Release Deploy
```bash
# Verify release manifests, dual-domain endpoints, and APK integrity
npm run verify:release

# Automatically verify, build, and deploy to Firebase Hosting
npm run deploy:release

# Dispatch high-priority push notifications to outdated devices
npm run notify:release -- --force
```

---

## 💖 Credits

Vibecoded with love by **Arul** ✨
