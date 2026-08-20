import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { firebaseDB, firestore } from "@/services/firebase";
import { requestNotificationPermissions } from "@/services/notifications";

/**
 * Android update announcements.
 *
 * Delivery uses the FCM device token exposed by `expo-notifications` rather
 * than a second messaging library: on Android only one FirebaseMessagingService
 * receives messages, so mixing libraries would silently break either these
 * update alerts or the existing local case reminders.
 */

const DEVICE_ID_KEY = "umi.updateNotifications.deviceId";
const REGISTERED_USER_KEY = "umi.updateNotifications.registeredUserId";
const REGISTRATION_MODE_KEY = "umi.updateNotifications.registrationMode";
const OPT_OUT_KEY = "umi.updateNotifications.optedOut";
export const UPDATE_CHANNEL_ID = "app-updates";
const UPDATE_NOTIFICATION_KIND = "native-app-update";

export type UpdateNotificationFailure =
  | "permission-denied"
  | "token-unavailable"
  | "firestore-permission-denied"
  | "firestore-unauthenticated"
  | "firestore-unavailable"
  | "unknown";

let lastRegistrationFailure: UpdateNotificationFailure | null = null;

type UpdateNotificationOptions = {
  uid: string;
  language: "BM" | "EN";
};

function isSupportedPlatform() {
  return Platform.OS === "android" && !__DEV__;
}

function isUpdateNotification(data: unknown) {
  return Boolean(data && typeof data === "object" && (data as { kind?: string }).kind === UPDATE_NOTIFICATION_KIND);
}

