#!/usr/bin/env node
/**
 * Creates the safe public listing projection used by the All Listings tab.
 *
 * Existing private listing documents contain sensitive document URLs. This
 * migration copies only browseable property fields into publicListings/{id}.
 * It is safe to run repeatedly because each projection is replaced by its
 * current private listing data.
 */
import { createSign } from "node:crypto";

const PROJECT_ID = "umiren-d6a66";
const PRIVATE_FIELDS = new Set(["geran", "icOwner", "spa", "bilUtility"]);
const TOKEN_SCOPE = "https://www.googleapis.com/auth/datastore";

function fail(message) {
  console.error(`[migrate-public-listings] ${message}`);
  process.exit(1);
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) fail("FIREBASE_SERVICE_ACCOUNT_JSON is not set.");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }

  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    fail("The service account JSON is missing client_email, private_key, or project_id.");
  }
  if (parsed.project_id !== PROJECT_ID) {
    fail(`The service account belongs to ${parsed.project_id}, not ${PROJECT_ID}.`);
  }
  return parsed;
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(serviceAccount) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount.client_email,
    scope: TOKEN_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer
    .sign(serviceAccount.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!response.ok) fail(`Access token request failed with ${response.status}: ${await response.text()}`);
  return (await response.json()).access_token;
}

function firestoreUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents${path}`;
}

async function firestoreRequest(path, accessToken, init = {}) {
  return fetch(firestoreUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function main() {
  const serviceAccount = loadServiceAccount();
  const accessToken = await getAccessToken(serviceAccount);
  const response = await firestoreRequest("/:runQuery", accessToken, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "listings" }],
      },
    }),
  });

  if (!response.ok) fail(`Listing lookup failed with ${response.status}: ${await response.text()}`);

  let migrated = 0;
  for (const row of await response.json()) {
    const document = row.document;
    if (!document) continue;

    const listingId = document.name.split("/").pop();
    if (!listingId) continue;

    const fields = Object.fromEntries(
      Object.entries(document.fields ?? {}).filter(([fieldName]) => !PRIVATE_FIELDS.has(fieldName))
    );
    fields.id = { stringValue: listingId };
    if (!fields.agentId && fields.userId) fields.agentId = fields.userId;
    if (!fields.agentId) {
      console.warn(`[migrate-public-listings] Skipping ${listingId}: no agentId/userId.`);
      continue;
    }

    const write = await firestoreRequest(
      `/publicListings/${encodeURIComponent(listingId)}`,
      accessToken,
      {
        method: "PATCH",
        body: JSON.stringify({ fields }),
      }
    );
    if (!write.ok) {
      fail(`Could not migrate ${listingId}: ${write.status} ${await write.text()}`);
    }
    migrated += 1;
  }

  console.log(`[migrate-public-listings] Migrated ${migrated} listing(s).`);
}

main().catch((error) => fail(error.stack || error.message));