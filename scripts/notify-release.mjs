#!/usr/bin/env node
/**
 * Sends the "new Umi version available" push notification to every opted-in
 * Android installation after a release has been published.
 *
 * This runs server-side only (CI / maintainer machine). It authenticates with a
 * Firebase service account supplied through the FIREBASE_SERVICE_ACCOUNT_JSON
 * environment variable, so no credential is ever shipped in the app bundle.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_JSON='<service account json>' node scripts/notify-release.mjs
 *   ... --force        Re-send even if this versionCode was already announced.
 *   ... --dry-run      Resolve devices and print the plan without sending.
 *
 * The preferred device registry lives in Firestore at
 * users/{uid}/devices/{deviceId}. A compatibility field on users/{uid} is also
 * supported for projects whose older deployed rules do not yet include the
 * nested devices rule.
 */
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const MANIFEST_PATH = path.resolve("dist/releases/latest.json");
const EXPECTED_PACKAGE = "com.umi.caseflow";
const RELEASE_HOSTNAME = "umiren-d6a66.web.app";
const LIVE_MANIFEST_URL = `https://${RELEASE_HOSTNAME}/releases/latest.json`;
const TOKEN_SCOPES = [
  "https://www.googleapis.com/auth/firebase.messaging",
  "https://www.googleapis.com/auth/datastore",
].join(" ");

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");
const isForced = args.has("--force");
const isNudge = args.has("--nudge");
const NUDGE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function fail(message) {
  console.error(`[notify-release] ${message}`);
  process.exit(1);
}

function loadServiceAccount() {
  // FIREBASE_SERVICE_ACCOUNT was historically also used for a
  // google-services.json client config. Prefer the explicitly named service
  // account JSON so a public Firebase client config can never be parsed as
  // server credentials by mistake.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("FIREBASE_SERVICE_ACCOUNT is not valid JSON.");
  }

  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    fail("Service account JSON is missing client_email, private_key, or project_id.");
  }
  return parsed;
}

