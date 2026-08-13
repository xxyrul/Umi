/**
 * Firebase / Google configuration values.
 *
 * Firebase values are read from EXPO_PUBLIC_* environment variables so that
 * google-services.json never needs to be committed to source control. The
 * Google Web OAuth client ID is a public project identifier and is kept
 * canonical below because it must match the Android Firebase project.
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
export const FIREBASE_API_KEY =
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAdBYUf_RcZHPrVD1tsAiQt7q1l7lbbLp0";
export const FIREBASE_PROJECT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "umiren-d6a66";
export const FIREBASE_STORAGE_BUCKET =
  process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "umiren-d6a66.firebasestorage.app";
export const FIREBASE_MESSAGING_SENDER_ID =
  process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "975924997372";
export const FIREBASE_APP_ID =
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:975924997372:android:bea9520b748ca68f70fb79";

/**
 * This is a public OAuth client identifier, not a credential. It must match
 * the Web client in the same Firebase project as the Android app. Keeping the
 * project client ID canonical prevents an outdated Replit secret from causing
 * Google's native sign-in flow to return DEVELOPER_ERROR.
 */
export const GOOGLE_WEB_CLIENT_ID =
  "975924997372-06nogtf16f250ope4ridpnodi9oh8fvc.apps.googleusercontent.com";
