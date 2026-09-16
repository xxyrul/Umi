const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

// Secrets — managed via Firebase Secret Manager, never in source code
const ADMIN_ACCESS_CODE = defineSecret("ADMIN_ACCESS_CODE");
const SESSION_SECRET = defineSecret("SESSION_SECRET");

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
      const manifestRes = await fetch("https://artharen.web.app/releases/latest.json", {
        headers: { "Cache-Control": "no-cache" },
      });

      const manifest = await manifestRes.json();
      const latestCode = Number(manifest.versionCode);
      const latestName = manifest.versionName;

      if (!latestCode) {
        logger.warn("No versionCode in manifest, skipping nudge.");
        return;
      }

      const devicesSnap = await db.collectionGroup("devices").get();

      // Deduplicate: one notification per unique FCM token
      const seenTokens = new Set();
      let nudgedCount = 0;

      for (const doc of devicesSnap.docs) {
        const data = doc.data();
        if (data.enabled === false) continue;
        const token = data.token;
        if (!token || seenTokens.has(token)) continue;
        seenTokens.add(token);

        const deviceVersion = Number(data.appVersionCode || 0);
        if (deviceVersion >= latestCode) continue;

        const lastNudged = data.lastNudgedAt ? new Date(data.lastNudgedAt).getTime() : 0;
        if (Date.now() - lastNudged < NUDGE_COOLDOWN_MS) continue;

        const isMalay = data.language === "BM";
        const title = isMalay ? `Artha ${latestName} Tersedia!` : `Artha ${latestName} Available!`;
        const body = isMalay
          ? "Kemaskini baharu dengan ciri-ciri dan penambahbaikan terkini. Ketik untuk muat turun."
          : "New update with the latest features and improvements. Tap to download.";

        try {
          await messaging.send({
            token,
            notification: { title, body },
            data: { kind: "update-nudge", versionName: latestName, versionCode: String(latestCode) },
            android: { priority: "normal", notification: { channel_id: "updates", icon: "ic_notification" } },
          });
          await doc.ref.update({ lastNudgedAt: new Date().toISOString() });
          nudgedCount++;
        } catch (err) {
          logger.warn(`Failed nudge to ${doc.id}:`, err.message);
          if (err.code === "messaging/registration-token-not-registered" ||
              err.code === "messaging/invalid-registration-token") {
            await doc.ref.delete().catch(() => {});
          }
        }
      }

      logger.info(`Daily nudge complete. Nudged ${nudgedCount} unique devices.`);
    } catch (err) {
      logger.error("dailyUpdateNudge error:", err);
    }
  }
);


/**
 * Helper to verify Admin authorization via HMAC session token or Firebase Auth Admin token.
 * NO hardcoded fallback passcodes — credentials must come from Firebase Secret Manager.
 */
async function verifyAdminAuthorization(req, accessCodeSecret, sessionSecretValue) {
  let body = req.body;
  if (Buffer.isBuffer(body)) {
    try { body = JSON.parse(body.toString("utf8")); } catch (e) {}
  } else if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) {}
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization;
  let token = null;
  if (authHeader && typeof authHeader === "string") {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      token = parts[1].trim();
    } else {
      token = authHeader.trim();
    }
  }

  // Fallback: check body fields
  if (!token && body) {
    token = body.sessionToken || body.token;
  }

  if (!token) return false;

  const secret = (sessionSecretValue || "").trim();

  // 1. Try HMAC session token verification (format: sessionId:timestamp:expiresAt:admin:signature)
  if (token.includes(":")) {
    const tokenParts = token.split(":");
    if (tokenParts.length === 5) {
      const [sessionId, timestamp, expiresAt, role, signature] = tokenParts;
      const now = Date.now();
      if (Number(expiresAt) > now && role === "admin" && secret) {
        const payload = `${sessionId}:${timestamp}:${expiresAt}:${role}`;
        const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
        try {
          if (crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSig, "hex"))) {
            return true;
          }
        } catch (e) {}
      }
    }
  }

  // 2. Try Firebase Auth ID token verification
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded && (
      decoded.admin === true ||
      decoded.role === "admin" ||
      decoded.isSuperAdmin === true ||
      decoded.uid === "super_admin_web_portal"
    )) {
      return true;
    }
  } catch (err) {
    // Not a valid Firebase ID token — continue
  }

  return false;
}