function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(serviceAccount) {
  if (!serviceAccount) {
    // Fallback to active credentials from Firebase CLI login
    const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
    let raw;
    try {
      raw = await readFile(configPath, "utf8");
    } catch {
      fail("FIREBASE_SERVICE_ACCOUNT is not set, and Firebase CLI config was not found. Please log in with 'firebase login' first.");
    }
    const parsed = JSON.parse(raw);
    const tokenData = parsed.tokens;
    const refreshToken = tokenData?.refresh_token || (tokenData?.active && tokenData.active.refresh_token);
    if (!refreshToken) {
      fail("No active credentials found in Firebase CLI config. Please run 'firebase login'.");
    }

    const clientId = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
    const clientSecret = "j9iVZfS8kkCEFUPaAeJV0sAi";

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      fail(`CLI token refresh failed with ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount.client_email,
    scope: TOKEN_SCOPES,
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(serviceAccount.private_key).toString("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });

  if (!response.ok) {
    fail(`Access token request failed with ${response.status}: ${await response.text()}`);
  }
  return (await response.json()).access_token;
}

/**
 * Prefers the manifest that is about to be (or has just been) published from
 * this checkout, and falls back to the live hosted manifest when the release
 * runs from an environment without the built output.
 */
async function readManifest() {
  let raw;
  try {
    raw = await readFile(MANIFEST_PATH, "utf8");
  } catch {
    const live = await fetch(LIVE_MANIFEST_URL);
    if (!live.ok) {
      fail(`Could not read manifest from ${MANIFEST_PATH} or ${LIVE_MANIFEST_URL}`);
    }
    raw = await live.text();
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("Release manifest is not valid JSON.");
  }

  if (
    !parsed.versionName ||
    typeof parsed.versionCode !== "number" ||
    !parsed.downloadUrl ||
    parsed.packageName !== EXPECTED_PACKAGE
  ) {
    fail("Release manifest has an unexpected schema.");
  }

  return parsed;
}

function firestoreUrl(projectId, suffix) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents${suffix}`;
}

async function firestoreRequest(projectId, pathSuffix, accessToken, init = {}) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents${pathSuffix}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return response;
}

function failOnPermissionDenied(operation, response) {
  if (response.status !== 403) return;
  fail(
    `${operation} was rejected by Firebase (403 Missing or insufficient permissions). ` +
      "Grant the notifier service account the Cloud Datastore User role " +
      "(roles/datastore.user) on project umiren-d6a66, then rerun the release notifier."
  );
}

/** Collects every enabled device registration across all users. */
async function listEnabledDevices(projectId, accessToken) {
  const response = await firestoreRequest(projectId, ":runQuery", accessToken, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "devices", allDescendants: true }],
      },
    }),
  });

  if (!response.ok) {
    failOnPermissionDenied("Device lookup", response);
    fail(`Device lookup failed with ${response.status}: ${await response.text()}`);
  }

  const rows = await response.json();
  const devices = [];
  const addDevice = (doc, fields, extra = {}) => {
    if (!fields) return;
    if (fields.enabled?.booleanValue !== true) return;
    const token = fields.token?.stringValue;
    if (!token) return;
    const lastNotifiedAt = fields.lastNotifiedAt?.stringValue ? Date.parse(fields.lastNotifiedAt.stringValue) : 0;
    devices.push({
      token,
      language: fields.language?.stringValue === "BM" ? "BM" : "EN",
      buildVersion: Number(fields.buildVersion?.integerValue ?? fields.buildVersion?.doubleValue ?? 0),
      documentPath: doc.name.split("/documents/")[1],
      lastNotifiedAt: Number.isNaN(lastNotifiedAt) ? 0 : lastNotifiedAt,
      ...extra,
    });
  };

  for (const row of rows) {
    const doc = row.document;
    if (!doc) continue;
    addDevice(doc, doc.fields);
  }

  // Compatibility registry: each signed-in installation is stored as a
  // separate updateNotificationDevice_* field on its own users/{uid} document.
  const fallbackResponse = await firestoreRequest(projectId, ":runQuery", accessToken, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
      },
    }),
  });
  if (fallbackResponse.ok) {
    const userRows = await fallbackResponse.json();
    for (const row of userRows) {
      const doc = row.document;
      if (!doc?.fields) continue;
      for (const [key, value] of Object.entries(doc.fields)) {
        if (!key.startsWith("updateNotificationDevice_")) continue;
        const sub = value.mapValue?.fields;
        if (!sub) continue;
        addDevice(doc, sub, { fieldPath: key });
      }
    }
  }
  return devices;
}

/** Prevents a second run from re-announcing the same release. */
async function claimRelease(projectId, accessToken, versionCode) {
  if (isNudge) return true; // Nudge mode runs periodically
  const docPath = `/system/releaseNotifications_${versionCode}`;
  if (!isForced) {
    const check = await firestoreRequest(projectId, docPath, accessToken);
    if (check.ok) {
      return false;
    }
  }

  if (!isDryRun) {
    // The create-only precondition closes the race where two CI jobs both
    // observe a missing marker and send the same release.
    const written = await firestoreRequest(
      projectId,
      `${docPath}?currentDocument.exists=false`,
      accessToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          fields: {
            versionCode: { integerValue: String(versionCode) },
            notifiedAt: { stringValue: new Date().toISOString() },
          },
        }),
      }
    );
    if (written.status === 409 && !isForced) return false;
    if (!written.ok && written.status !== 409) {
      fail(`Unable to record release marker: ${await written.text()}`);
    }
  }
  return true;
}

async function recordDeviceNotified(projectId, accessToken, device) {
  if (device.fieldPath) return; // Skip updating legacy map field paths
  const docPath = `/${device.documentPath}?updateMask.fieldPaths=lastNotifiedAt`;
  await firestoreRequest(projectId, docPath, accessToken, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        lastNotifiedAt: { stringValue: new Date().toISOString() },
      },
    }),
  });
}

