import { Alert, Platform } from "react-native";
import * as Calendar from "expo-calendar";

export interface NativeCalendarEventParams {
  title: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  notes?: string;
}

/**
 * Request calendar permissions safely across Android & iOS
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    const { status: currentStatus } = await Calendar.getCalendarPermissionsAsync();
    if (currentStatus === "granted") return true;

    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === "granted") return true;

    return false;
  } catch (error) {
    console.error("Error requesting calendar permissions:", error);
    return false;
  }
}

/**
 * Gets a writable calendar ID or creates a dedicated local calendar if none exists.
 */
async function getOrCreateCalendarId(): Promise<string> {
  try {
    if (Platform.OS === "ios") {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      if (defaultCalendar && defaultCalendar.id) {
        return defaultCalendar.id;
      }
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    if (calendars && calendars.length > 0) {
      const writableCalendar =
        calendars.find(
          (c) =>
            c.allowsModifications &&
            (c.isPrimary ||
              c.accessLevel === Calendar.CalendarAccessLevel.OWNER ||
              c.accessLevel === Calendar.CalendarAccessLevel.ROOT ||
              c.accessLevel === Calendar.CalendarAccessLevel.EDITOR)
        ) ||
        calendars.find((c) => c.allowsModifications) ||
        calendars[0];

      if (writableCalendar && writableCalendar.id) {
        return writableCalendar.id;
      }
    }

    // Fallback: Create app-dedicated local calendar
    const newCalendarId = await Calendar.createCalendarAsync({
      title: "DRT Master Listing",
      color: "#7A1128",
      entityType: Calendar.EntityTypes.EVENT,
      name: "drt_master_listing_calendar",
      ownerAccount: "personal",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
      source:
        Platform.OS === "android"
          ? { isLocalAccount: true, name: "DRT Master Listing", type: Calendar.SourceType.LOCAL }
          : undefined,
    });

    return newCalendarId;
  } catch (error) {
    console.error("Error obtaining calendar ID:", error);
    return await Calendar.createCalendarAsync({
      title: "DRT Master Listing",
      color: "#7A1128",
      entityType: Calendar.EntityTypes.EVENT,
      name: "drt_master_listing_calendar",
      ownerAccount: "personal",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
      source:
        Platform.OS === "android"
          ? { isLocalAccount: true, name: "DRT Master Listing", type: Calendar.SourceType.LOCAL }
          : undefined,
    });
  }
}

/**
 * Inserts event directly into device native calendar (Samsung / Google / Apple Calendar)
 * 100% native execution — ZERO web browser redirects, ZERO Chrome URLs.
 */
export async function addEventToNativeCalendar(params: NativeCalendarEventParams): Promise<boolean> {
  const startTime = params.startDate || new Date(Date.now() + 3600 * 1000);
  const endTime = params.endDate || new Date(startTime.getTime() + 3600 * 1000);

  // 1. Android Native System Intent via IntentLauncher (Opens Samsung/Google/Xiaomi Calendar app pre-filled)
  // Bypasses permission loops entirely because system intent does not require app-level calendar permission.
  if (Platform.OS === "android") {
    try {
      const IntentLauncher = require("expo-intent-launcher");
      await IntentLauncher.startActivityAsync("android.intent.action.INSERT", {
        data: "content://com.android.calendar/events",
        extra: {
          title: params.title || "Property Case Appointment",
          beginTime: startTime.getTime(),
          endTime: endTime.getTime(),
          eventLocation: params.location || "",
          description: params.notes || "DRT Master Listing CRM Appointment",
        },
      });
      return true;
    } catch (intentErr) {
      console.warn("Android native calendar intent failed, falling back to expo-calendar API:", intentErr);
    }
  }

  // 2. iOS / Fallback via expo-calendar native API
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      Alert.alert(
        "Calendar Permission Required",
        "Please grant Calendar permissions in app settings to save events."
      );
      return false;
    }

    const calendarId = await getOrCreateCalendarId();

    await Calendar.createEventAsync(calendarId, {
      title: params.title,
      startDate: startTime,
      endDate: endTime,
      location: params.location || "",
      notes: params.notes || "DRT Master Listing CRM Appointment",
      timeZone: "Asia/Kuala_Lumpur",
    });

    Alert.alert(
      "✅ Saved to Calendar",
      `Event "${params.title}" has been saved to your phone calendar.`
    );
    return true;
  } catch (error: any) {
    console.error("Error creating calendar event:", error);
    Alert.alert(
      "Calendar Event",
      `Event "${params.title}" is ready for calendar insertion.`
    );
    return false;
  }
}
