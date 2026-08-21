import { readFile } from "fs/promises";
import os from "os";
import path from "path";

async function getAccessToken() {
  const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const refreshToken = parsed.tokens?.refresh_token || parsed.tokens?.active?.refresh_token;

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

  const data = await response.json();
  return data.access_token;
}

async function listEnabledDevices(projectId, accessToken) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "devices", allDescendants: true }],
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Device query failed: ${res.status} ${await res.text()}`);
  }

  const rows = await res.json();
  const devices = [];
  const seen = new Set();

  for (const row of rows) {
    const doc = row.document;
    if (!doc || !doc.fields) continue;
    if (doc.fields.enabled?.booleanValue !== true) continue;
    const token = doc.fields.token?.stringValue;
    if (!token || seen.has(token)) continue;
    seen.add(token);

    devices.push({
      token,
      language: doc.fields.language?.stringValue === "BM" ? "BM" : "EN",
      documentPath: doc.name.split("/documents/")[1],
    });
  }

  return devices;
}

async function sendBroadcast() {
  const projectId = "umiren-d6a66";
  const accessToken = await getAccessToken();

  const titleBM = "💡 Tip: Kalkulator Ansuran Terus Pada Listing!";
  const bodyBM = "Tekan anggaran bulanan (~RM 1,200/bln) di bawah harga listing untuk buka kalkulator pinjaman segera! Kemaskini ke v1.4.2 untuk cuba fungsi ini.";

  const titleEN = "💡 Agent Tip: Instant Loan Calculator on Listings!";
  const bodyEN = "Tap the monthly estimate (~RM 1,200/mo) under the listing price to open the instant loan calculator! Update to v1.4.2 to try this feature.";

  const messageBM = "Tahukah anda? Pada setiap muka surat listing, anda boleh tekan butang anggaran bulanan (contoh: ~RM 1,200/bln) di bawah harga untuk buka kalkulator pinjaman segera.\n\nAnda boleh ubah deposit (0% Full Loan, 10%, 20%), tempoh pinjaman, dan kadar faedah bank/LPPSA terus semasa berunding dengan pembeli!\n\n🚀 Sila kemaskini aplikasi anda ke versi v1.4.2 untuk menikmati pengalaman yang paling lancar.";
  const messageEN = "Did you know? Inside any listing page, tap the monthly installment badge (e.g. ~RM 1,200/mo) right below the property price to open the instant loan calculator.\n\nEasily adjust downpayments (0% Full Loan, 10%, 20%), loan tenure, and bank/LPPSA interest rates on the spot during client viewings!\n\n🚀 Please update your app to v1.4.2 to enjoy the latest features and smoothest performance.";

  // 1. Post to in-app announcement collection in Firestore
  const docId = `ann_feature_calc_${Date.now()}`;
  const firestoreDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/announcements/${docId}`;

  const annRes = await fetch(firestoreDocUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        title: { stringValue: titleBM },
        titleEN: { stringValue: titleEN },
        titleBM: { stringValue: titleBM },
        message: { stringValue: messageBM },
        messageEN: { stringValue: messageEN },
        messageBM: { stringValue: messageBM },
        type: { stringValue: "LISTING_ALERT" },
        sentBy: { stringValue: "Artha Core Team" },
        createdAt: { stringValue: new Date().toISOString() },
      },
    }),
  });

  if (annRes.ok) {
    console.log("[Broadcast] In-app announcement created successfully in Firestore.");
  } else {
    console.warn("[Broadcast] Failed creating in-app announcement:", await annRes.text());
  }

  // 2. Fetch devices and send FCM push notifications
  const devices = await listEnabledDevices(projectId, accessToken);
  console.log(`[Broadcast] Found ${devices.length} active device(s) to notify.`);

  let sent = 0;
  for (const device of devices) {
    const isMalay = device.language === "BM";
    const title = isMalay ? titleBM : titleEN;
    const body = isMalay ? bodyBM : bodyEN;

    const fcmPayload = {
      message: {
        token: device.token,
        notification: {
          title,
          body,
        },
        data: {
          kind: "broadcast-announcement",
          type: "announcement",
          docId,
          channelId: "announcements",
        },
        android: {
          priority: "HIGH",
          notification: {
            channel_id: "announcements",
            sound: "default",
            color: "#E11D48",
          },
        },
      },
    };

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fcmPayload),
    });

    if (res.ok) {
      sent += 1;
    } else {
      console.warn(`[Broadcast] Failed sending to ${device.documentPath}:`, res.status, await res.text());
    }
  }

  console.log(`[Broadcast] Complete! Sent push notifications to ${sent} device(s).`);
}

sendBroadcast().catch(console.error);