async function deleteDevice(projectId, accessToken, device) {
  const suffix = device.fieldPath
    ? `/${device.documentPath}?updateMask.fieldPaths=${encodeURIComponent(device.fieldPath)}`
    : `/${device.documentPath}`;
  const response = await firestoreRequest(
    projectId,
    suffix,
    accessToken,
    device.fieldPath
      ? { method: "PATCH", body: JSON.stringify({ fields: {} }) }
      : { method: "DELETE" }
  );
  if (!response.ok) {
    console.warn(`[notify-release] Could not prune ${device.documentPath}: ${response.status}`);
  }
}

function buildMessage(device, manifest) {
  const isMalay = device.language === "BM";
  return {
    message: {
      token: device.token,
      notification: {
        title: isMalay
          ? (isNudge ? `Peringatan: Versi Umi ${manifest.versionName} Tersedia` : `Versi Umi ${manifest.versionName} Tersedia`)
          : (isNudge ? `Reminder: Umi ${manifest.versionName} Is Available` : `Umi ${manifest.versionName} Is Available`),
        body: isMalay
          ? (isNudge ? "Kemas kini ke versi terkini untuk kelancaran dan ciri baru!" : "Buka Umi untuk memuat turun kemas kini terbaru.")
          : (isNudge ? "Update to the latest version for improved features and stability!" : "Open Umi to download the latest update."),
      },
      data: {
        kind: "native-app-update",
        versionCode: String(manifest.versionCode),
      },
      android: {
        priority: "high",
        notification: {
          channel_id: "app-updates",
        },
      },
    },
  };
}

async function main() {
  const serviceAccount = loadServiceAccount();
  const manifest = await readManifest();
  const accessToken = await getAccessToken(serviceAccount);
  
  let projectId = serviceAccount?.project_id;
  if (!projectId) {
    try {
      const rc = JSON.parse(await readFile(".firebaserc", "utf8"));
      projectId = rc.projects?.default;
    } catch {}
    projectId = projectId || "umiren-d6a66";
  }

  const shouldSend = await claimRelease(projectId, accessToken, manifest.versionCode);
  if (!shouldSend) {
    console.log(`[notify-release] Version ${manifest.versionName} was already announced. Use --force to resend.`);
    return;
  }

  const devices = await listEnabledDevices(projectId, accessToken);
  const now = Date.now();

  // One notification per token, and never to a device already on this build.
  const seenTokens = new Set();
  const recipients = devices.filter((device) => {
    if (seenTokens.has(device.token)) return false;
    if (device.buildVersion >= manifest.versionCode) return false;
    
    // In nudge mode, verify 3-day cooldown
    if (isNudge && device.lastNotifiedAt && now - device.lastNotifiedAt < NUDGE_COOLDOWN_MS) {
      return false;
    }

    seenTokens.add(device.token);
    return true;
  });

  console.log(
    `[notify-release] ${isNudge ? "[Nudge Mode] " : ""}${manifest.versionName} (code ${manifest.versionCode}) -> ${recipients.length} device(s) of ${devices.length} registered.`
  );

  if (isDryRun) {
    console.log("[notify-release] Dry run: no notifications sent.");
    return;
  }

  let sent = 0;
  let pruned = 0;
  for (const device of recipients) {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildMessage(device, manifest)),
    });

    if (response.ok) {
      sent += 1;
      await recordDeviceNotified(projectId, accessToken, device);
      continue;
    }

    const errorBody = await response.text();
    if (response.status === 403 && errorBody.includes("cloudmessaging.messages.create")) {
      console.warn(
        "[notify-release] FCM sending was rejected. Grant the notifier service account " +
          "Firebase Cloud Messaging API Admin (roles/firebasecloudmessaging.admin), then retry with --force."
      );
      continue;
    }
    const isStaleToken =
      response.status === 404 ||
      errorBody.includes("UNREGISTERED") ||
      errorBody.includes("INVALID_ARGUMENT");

    if (isStaleToken) {
      await deleteDevice(projectId, accessToken, device);
      pruned += 1;
    } else {
      console.warn(`[notify-release] Send failed (${response.status}): ${errorBody}`);
    }
  }

  console.log(`[notify-release] Sent ${sent}, pruned ${pruned} stale registration(s).`);
}

main().catch((error) => fail(error.stack || error.message));
