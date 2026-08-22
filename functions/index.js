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

const crypto = require("crypto");

/**
 * Server-side verification for the Admin Access Code.
 * If valid, generates a cryptographic session token and records the session securely.
 */
exports.verifyAdminAccessCode = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed. Use POST." });
        return;
      }

      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) {}
      }
      const passcode = body?.passcode;
      const MASTER_KEY = (process.env.ADMIN_ACCESS_CODE || "").trim();

      if (!MASTER_KEY) {
        logger.error("ADMIN_ACCESS_CODE environment variable is not configured.");
        res.status(500).json({ error: "Server configuration error." });
        return;
      }

      if (!passcode || typeof passcode !== "string" || passcode.trim() !== MASTER_KEY) {
        logger.warn("Invalid admin passcode attempt.");
        res.status(401).json({ error: "Invalid access code" });
        return;
      }

      // Generate a cryptographically secure session token
      const sessionId = "session_" + crypto.randomBytes(16).toString("hex");
      const timestamp = Date.now();
      const expiresAt = timestamp + (24 * 60 * 60 * 1000); // 24 hours
      
      const payload = `${sessionId}:${timestamp}:${expiresAt}:admin`;
      const secret = (process.env.SESSION_SECRET || "").trim();

      if (!secret) {
        logger.error("SESSION_SECRET environment variable is not configured.");
        res.status(500).json({ error: "Server configuration error." });
        return;
      }

      const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

      const sessionToken = `${payload}:${signature}`;

      // Record session in Firestore for auditing
      const db = admin.firestore();
      await db.collection("_admin_sessions").doc(sessionId).set({
        sessionId,
        role: "admin",
        createdAt: new Date(timestamp).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        clientIp: req.ip || "unknown",
      }).catch(e => logger.warn("Session logging warning:", e.message));

      // Generate a Firebase Auth Custom Token with admin claims
      const firebaseCustomToken = await admin.auth().createCustomToken("super_admin_web_portal", {
        role: "admin",
        admin: true,
        isSuperAdmin: true,
      });

      // Ensure user document exists with admin role
      await db.collection("users").doc("super_admin_web_portal").set({
        role: "admin",
        displayName: "Super Admin",
        email: "admin@drtmasterlisting.com",
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      logger.info("Admin access code verified successfully.");
      res.json({
        success: true,
        sessionToken,
        sessionId,
        role: "admin",
        displayName: "Super Admin",
        firebaseCustomToken,
      });
    } catch (error) {
      logger.error("verifyAdminAccessCode error:", error);
      res.status(500).json({ error: "Authentication failed. Please try again." });
    }
  }
);

/**
 * Server-side Admin Endpoint for Listing Status Updates.
 * Acts as an authorized backup to client-side Firestore updates.
 */
exports.adminUpdateListingStatus = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed. Use POST." });
        return;
      }

      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) {}
      }

      const { listingId, status } = body || {};
      if (!listingId || !status) {
        res.status(400).json({ error: "listingId and status are required." });
        return;
      }

      const db = admin.firestore();
      const now = new Date().toISOString();

      await db.collection("publicListings").doc(listingId).set(
        { status, updatedAt: now },
        { merge: true }
      );

      await db.collection("listings").doc(listingId).set(
        { status, updatedAt: now },
        { merge: true }
      ).catch(() => {});

      logger.info(`Admin updated listing ${listingId} to status '${status}'`);
      res.json({ success: true, listingId, status, updatedAt: now });
    } catch (error) {
      logger.error("adminUpdateListingStatus error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);


