#!/usr/bin/env node
/**
 * scripts/generate-google-services.js
 *
 * Recreates google-services.json from EXPO_PUBLIC_* environment variables.
 * Run this before a native Android build when google-services.json is not
 * committed to source control.
 *
 * Usage:
 *   node scripts/generate-google-services.js
 *
 * EAS Build integration — add to eas.json under the Android build profile:
 *   "prebuildCommand": "node scripts/generate-google-services.js"
 *
 * Required environment variables (set as EAS secrets or CI env vars):
 *   EXPO_PUBLIC_FIREBASE_API_KEY
 *   EXPO_PUBLIC_FIREBASE_PROJECT_ID
 *   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   EXPO_PUBLIC_FIREBASE_APP_ID
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
 */

const fs = require("fs");
const path = require("path");

const required = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(
    "[generate-google-services] Missing required environment variables:\n" +
      missing.map((k) => `  ${k}`).join("\n") +
      "\nSet them as EAS secrets or export them before running this script."
  );
  process.exit(1);
}

const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Derive package name from app ID: 1:SENDER:android:HEX -> not in appId,
// so read from app.json as a fallback.
let packageName = "com.umi.caseflow";
try {
  const appJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "app.json"), "utf8")
  );
  packageName = appJson?.expo?.android?.package ?? packageName;
} catch (_) {
  // keep default
}

const googleServices = {
  project_info: {
    project_number: messagingSenderId,
    project_id: projectId,
    storage_bucket: storageBucket,
  },
  client: [
    {
      client_info: {
        mobilesdk_app_id: appId,
        android_client_info: {
          package_name: packageName,
        },
      },
      oauth_client: [
        {
          client_id: webClientId,
          client_type: 3,
        },
      ],
      api_key: [
        {
          current_key: apiKey,
        },
      ],
      services: {
        appinvite_service: {
          other_platform_oauth_client: [
            {
              client_id: webClientId,
              client_type: 3,
            },
          ],
        },
      },
    },
  ],
  configuration_version: "1",
};

const outPath = path.join(__dirname, "..", "google-services.json");
fs.writeFileSync(outPath, JSON.stringify(googleServices, null, 2), "utf8");
console.log(`[generate-google-services] Written to ${outPath}`);
