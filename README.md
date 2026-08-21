# 🏢 Artha (Umi) — Real Estate CaseFlow & Master Listing CRM

[![Version](https://img.shields.io/badge/version-1.4.2%20(Build%2054)-E11D48.svg)](#)
[![Vibecoded](https://img.shields.io/badge/built%20with-vibecoding%20⚡-8B5CF6.svg)](#)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-52-000000.svg)](https://expo.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Backend-FFCA28.svg)](https://firebase.google.com/)

Master Listing and Case Management application for Malaysian Real Estate Negotiators (RENs).

---

## 🚀 Quick Commands

### 1. Run Development Server
```bash
npx expo start -c
```

### 2. Build Production APK
```bash
cd android
.\gradlew.bat assembleRelease
```

### 3. Deploy Web & Hosting
```bash
Copy-Item android/app/build/outputs/apk/release/app-release.apk dist/releases/artha-1.4.2.apk -Force
npx firebase-tools deploy --only hosting
```

### 4. Broadcast Release Notifications
```bash
node scripts/notify-release.mjs --force
```

---

## 💖 Credits

Vibecoded with love by **Arul** ✨
