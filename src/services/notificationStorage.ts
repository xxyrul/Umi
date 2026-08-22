import AsyncStorage from "@react-native-async-storage/async-storage";
import { firestore, auth } from "@/services/firebase";

export const READ_IDS_KEY = "@read_notification_ids";
export const LAST_SEEN_KEY = "@last_seen_notifications_at";
export const DISMISSED_KEY = "@dismissed_announcements";

/**
 * Hydrates and syncs notification read/dismissed states between local AsyncStorage
 * and Firestore user document (users/{uid}).
 * This ensures read status is retained when the user clears app data or logs in on a new device.
 */
export async function syncNotificationStateWithCloud(targetUid?: string): Promise<{
  readIds: string[];
  dismissedIds: string[];
  lastSeenAt: string | null;
}> {
  const uid = targetUid || auth().currentUser?.uid;

  // 1. Read local state
  let localReadIds: string[] = [];
  let localDismissedIds: string[] = [];
  let localLastSeen: string | null = null;

  try {
    const [storedRead, storedDismissed, storedLastSeen] = await Promise.all([
      AsyncStorage.getItem(READ_IDS_KEY),
      AsyncStorage.getItem(DISMISSED_KEY),
      AsyncStorage.getItem(LAST_SEEN_KEY),
    ]);

    if (storedRead) localReadIds = JSON.parse(storedRead);
    if (storedDismissed) localDismissedIds = JSON.parse(storedDismissed);
    if (storedLastSeen) localLastSeen = storedLastSeen;
  } catch (err) {
    console.warn("[notificationStorage] Failed reading local state:", err);
  }

  // If no logged in user, return local state
  if (!uid) {
    return {
      readIds: localReadIds,
      dismissedIds: localDismissedIds,
      lastSeenAt: localLastSeen,
    };
  }

  // 2. Fetch remote user doc from Firestore
  try {
    const userDoc = await firestore().collection("users").doc(uid).get();
    const data = userDoc.exists ? userDoc.data() : null;

    const cloudReadIds: string[] = Array.isArray(data?.readNotificationIds)
      ? data.readNotificationIds
      : [];
    const cloudDismissedIds: string[] = Array.isArray(data?.dismissedAnnouncementIds)
      ? data.dismissedAnnouncementIds
      : [];
    const cloudLastSeen: string | null =
      typeof data?.lastSeenNotificationsAt === "string" ? data.lastSeenNotificationsAt : null;

    // 3. Merge unique IDs (Capped to prevent unbounded growth)
    const MAX_READ_IDS = 200;
    const MAX_DISMISSED_IDS = 100;
    const mergedReadIds = Array.from(new Set([...localReadIds, ...cloudReadIds])).slice(-MAX_READ_IDS);
    const mergedDismissedIds = Array.from(new Set([...localDismissedIds, ...cloudDismissedIds])).slice(-MAX_DISMISSED_IDS);

    // Pick latest timestamp
    let mergedLastSeen = localLastSeen;
    if (cloudLastSeen) {
      if (!localLastSeen || new Date(cloudLastSeen).getTime() > new Date(localLastSeen).getTime()) {
        mergedLastSeen = cloudLastSeen;
      }
    }

    // 4. Update local storage
    await Promise.all([
      AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(mergedReadIds)),
      AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(mergedDismissedIds)),
      mergedLastSeen ? AsyncStorage.setItem(LAST_SEEN_KEY, mergedLastSeen) : Promise.resolve(),
    ]);

    // 5. Update cloud if local had new IDs that weren't in cloud yet
    const hasNewCloudRead = mergedReadIds.length > cloudReadIds.length;
    const hasNewCloudDismissed = mergedDismissedIds.length > cloudDismissedIds.length;
    const hasNewLastSeen = mergedLastSeen && mergedLastSeen !== cloudLastSeen;

    if (hasNewCloudRead || hasNewCloudDismissed || hasNewLastSeen) {
      firestore()
        .collection("users")
        .doc(uid)
        .set(
          {
            readNotificationIds: mergedReadIds,
            dismissedAnnouncementIds: mergedDismissedIds,
            ...(mergedLastSeen ? { lastSeenNotificationsAt: mergedLastSeen } : {}),
          },
          { merge: true }
        )
        .catch((err) => {
          console.warn("[notificationStorage] Failed pushing merged state to cloud:", err);
        });
    }

    return {
      readIds: mergedReadIds,
      dismissedIds: mergedDismissedIds,
      lastSeenAt: mergedLastSeen,
    };
  } catch (err) {
    console.warn("[notificationStorage] Failed syncing with Firestore:", err);
    return {
      readIds: localReadIds,
      dismissedIds: localDismissedIds,
      lastSeenAt: localLastSeen,
    };
  }
}

/**
 * Marks a single notification as read locally and in Firestore.
 */
export async function markNotificationAsRead(id: string, targetUid?: string): Promise<string[]> {
  const uid = targetUid || auth().currentUser?.uid;

  let current: string[] = [];
  try {
    const stored = await AsyncStorage.getItem(READ_IDS_KEY);
    if (stored) current = JSON.parse(stored);
  } catch {}

  if (!current.includes(id)) {
    const updated = [...current, id];
    await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(updated)).catch(() => {});

    if (uid) {
      firestore()
        .collection("users")
        .doc(uid)
        .set(
          {
            readNotificationIds: firestore.FieldValue.arrayUnion(id),
          },
          { merge: true }
        )
        .catch(() => {});
    }
    return updated;
  }

  return current;
}

/**
 * Marks multiple notifications as read and updates the lastSeen timestamp.
 */
export async function markAllNotificationsAsRead(
  ids: string[],
  targetUid?: string
): Promise<string[]> {
  const uid = targetUid || auth().currentUser?.uid;

  let current: string[] = [];
  try {
    const stored = await AsyncStorage.getItem(READ_IDS_KEY);
    if (stored) current = JSON.parse(stored);
  } catch {}

  const merged = Array.from(new Set([...current, ...ids]));
  const nowIso = new Date().toISOString();

  await Promise.all([
    AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(merged)),
    AsyncStorage.setItem(LAST_SEEN_KEY, nowIso),
  ]).catch(() => {});

  if (uid) {
    firestore()
      .collection("users")
      .doc(uid)
      .set(
        {
          readNotificationIds: merged,
          lastSeenNotificationsAt: nowIso,
        },
        { merge: true }
      )
      .catch(() => {});
  }

  return merged;
}

/**
 * Dismisses an announcement card from the dashboard locally and in Firestore.
 */
export async function dismissAnnouncementCloud(
  id: string,
  targetUid?: string
): Promise<string[]> {
  const uid = targetUid || auth().currentUser?.uid;

  let current: string[] = [];
  try {
    const stored = await AsyncStorage.getItem(DISMISSED_KEY);
    if (stored) current = JSON.parse(stored);
  } catch {}

  if (!current.includes(id)) {
    const updated = [...current, id];
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(updated)).catch(() => {});

    if (uid) {
      firestore()
        .collection("users")
        .doc(uid)
        .set(
          {
            dismissedAnnouncementIds: firestore.FieldValue.arrayUnion(id),
          },
          { merge: true }
        )
        .catch(() => {});
    }
    return updated;
  }

  return current;
}
