/**
 * Update announcements are an Android-only feature. These no-op exports keep
 * the Expo web preview working without pulling in native push APIs.
 */
export const UPDATE_CHANNEL_ID = "app-updates";

export async function registerForUpdateNotifications() {
  return false;
}

export async function getUpdateNotificationsEnabled() {
  return false;
}

export async function hasUpdateNotificationPermission() {
  return false;
}

export function getLastUpdateNotificationFailure() {
  return null;
}

export async function setUpdateNotificationsEnabled() {
  return false;
}

export async function unregisterFromUpdateNotifications() {}

export function configureUpdateNotificationHandlers() {
  return () => {};
}
