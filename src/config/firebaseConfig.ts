/**
 * Firebase / Google configuration values.
 *
 * All values are read from EXPO_PUBLIC_* environment variables so that the
 * google-services.json file never needs to be committed to source control.
 *
 * Local development: copy .env.example to .env.local and fill in the values.
 * CI/EAS Build: inject the same keys as EAS secrets or environment variables.
 * See: https://docs.expo.dev/build-reference/variables/
 *
 * For native Android builds, run `node scripts/generate-google-services.js`
 * (or add it to your eas.json `prebuildCommand`) to recreate google-services.json
 * from these environment variables before the Gradle build runs.
 */

function requireEnv(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[firebaseConfig] Missing required environment variable: ${key}. ` +
        "Set it in .env.local (dev) or as an EAS/Replit secret (CI). " +
        "See .env.example for the full list."
    );
  }
  return value;
}

// Keep these as direct property accesses: Expo statically inlines
// process.env.EXPO_PUBLIC_* references into native production bundles.
export const FIREBASE_API_KEY = requireEnv(
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY
);
export const FIREBASE_PROJECT_ID = requireEnv(
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
);
export const FIREBASE_STORAGE_BUCKET = requireEnv(
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
);
export const FIREBASE_MESSAGING_SENDER_ID = requireEnv(
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
);
export const FIREBASE_APP_ID = requireEnv(
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID
);
export const GOOGLE_WEB_CLIENT_ID = requireEnv(
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
);
