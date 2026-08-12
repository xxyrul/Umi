import { Alert } from "react-native";
import { addEventToNativeCalendar } from "@/services/calendar";

/**
 * Adds an appointment or case directly into the device's native Calendar app 
 * (Samsung Calendar, Google Calendar App, Apple Calendar) without opening Chrome browser.
 */
export async function addToPhoneCalendar(
  title: string,
  details: string,
  startDate: Date = new Date()
): Promise<void> {
  try {
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    await addEventToNativeCalendar({
      title: title || "Property Appointment",
      startDate: startDate,
      endDate: endDate,
      notes: details || "Janji temu dari DRT Master Listing CRM",
    });
  } catch (error: any) {
    console.error("Native Calendar Insertion Error:", error);
    Alert.alert("Calendar Error", "Could not add event to phone calendar.");
  }
}
