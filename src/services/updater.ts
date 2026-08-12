import * as Updates from "expo-updates";
import * as Application from "expo-application";
import firestore from "@react-native-firebase/firestore";
import { Alert, Linking, Platform } from "react-native";

export type UpdateCheckOptions = {
  silent?: boolean;
  autoApply?: boolean;
};

function parseVersion(value: string | undefined): number {
  if (!value) return 0;
  const digits = value.match(/\d+/g)?.map((n) => Number(n)) ?? [];
  if (!digits.length) return 0;
  return digits.reduce((total, n) => total * 1000 + n, 0);
}

export async function checkForManualAppUpdate(silent: boolean = false): Promise<boolean> {
  if (__DEV__) {
    return false;
  }

  try {
    const appDoc = await firestore().collection("appUpdates").doc(Platform.OS === "android" ? "android" : "ios").get();
    if (!appDoc.exists) {
      return false;
    }

    const data = appDoc.data() ?? {};
    const apkUrl = data.apkUrl || data.downloadUrl;
    if (!apkUrl) {
      return false;
    }

    const currentVersionCode = Number(Application.nativeBuildVersion || "0");
    const latestVersionCode = Number(data.versionCode ?? 0);
    const currentVersionName = String(Application.nativeApplicationVersion || "0.0.0");
    const latestVersionName = String(data.versionName || "0.0.0");

    const isNewerVersion =
      latestVersionCode > currentVersionCode ||
      (latestVersionCode === 0 && parseVersion(latestVersionName) > parseVersion(currentVersionName));

    if (!isNewerVersion) {
      return false;
    }

    if (!silent) {
      Alert.alert(
        "Update available",
        `Version ${latestVersionName} is ready. Download the latest APK and install it manually.`,
        [
          { text: "Later", style: "cancel" },
          {
            text: "Download",
            onPress: () => Linking.openURL(apkUrl),
          },
        ]
      );
      return true;
    }

    await Linking.openURL(apkUrl);
    return true;
  } catch (error) {
    console.warn("Manual APK update check failed:", error);
    return false;
  }
}

/**
 * Checks for Expo OTA updates and applies them when allowed.
 * In production builds, this is the correct in-app update flow.
 */
export async function checkForAppUpdates({
  silent = false,
  autoApply = false,
}: UpdateCheckOptions = {}): Promise<boolean> {
  if (__DEV__) {
    if (!silent) {
      Alert.alert("Development Mode", "Update checks are disabled during local development.");
    }
    return false;
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    if (!update.isAvailable) {
      if (!silent) {
        Alert.alert("Up to Date", "You are already using the latest version of Umi.");
      }
      return false;
    }

    if (!silent && !autoApply) {
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
    }

    await Updates.fetchUpdateAsync();
    if (autoApply) {
      await Updates.reloadAsync();
    }
    return true;
  } catch (error: any) {
    console.warn("Failed to check for updates:", error);
    if (!silent) {
      Alert.alert("Update Check Failed", "Could not verify the latest app update right now.");
    }
    return false;
  }
}
