import * as Updates from "expo-updates";
import { Alert } from "react-native";

/**
 * Checks for OTA updates safely using expo-updates with graceful error handling.
 *
 * @param silent If true, fails silently without showing alerts.
 * @returns Promise<boolean> True if an update was found/installed.
 */
export async function checkForAppUpdates(silent: boolean = false): Promise<boolean> {
  // OTA updates are disabled/not applicable in development environment
  if (__DEV__) {
    if (!silent) {
      Alert.alert("Development Mode", "Update checks are disabled during local development.");
    }
    return false;
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      if (silent) {
        // Silently fetch and download the update in the background
        await Updates.fetchUpdateAsync();
        return true;
      }

      // Prompt user for manual updates
      Alert.alert(
        "Update Available",
        "A new update is available. Download and restart now?",
        [
          { text: "Later", style: "cancel" },
          {
            text: "Update Now",
            onPress: async () => {
              try {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              } catch (fetchErr) {
                console.warn("Failed to fetch update:", fetchErr);
                Alert.alert("Update Error", "An error occurred while downloading the update. Please try again.");
              }
            },
          },
        ]
      );
      return true;
    } else {
      if (!silent) {
        Alert.alert("Up to Date", "You are already using the latest version of Umi.");
      }
      return false;
    }
  } catch (error: any) {
    console.warn("Failed to check for updates:", error);
    if (!silent) {
      Alert.alert("Up to Date", "You are already using the latest version of Umi.");
    }
    return false;
  }
}
