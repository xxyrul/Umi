const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const NUDGE_COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000; // 2 Days cooldown

/**
 * Runs every day at 9:00 AM (Asia/Kuala_Lumpur)
 * Finds devices running outdated version (< latest versionCode) and sends a nudge reminder.
 */
exports.dailyUpdateNudge = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Asia/Kuala_Lumpur",
    retryCount: 1,
  },
  async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();

    try {
      // 1. Fetch live latest manifest from hosting
      const manifestRes = await fetch("https://umiren-d6a66.web.app/releases/latest.json", {
        headers: { "Cache-Control": "no-cache" },
      });

      if (!manifestRes.ok) {
        logger.error("Could not fetch live manifest:", manifestRes.status);
        return;
      }

      const manifest = await manifestRes.json();
      const latestCode = Number(manifest.versionCode);
      const latestName = manifest.versionName;

      if (!latestCode || isNaN(latestCode)) {
        logger.error("Invalid manifest versionCode:", manifest);
        return;
      }

      logger.info(`Checking for devices outdated compared to Code ${latestCode} (v${latestName})`);

      // 2. Query all registered device documents
      const devicesSnap = await db.collectionGroup("devices").where("enabled", "==", true).get();

      if (devicesSnap.empty) {
        logger.info("No registered devices found.");
        return;
      }

      const now = Date.now();
      let sentCount = 0;
      let skippedCount = 0;

      for (const doc of devicesSnap.docs) {
        const data = doc.data();
        const token = data.token;
        const deviceBuild = Number(data.buildVersion || 0);
        const lastNotified = data.lastNotifiedAt ? Date.parse(data.lastNotifiedAt) : 0;
        const isMalay = data.language === "BM";

        // Skip if already on latest version
        if (deviceBuild >= latestCode) {
          skippedCount++;
          continue;
        }

        // Skip if recently notified within cooldown
        if (now - lastNotified < NUDGE_COOLDOWN_MS) {
          skippedCount++;
          continue;
        }

        if (!token) {
          continue;
        }

        const message = {
          token,
          notification: {
            title: isMalay
              ? `Peringatan: Versi Artha ${latestName} Tersedia`
              : `Reminder: Artha ${latestName} Is Available`,
            body: isMalay
              ? "Kemas kini ke versi terkini untuk kelancaran dan ciri baru!"
              : "Update to the latest version for improved features and stability!",
          },
          data: {
            kind: "native-app-update",
            versionCode: String(latestCode),
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "app-updates",
            },
          },
        };

        try {
          await messaging.send(message);
          sentCount++;
          await doc.ref.update({ lastNotifiedAt: new Date().toISOString() });
        } catch (err) {
          logger.warn(`Failed sending nudge to ${doc.id}:`, err.message);
          if (
            err.code === "messaging/registration-token-not-registered" ||
            err.code === "messaging/invalid-registration-token"
          ) {
            await doc.ref.delete().catch(() => {});
          }
        }
      }

      logger.info(
        `Nudge Complete: Sent ${sentCount} reminders, skipped ${skippedCount} devices (up-to-date or in cooldown).`
      );
    } catch (error) {
      logger.error("Daily update nudge failed:", error);
    }
  }
);

const { onRequest } = require("firebase-functions/v2/https");

exports.sendInstantUpdatePush = onRequest(
  { cors: true },
  async (req, res) => {
    const db = admin.firestore();
    const messaging = admin.messaging();

    try {
      const manifestRes = await fetch("https://umiren-d6a66.web.app/releases/latest.json", {
        headers: { "Cache-Control": "no-cache" },
      });

      const manifest = await manifestRes.json();
      const latestCode = Number(manifest.versionCode);
      const latestName = manifest.versionName;

      const devicesSnap = await db.collectionGroup("devices").where("enabled", "==", true).get();
      let sentCount = 0;

      for (const doc of devicesSnap.docs) {
        const data = doc.data();
        const token = data.token;
        if (!token) continue;

        const isMalay = data.language === "BM";
        const message = {
          token,
          notification: {
            title: isMalay
              ? `🚀 Versi Artha ${latestName} Kini Tersedia!`
              : `🚀 Artha ${latestName} Is Now Available!`,
            body: isMalay
              ? "Kemas kini ke versi terkini untuk logo baharu, butang pintar, dan prestasi pantas."
              : "Update now to enjoy the new logo, smart buttons, and faster performance.",
          },
          data: {
            kind: "native-app-update",
            versionCode: String(latestCode),
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "app-updates",
              sound: "default",
            },
          },
        };

        try {
          await messaging.send(message);
          sentCount++;
          await doc.ref.update({ lastNotifiedAt: new Date().toISOString() });
        } catch (err) {
          logger.warn(`Failed sending to ${doc.id}:`, err.message);
        }
      }

      res.json({ success: true, sentCount, latestVersion: latestName });
    } catch (error) {
      logger.error("Instant push failed:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Sends a broadcast push notification to all registered Android devices.
 * Called by the web admin panel after writing an announcement to Firestore.
 *
 * Expects JSON body: { titleEN, titleBM, messageEN, messageBM, type }
 */
exports.sendBroadcastPush = onRequest(
  { cors: true },
  async (req, res) => {
    const db = admin.firestore();
    const messaging = admin.messaging();

    try {
      const { titleEN, titleBM, messageEN, messageBM, type } = req.body || {};

      if (!titleEN || !messageEN) {
        res.status(400).json({ error: "titleEN and messageEN are required." });
        return;
      }

      const devicesSnap = await db.collectionGroup("devices").where("enabled", "==", true).get();
      let sentCount = 0;
      let failCount = 0;

      for (const doc of devicesSnap.docs) {
        const data = doc.data();
        const token = data.token;
        if (!token) continue;

        const isMalay = data.language === "BM";
        const title = isMalay ? (titleBM || titleEN) : titleEN;
        const body = isMalay ? (messageBM || messageEN) : messageEN;

        const message = {
          token,
          notification: { title, body },
          data: {
            kind: "broadcast-announcement",
            type: type || "GENERAL",
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "announcements",
              sound: "default",
            },
          },
        };

        try {
          await messaging.send(message);
          sentCount++;
        } catch (err) {
          failCount++;
          logger.warn(`Failed sending broadcast to ${doc.id}:`, err.message);
          if (
            err.code === "messaging/registration-token-not-registered" ||
            err.code === "messaging/invalid-registration-token"
          ) {
            await doc.ref.delete().catch(() => {});
          }
        }
      }

      res.json({ success: true, sentCount, failCount });
    } catch (error) {
      logger.error("Broadcast push failed:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
