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
