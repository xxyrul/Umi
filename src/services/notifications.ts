import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request local notification permissions from the operating system
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("Notification permissions not granted");
      return false;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("case-reminders", {
        name: "Case Follow-up Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6366F1",
      });
      await Notifications.setNotificationChannelAsync("app-updates", {
        name: "App Updates",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6366F1",
      });
    }

    return true;
  } catch (error) {
    console.error("Error requesting notification permissions:", error);
    return false;
  }
}

/**
 * Schedule a local push notification for a specific property case follow-up date
 */
export async function scheduleCaseReminder(
  caseId: string,
  propertyName: string,
  reminderNote: string,
  targetDate: Date
): Promise<string | null> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    // Check if date is in the future
    const now = new Date();
    if (targetDate.getTime() <= now.getTime()) {
      console.warn("Reminder date must be in the future");
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `📌 Follow-Up Reminder: ${propertyName}`,
        body: reminderNote || `Time to check on case details for ${propertyName}`,
        data: { caseId },
        sound: true,
      },
      trigger: {
        date: targetDate,
        channelId: "case-reminders",
      },
    });

    return notificationId;
  } catch (error) {
    console.error("Error scheduling notification:", error);
    return null;
  }
}

/**
 * Cancel a previously scheduled reminder notification
 */
export async function cancelCaseReminder(notificationId: string): Promise<void> {
  try {
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
  } catch (error) {
    console.error("Error cancelling notification:", error);
  }
}
