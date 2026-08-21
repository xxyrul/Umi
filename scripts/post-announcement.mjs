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

async function postAnnouncement() {
  const token = await getAccessToken();
  const projectId = "umiren-d6a66";
  const docId = `ann_v1_4_1_${Date.now()}`;

  const titleEN = "🚀 Artha Update v1.4.1 Available!";
  const titleBM = "🚀 Kemaskini Artha v1.4.1 Kini Tersedia!";
  const messageEN = "What's new in v1.4.1:\n• Universal responsive UI scaling for all screen sizes\n• Refined 3-column photo grid & document vault\n• Smooth tab switching with zero photo glitches\n• Contextual listing counters & bilingual navigation";
  const messageBM = "Pembaharuan dalam v1.4.1:\n• Penskalaan UI responsif universal untuk semua skrin\n• Grid 3 lajur foto & peti besi dokumen lebih kemas\n• Peralihan tab lancar tanpa isu gambar bertindih\n• Pengiraan listing tepat & navigasi dwibahasa penuh";

  const firestoreDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/announcements/${docId}`;

  const res = await fetch(firestoreDocUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
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
        type: { stringValue: "GENERAL" },
        sentBy: { stringValue: "Artha Core Team" },
        createdAt: { stringValue: new Date().toISOString() },
      },
    }),
  });

  if (!res.ok) {
    console.error("Failed to post announcement:", res.status, await res.text());
  } else {
    console.log("Successfully posted v1.4.1 announcement to in-app Notification Inbox!");
  }
}

postAnnouncement().catch(console.error);
