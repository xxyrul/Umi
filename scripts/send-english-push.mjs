import path from "node:path";
import os from "node:os";
import { readFile } from "node:fs/promises";

async function getAccessToken() {
  const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const tokenData = parsed.tokens;
  const refreshToken = tokenData?.refresh_token || (tokenData?.active && tokenData.active.refresh_token);

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

async function main() {
  const accessToken = await getAccessToken();
  const projectId = "umiren-d6a66";

  const titleEN = "📢 Version 1.4.0 (Build 52) Update is Ready";
  const messageEN = "Apologies for the earlier inconvenience during the update download. The official Artha v1.4.0 (Build 52) package is now live. Please open Profile > App Version and tap 'Download & Install Update' to get the latest features. Thank you!";

  const titleBM = "📢 Kemas Kini Versi 1.4.0 (Build 52) Kini Sedia";
  const messageBM = "Mohon maaf atas sebarang kesulitan tadi semasa muat turun kemas kini. Pakej rasmi Artha v1.4.0 (Build 52) kini sedia sepenuhnya. Sila buka Profil > Versi Aplikasi dan tekan 'Muat Turun & Pasang Kemas Kini' untuk menikmati fungsi baharu. Terima kasih!";

  const annId = "ann_" + Date.now();
  const now = new Date().toISOString();

  // 1. Write to Firestore announcements collection
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/announcements?documentId=${annId}`;
  await fetch(firestoreUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        title: { stringValue: titleEN },
        titleEN: { stringValue: titleEN },
        titleBM: { stringValue: titleBM },
        message: { stringValue: messageEN },
        messageEN: { stringValue: messageEN },
        messageBM: { stringValue: messageBM },
        type: { stringValue: "URGENT" },
        category: { stringValue: "URGENT" },
        sentBy: { stringValue: "Super Admin" },
        createdAt: { stringValue: now },
      }
    }),
  });

  // 2. Fetch all device tokens and send FCM Push Notifications with English text
  const usersUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`;
  const usersRes = await fetch(usersUrl, {
    headers: { "Authorization": `Bearer ${accessToken}` },
  });

  const usersData = await usersRes.json();
  const tokens = [];

  if (usersData.documents) {
    for (const doc of usersData.documents) {
      const fcmToken = doc.fields?.fcmToken?.stringValue || doc.fields?.pushToken?.stringValue;
      if (fcmToken && !tokens.includes(fcmToken)) {
        tokens.push(fcmToken);
      }

      const userId = doc.name.split("/").pop();
      try {
        const devicesUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}/devices`;
        const devicesRes = await fetch(devicesUrl, {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });
        const devicesData = await devicesRes.json();
        if (devicesData.documents) {
          for (const d of devicesData.documents) {
            const tok = d.fields?.fcmToken?.stringValue || d.fields?.token?.stringValue;
            if (tok && !tokens.includes(tok)) {
              tokens.push(tok);
            }
          }
        }
      } catch (e) {}
    }
  }

  let sent = 0;
  for (const token of tokens) {
    try {
      const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
      const fcmRes = await fetch(fcmUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: token,
            notification: {
              title: titleEN,
              body: messageEN,
            },
            data: {
              annId: annId,
              titleEN: titleEN,
              titleBM: titleBM,
              messageEN: messageEN,
              messageBM: messageBM,
              type: "URGENT",
              url: "umi://(tabs)/profile",
            },
            android: {
              priority: "high",
              notification: {
                sound: "default",
                channel_id: "artha_announcements",
                icon: "ic_notification",
                color: "#E11D48",
              }
            }
          }
        }),
      });

      if (fcmRes.ok) sent++;
    } catch (e) {}
  }

  console.log(`✅ Sent English push notification to ${sent}/${tokens.length} devices.`);
}

main().catch(console.error);