exports.sendInstantUpdatePush = onRequest(
  { cors: true, invoker: "public", secrets: [SESSION_SECRET] },
  async (req, res) => {
    const isAuthorized = await verifyAdminAuthorization(req, null, SESSION_SECRET.value());
    if (!isAuthorized) {
      res.status(403).json({ error: "Unauthorized. Admin credentials required." });
      return;
    }

    const db = admin.firestore();
    const messaging = admin.messaging();

    try {
      const manifestRes = await fetch("https://artharen.web.app/releases/latest.json", {
        headers: { "Cache-Control": "no-cache" },
      });

      const manifest = await manifestRes.json();
      const latestCode = Number(manifest.versionCode);
      const latestName = manifest.versionName;

      const devicesSnap = await db.collectionGroup("devices").get();
      const seenTokens = new Set();
      let sentCount = 0;

      for (const doc of devicesSnap.docs) {
        const data = doc.data();
        if (data.enabled === false) continue;
        const token = data.token;
        if (!token || seenTokens.has(token)) continue;
        seenTokens.add(token);

        const isMalay = data.language === "BM";
        const title = isMalay
          ? `Artha ${latestName} Tersedia!`
          : `Artha ${latestName} is Available!`;
        const body = isMalay
          ? "Kemaskini baharu dengan ciri-ciri terkini. Ketik untuk muat turun sekarang."
          : "New update with the latest features. Tap to download now.";

        const message = {
          token,
          notification: { title, body },
          data: {
            kind: "instant-update-push",
            versionName: latestName,
            versionCode: String(latestCode),
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "updates",
              icon: "ic_notification",
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
  { cors: true, invoker: "public", secrets: [SESSION_SECRET] },
  async (req, res) => {
    const isAuthorized = await verifyAdminAuthorization(req, null, SESSION_SECRET.value());
    if (!isAuthorized) {
      res.status(403).json({ error: "Unauthorized. Admin credentials required." });
      return;
    }

    const db = admin.firestore();
    const messaging = admin.messaging();

    try {
      let body = req.body;
      if (Buffer.isBuffer(body)) {
        try { body = JSON.parse(body.toString("utf8")); } catch (e) {}
      } else if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) {}
      }
      const { titleEN, titleBM, messageEN, messageBM, type } = body || {};

      if (!titleEN && !titleBM && !messageEN && !messageBM) {
        res.status(400).json({ error: "Title and message are required." });
        return;
      }

      const devicesSnap = await db.collectionGroup("devices").get();
      const seenTokens = new Set();
      let sentCount = 0;
      let failCount = 0;

      for (const doc of devicesSnap.docs) {
        const data = doc.data();
        if (data.enabled === false) continue;
        const token = data.token;
        if (!token || seenTokens.has(token)) continue;
        seenTokens.add(token);

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
              icon: "ic_notification",
            },
          },
        };

        try {
          await messaging.send(message);
          sentCount++;
        } catch (err) {
          logger.warn(`Broadcast failed for ${doc.id}:`, err.message);
          failCount++;
        }
      }

      res.json({ success: true, sentCount, failCount });
    } catch (error) {
      logger.error("Broadcast push failed:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Server-side verification for the Admin Access Code.
 * Credentials come ONLY from Firebase Secret Manager — no hardcoded fallbacks.
 */
exports.verifyAdminAccessCode = onRequest(
  { cors: true, invoker: "public", secrets: [ADMIN_ACCESS_CODE, SESSION_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed. Use POST." });
        return;
      }

      let body = req.body;
      if (Buffer.isBuffer(body)) {
        try { body = JSON.parse(body.toString("utf8")); } catch (e) {}
      } else if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) {}
      }
      const passcode = body?.passcode;
      const configuredAccessCode = (ADMIN_ACCESS_CODE.value() || "").trim().replace(/^["']|["']$/g, '');

      if (!configuredAccessCode) {
        logger.error("ADMIN_ACCESS_CODE secret is not configured.");
        res.status(500).json({ error: "Server configuration error." });
        return;
      }

      if (!passcode || typeof passcode !== "string" || passcode.trim() !== configuredAccessCode) {
        logger.warn("Invalid admin passcode attempt.");
        res.status(401).json({ error: "Invalid access code" });
        return;
      }

      // Generate a cryptographically secure session token
      const sessionId = "session_" + crypto.randomBytes(16).toString("hex");
      const timestamp = Date.now();
      const expiresAt = timestamp + (24 * 60 * 60 * 1000); // 24 hours

      const payload = `${sessionId}:${timestamp}:${expiresAt}:admin`;
      const secret = (SESSION_SECRET.value() || "").trim();

      if (!secret) {
        logger.error("SESSION_SECRET is not configured.");
        res.status(500).json({ error: "Server configuration error." });
        return;
      }

      const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      const sessionToken = `${payload}:${signature}`;

      // Record session in Firestore for auditing (best-effort)
      const db = admin.firestore();
      await db.collection("_admin_sessions").doc(sessionId).set({
        sessionId,
        role: "admin",
        createdAt: new Date(timestamp).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        clientIp: req.ip || "unknown",
      }).catch(e => logger.warn("Session logging warning:", e.message));

      // Generate a Firebase Auth Custom Token with admin claims
      let firebaseCustomToken = null;
      try {
        firebaseCustomToken = await admin.auth().createCustomToken("super_admin_web_portal", {
          role: "admin",
          admin: true,
          isSuperAdmin: true,
        });
      } catch (tokenErr) {
        logger.warn("createCustomToken fallback:", tokenErr.message);
      }

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
  { cors: true, invoker: "public", secrets: [SESSION_SECRET] },
  async (req, res) => {
    try {
      const isAuthorized = await verifyAdminAuthorization(req, null, SESSION_SECRET.value());
      if (!isAuthorized) {
        res.status(403).json({ error: "Unauthorized. Admin credentials required." });
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed. Use POST." });
        return;
      }

      let body = req.body;
      if (Buffer.isBuffer(body)) {
        try { body = JSON.parse(body.toString("utf8")); } catch (e) {}
      } else if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) {}
      }

      const { listingId, status } = body || {};
      if (!listingId || !status) {
        res.status(400).json({ error: "listingId and status are required." });
        return;
      }

      const validStatuses = ["Aktif", "Active", "Booking", "Sold", "Terjual", "Draft", "Under Loan", "Under SPA", "Expired", "Sewa"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
        return;
      }

      const db = admin.firestore();
      const now = new Date().toISOString();

      // Admin SDK bypasses Firestore rules — this is intentional for admin operations
      await db.collection("publicListings").doc(listingId).update({ status, updatedAt: now });
      try {
        await db.collection("listings").doc(listingId).update({ status, updatedAt: now });
      } catch (e) {
        // listings doc may not exist for external/imported listings
      }

      res.json({ success: true, listingId, status });
    } catch (error) {
      logger.error("adminUpdateListingStatus error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * ☀️ Daily Digest Briefing (9:00 AM Asia/Kuala_Lumpur)
 * Personalised morning briefing — active case count + tasks for the day.
 */
exports.dailyDigestBriefingCron = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Asia/Kuala_Lumpur",
  },
  async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();

    try {
      logger.info("Starting 9:00 AM Daily Digest Briefing job...");

      const devicesSnap = await db.collectionGroup("devices").get();

      // Deduplicate: one notification per unique FCM token
      const seenTokens = new Set();
      let sentCount = 0;

      for (const doc of devicesSnap.docs) {
        const data = doc.data();
        if (data.enabled === false) continue;
        const token = data.token;
        const uid = data.uid || doc.ref.parent.parent?.id;
        if (!token || seenTokens.has(token)) continue;
        seenTokens.add(token);

        const isMalay = data.language === "BM";

        // Personalise with active case count
        let activeCount = 0;
        if (uid) {
          try {
            const casesSnap = await db.collection("cases")
              .where("userId", "==", uid)
              .where("status", "in", ["Active", "Booking Paid", "Loan Approved", "SPA Signed"])
              .get();
            activeCount = casesSnap.size;
          } catch (e) {
            // compound index may not exist for all users; skip gracefully
          }
        }

        const title = isMalay ? "☀️ Ringkasan Pagi Artha" : "☀️ Artha Daily Briefing";
        const body = isMalay
          ? activeCount > 0
            ? `Selamat pagi! Anda mempunyai ${activeCount} kes aktif dalam saluran transaksi hari ini.`
            : "Selamat pagi! Buka Artha untuk menyemak senarai hartanah dan tugasan anda hari ini."
          : activeCount > 0
            ? `Good morning! You have ${activeCount} active cases in your transaction pipeline today.`
            : "Good morning! Open Artha to review your property listings and tasks for today.";

        try {
          await messaging.send({
            token,
            notification: { title, body },
            data: { screen: "dashboard", type: "daily_digest" },
            android: {
              priority: "high",
              notification: { channel_id: "daily-digest", color: "#F59E0B", sound: "default" },
            },
          });
          sentCount++;
        } catch (err) {
          if (
            err.code === "messaging/registration-token-not-registered" ||
            err.code === "messaging/invalid-registration-token"
          ) {
            await doc.ref.delete().catch(() => {});
          }
        }
      }

      logger.info(`Daily Digest Complete: Delivered to ${sentCount} unique devices.`);
    } catch (error) {
      logger.error("Daily digest briefing cron failed:", error);
    }
  }
);
