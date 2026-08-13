# Umi — Real Estate Case Tracking App

## Project overview

**Umi** is a premium real estate case tracking SaaS mobile app for property agents. Built with React Native + Expo Router, it lets agents manage property listings, track cases end-to-end, schedule follow-up tasks, and collaborate via Firebase.

**Stack:**
- React Native 0.86 + Expo SDK 57 + Expo Router (file-based navigation)
- Firebase (Firestore database, Auth, Storage) via `@react-native-firebase`
- Google Sign-In (`@react-native-google-signin/google-signin`)
- NativeWind (Tailwind CSS for React Native)
- Sentry for crash reporting
- EAS (Expo Application Services) for native builds

## App structure

```
app/
  _layout.tsx          # Root layout — auth guard, app-lock (PIN/biometrics)
  onboarding.tsx       # First-run onboarding
  login.tsx            # Email/password + Google sign-in
  (tabs)/
    index.tsx          # Dashboard — metrics, recent cases, shortcuts
    cases.tsx          # Case list with status filter
    listings.tsx       # Property listing search/filter/browse
    tambah.tsx         # Create / edit property listing form
    tasks.tsx          # Follow-up tasks and reminders
    profile.tsx        # Profile, preferences, sign-out
    calculator.tsx     # Property / loan calculator
  case/
    form.tsx           # Create / edit case form
    [id].tsx           # Case detail — status, actions
  listing/
    [id].tsx           # Listing detail — images, docs, maps, share

src/
  components/          # Shared UI components (Button, FormInput, CaseCard, etc.)
  context/             # React context providers
  services/
    firebase.ts        # Firebase app init + exports
    auth.ts            # Auth helpers (email, Google, sign-out, reset)
    notifications.ts   # Local notifications + listing create/update (Firebase Storage)
    storage.ts         # Firebase Storage helpers
    calendar.ts        # Expo Calendar integration
    security.ts        # App-lock PIN + biometrics
    updater.ts         # Expo OTA update check
  types/
    case.ts            # PropertyCase, UserProfile, CaseMetrics types
    listing.ts         # PropertyListing types
  utils/               # Utility helpers
```

## How to run (Replit)

The workflow runs `npx expo start --web --port 5000` for a browser preview.

> **Note:** `@react-native-firebase` does not fully support the web target. The web preview is useful for iterating on UI/layout. For full functionality (auth, Firestore, Storage), build the native app via EAS:
> ```
> npx eas build --platform android --profile preview
> ```

## Firebase / Google config

- `google-services.json` — Android Firebase config (checked in; contains OAuth client IDs used by Google Sign-In)
- `firebase.json` / `.firebaserc` — Firebase Hosting config
- `eas.json` — EAS build profiles (development / preview / production)

## Key scripts

| Command | What it does |
|---|---|
| `npx expo start --web` | Start Expo web dev server |
| `npx expo start` | Start Expo dev server (scan QR for device) |
| `npx eas build --platform android --profile preview` | Build Android APK via EAS |
| `npm run lint` | TypeScript type-check |
| `npm run notify:release -- --dry-run` | Validate the release manifest and preview update-notification recipients |
| `npm run notify:release` | Send the published release notification from a trusted CI/maintainer environment |

## Android update notifications

Signed-in Android installations register one FCM device token under the
authenticated user's private Firestore device collection after notification
permission is granted. The Profile notification settings switch can enable or
disable these app-update alerts. Token rotation is updated in place, sign-out
removes the registration, and stale tokens are pruned by the trusted release
notifier.

After publishing a new, package-validated `dist/releases/latest.json` and APK,
run `npm run notify:release` in CI with `FIREBASE_SERVICE_ACCOUNT` supplied only
as a secret environment variable. The notifier sends localized English or
Bahasa Melayu messages, skips duplicate tokens and already-updated builds, and
records a release marker to prevent duplicate announcements. Deploy
`firestore.rules` with `firebase deploy --only firestore:rules` before relying
on new registrations.

Important: users must install an APK that contains this push-registration code
before they can receive future remote update notifications. The existing
in-app updater remains the source of truth and is still required for users on
older builds or users who declined notifications.

## User preferences

- Keep the existing project structure and stack — no migrations or restructuring unless explicitly asked.