async function getDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const newId = `android-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
}

function currentVersionMetadata() {
  const nativeBuildVersion = Number(Constants.nativeBuildVersion);
  const configuredBuildVersion = Number(Constants.expoConfig?.android?.versionCode);
  const versions = [nativeBuildVersion, configuredBuildVersion].filter(
    (version) => Number.isInteger(version) && version > 0
  );

  return {
    appVersion: Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "unknown",
    buildVersion: versions.length > 0 ? Math.max(...versions) : 0,
  };
}

function deviceDoc(uid: string, deviceId: string) {
  return firebaseDB.collection("users").doc(uid).collection("devices").doc(deviceId);
}

function userDeviceField(deviceId: string) {
  return `updateNotificationDevice_${deviceId}`;
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

function classifyFirestoreFailure(error: unknown): UpdateNotificationFailure {
  switch (errorCode(error)) {
    case "firestore/permission-denied":
      return "firestore-permission-denied";
    case "firestore/unauthenticated":
      return "firestore-unauthenticated";
    case "firestore/unavailable":
    case "firestore/network-request-failed":
      return "firestore-unavailable";
    default:
      return "unknown";
  }
}

function failRegistration(reason: UpdateNotificationFailure, error?: unknown) {
  lastRegistrationFailure = reason;
  console.warn("[updateNotifications] Registration failed:", reason, error);
  return false;
}

/**
 * Writes (or refreshes) this installation's registration. The same deviceId is
 * reused for the lifetime of the install, so a rotated token overwrites the old
 * record instead of creating a duplicate recipient.
 */
async function saveRegistration(uid: string, language: "BM" | "EN", token: string) {
  const deviceId = await getDeviceId();
  const now = new Date().toISOString();
  const constants: any = Platform.constants || {};
  const deviceBrand = constants.Brand || constants.Manufacturer || "";
  const deviceModel = constants.Model || "";
  const osVersion = constants.Release ? `Android ${constants.Release}` : `Android ${Platform.Version || ""}`;
  const deviceLabel = [deviceBrand, deviceModel].filter(Boolean).join(" ") || "Android Device";
  const versionMeta = currentVersionMetadata();

  const registration = {
    token,
    enabled: true,
    platform: "android",
    deviceBrand,
    deviceModel,
    deviceLabel,
    osVersion,
    language,
    ...versionMeta,
    tokenUpdatedAt: now,
    lastSeenAt: now,
  };

  try {
    await deviceDoc(uid, deviceId).set(registration, { merge: true });
    await AsyncStorage.setItem(REGISTRATION_MODE_KEY, "subcollection");
  } catch (error) {
    // Older deployed rules only allow the signed-in user to write the user
    // document itself. Keep update alerts usable until the nested rule can be
    // published, while retaining the preferred subcollection path whenever it
    // is available.
    if (errorCode(error) !== "firestore/permission-denied") throw error;
    await firebaseDB
      .collection("users")
      .doc(uid)
      .set({ [userDeviceField(deviceId)]: registration }, { merge: true });
    await AsyncStorage.setItem(REGISTRATION_MODE_KEY, "user-document");
  }

  // Update user profile record with last active device info
  try {
    await firebaseDB.collection("users").doc(uid).set({
      lastDevice: {
        deviceLabel,
        deviceBrand,
        deviceModel,
        osVersion,
        appVersion: versionMeta.appVersion,
        buildVersion: versionMeta.buildVersion,
        lastActiveAt: now,
      },
      lastActiveAt: now,
    }, { merge: true });
  } catch (e) {
    // Non-fatal if user doc update fails
  }

  await AsyncStorage.setItem(REGISTERED_USER_KEY, uid);
}

async function fetchDeviceToken() {
  const { data } = await Notifications.getDevicePushTokenAsync();
  return typeof data === "string" && data.length > 0 ? data : null;
}

/**
 * Registers a signed-in installation for update announcements.
 *
 * `interactive` is false during app start: an existing permission grant is
 * reused, but the user is never re-prompted in the background, and an explicit
 * opt-out is respected.
 */
export async function registerForUpdateNotifications(
  { uid, language }: UpdateNotificationOptions,
  interactive = false
) {
  lastRegistrationFailure = null;

  try {
    if (!isSupportedPlatform()) return failRegistration("unknown");

    const optedOut = await AsyncStorage.getItem(OPT_OUT_KEY);
    if (optedOut === "true" && !interactive) return failRegistration("unknown");

    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== "granted") {
      if (!interactive) return false;
      const granted = await requestNotificationPermissions();
      if (!granted) return failRegistration("permission-denied");
    }

    await Notifications.setNotificationChannelAsync(UPDATE_CHANNEL_ID, {
      name: "App Updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#6366F1",
    });

    const registeredUid = await AsyncStorage.getItem(REGISTERED_USER_KEY);
    if (registeredUid && registeredUid !== uid) {
      // Another account still owns the record for this install. Remove it with
      // the previous owner's path before claiming the device for this user.
      await removeRegistration(registeredUid);
    }

    let token: string | null;
    try {
      token = await fetchDeviceToken();
    } catch (error) {
      return failRegistration("token-unavailable", error);
    }
    if (!token) return failRegistration("token-unavailable");

    try {
      await saveRegistration(uid, language, token);
    } catch (error) {
      return failRegistration(classifyFirestoreFailure(error), error);
    }
    await AsyncStorage.removeItem(OPT_OUT_KEY);
    return true;
  } catch (error) {
    return failRegistration("unknown", error);
  }
}

export function getLastUpdateNotificationFailure() {
  return lastRegistrationFailure;
}

async function removeRegistration(uid: string) {
  const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) return;
  const mode = await AsyncStorage.getItem(REGISTRATION_MODE_KEY);
  if (mode === "user-document") {
    await firebaseDB
      .collection("users")
      .doc(uid)
      .update({ [userDeviceField(deviceId)]: firestore.FieldValue.delete() });
    return;
  }

  try {
    await deviceDoc(uid, deviceId).delete();
  } catch (error) {
    if (errorCode(error) !== "firestore/permission-denied") throw error;
    await firebaseDB
      .collection("users")
      .doc(uid)
      .update({ [userDeviceField(deviceId)]: firestore.FieldValue.delete() });
  }
}

/**
 * Reports whether this install currently receives update announcements.
 * Both the OS permission and the stored registration must still be present.
 */
export async function getUpdateNotificationsEnabled() {
  try {
    if (!isSupportedPlatform()) return false;

    const [permissions, registeredUid, optedOut] = await Promise.all([
      Notifications.getPermissionsAsync(),
      AsyncStorage.getItem(REGISTERED_USER_KEY),
      AsyncStorage.getItem(OPT_OUT_KEY),
    ]);

    return permissions.status === "granted" && Boolean(registeredUid) && optedOut !== "true";
  } catch (error) {
    console.warn("[updateNotifications] Status check failed:", error);
    return false;
  }
}

/** Returns the operating-system notification permission without requiring a
 * signed-in user or a Firestore device registration. */
export async function hasUpdateNotificationPermission() {
  try {
    if (!isSupportedPlatform()) return false;
    const permissions = await Notifications.getPermissionsAsync();
    return permissions.status === "granted";
  } catch (error) {
    console.warn("[updateNotifications] Permission check failed:", error);
    return false;
  }
}

/** Backs the Profile settings switch. Returns the resulting enabled state. */
export async function setUpdateNotificationsEnabled(options: UpdateNotificationOptions, enabled: boolean) {
  if (enabled) {
    return registerForUpdateNotifications(options, true);
  }

  await AsyncStorage.setItem(OPT_OUT_KEY, "true");
  await unregisterFromUpdateNotifications(options.uid);
  return false;
}

/**
 * Removes this device's registration. Called before sign-out completes so the
 * delete still passes the owner-only Firestore rule.
 */
export async function unregisterFromUpdateNotifications(uid?: string) {
  try {
    if (Platform.OS !== "android") return;

    const registeredUid = await AsyncStorage.getItem(REGISTERED_USER_KEY);
    const ownerUid = uid ?? registeredUid;
    if (!ownerUid) return;

    await removeRegistration(ownerUid);
    await AsyncStorage.removeItem(REGISTERED_USER_KEY);
    await AsyncStorage.removeItem(REGISTRATION_MODE_KEY);
  } catch (error) {
    console.warn("[updateNotifications] Removal failed:", error);
  }
}

/**
 * Keeps the stored token current when Android rotates it, and routes update
 * notification taps back into the existing manifest-validated update flow.
 *
 * The notification payload is treated as untrusted: the tap only triggers a
 * fresh check of the signed release manifest, which performs the package and
 * version validation before any download is offered.
 */
export function configureUpdateNotificationHandlers(
  getUser: () => { uid: string; language: "BM" | "EN" } | null,
  onUpdateTapped: () => void
) {
  if (Platform.OS !== "android") return () => {};

  let lastHandledResponseId: string | null = null;
  const handleResponse = (response: Notifications.NotificationResponse) => {
    const responseId = response.notification.request.identifier;
    if (lastHandledResponseId === responseId) return;
    if (!isUpdateNotification(response.notification.request.content.data)) return;

    lastHandledResponseId = responseId;
    onUpdateTapped();
  };

  const tokenSubscription = Notifications.addPushTokenListener((token) => {
    const user = getUser();
    if (!user || typeof token.data !== "string") return;
    void saveRegistration(user.uid, user.language, token.data).catch((error) =>
      console.warn("[updateNotifications] Token refresh failed:", error)
    );
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handleResponse(response);
  });

  // A notification that launched the app from a cold start is not replayed to
  // the listener above, so it is handled explicitly here.
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) handleResponse(response);
    })
    .catch((error) => console.warn("[updateNotifications] Initial notification lookup failed:", error));

  return () => {
    tokenSubscription.remove();
    responseSubscription.remove();
  };
}
