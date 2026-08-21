# 🏢 Artha (Umi) — Real Estate CaseFlow & Master Listing CRM

Master Listing and Case Management application for Malaysian Real Estate Negotiators (RENs).

* **Version:** 1.4.2 (Build 54)
* **Download Portal:** [https://umiren-d6a66.web.app/](https://umiren-d6a66.web.app/)
* **Admin Portal:** [https://umiren-d6a66.web.app/admin](https://umiren-d6a66.web.app/admin)

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

## 🔒 License

Copyright © 2026 **Artha (Umi)**. Proprietary and confidential.
