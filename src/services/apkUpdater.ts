import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Alert, Linking, Platform } from "react-native";

const UPDATE_MANIFEST_URL = "https://umiren-d6a66.web.app/releases/latest.json";
const RELEASE_HOSTNAME = "umiren-d6a66.web.app";
const PACKAGE_NAME = "com.umi.caseflow";
const LAST_DISMISSED_UPDATE_KEY = "umi_last_dismissed_update_timestamp";
const NUDGE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 Days

export type NativeAppRelease = {
  versionName: string;
  versionCode: number;
  downloadUrl: string;
  packageName?: string;
  mandatory?: boolean;
  releaseNotes?: string[];
};

type CheckOptions = {
  language?: "BM" | "EN";
  manual?: boolean;
  forcePrompt?: boolean;
  suppressManualStatusAlert?: boolean;
};

let promptedVersionCode: number | null = null;

function getCurrentVersionCode() {
  const nativeBuildVersion = Number(Constants.nativeBuildVersion);
  const configuredBuildVersion = Number(Constants.expoConfig?.android?.versionCode);
  const validVersions = [nativeBuildVersion, configuredBuildVersion].filter(
    (version) => Number.isInteger(version) && version > 0
  );

  return validVersions.length > 0 ? Math.max(...validVersions) : 0;
}

function isSafeDownloadUrl(downloadUrl: string) {
  try {
    const url = new URL(downloadUrl);
    return url.protocol === "https:" && url.hostname === RELEASE_HOSTNAME;
  } catch {
    return false;
  }
}

async function fetchReleaseManifest(): Promise<NativeAppRelease | null> {
  if (Platform.OS !== "android") {
    return null;
  }

  const response = await fetch(UPDATE_MANIFEST_URL, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load release manifest: ${response.status}`);
  }

  const release = (await response.json()) as Partial<NativeAppRelease>;
  const currentVersionCode = getCurrentVersionCode();

  if (
    !release ||
    typeof release.versionName !== "string" ||
    typeof release.versionCode !== "number" ||
    typeof release.downloadUrl !== "string" ||
    release.versionCode <= currentVersionCode ||
    (release.packageName && release.packageName !== PACKAGE_NAME) ||
    !isSafeDownloadUrl(release.downloadUrl)
  ) {
    return null;
  }

  return {
    versionName: release.versionName,
    versionCode: release.versionCode,
    downloadUrl: release.downloadUrl,
    packageName: release.packageName,
    mandatory: release.mandatory ?? false,
    releaseNotes: Array.isArray(release.releaseNotes)
      ? release.releaseNotes.filter((note): note is string => typeof note === "string").slice(0, 5)
      : [],
  };
}

export async function checkForNativeAppUpdate(options: CheckOptions = {}) {
  try {
    const release = await fetchReleaseManifest();

    if (!release) {
      if (options.manual && !options.suppressManualStatusAlert) {
        Alert.alert(
          options.language === "BM" ? "Aplikasi Terkini" : "App Up to Date",
          options.language === "BM"
            ? "Anda sedang menggunakan versi terkini Umi."
            : "You are using the latest version of Umi."
        );
      }
      return null;
    }

    // Check 3-day recurring cooldown for automatic checks
    if (!options.manual && !options.forcePrompt && !release.mandatory) {
      if (promptedVersionCode === release.versionCode) {
        return release;
      }

      try {
        const lastDismissedRaw = await AsyncStorage.getItem(LAST_DISMISSED_UPDATE_KEY);
        if (lastDismissedRaw) {
          const lastDismissed = JSON.parse(lastDismissedRaw);
          if (
            lastDismissed?.versionCode === release.versionCode &&
            Date.now() - (lastDismissed?.timestamp || 0) < NUDGE_INTERVAL_MS
          ) {
            // Still within 3-day cooldown
            return release;
          }
        }
      } catch (storageErr) {
        console.warn("[apkUpdater] Failed reading dismiss cooldown:", storageErr);
      }
    }

    promptedVersionCode = release.versionCode;
    const isMalay = options.language === "BM";
    const notes = release.releaseNotes?.length
      ? `\n\n${release.releaseNotes.map((note) => `• ${note}`).join("\n")}`
      : "";

    Alert.alert(
      isMalay ? `Versi Umi ${release.versionName} Tersedia` : `Umi ${release.versionName} Is Available`,
      `${isMalay ? "Kemas kini aplikasi untuk mendapatkan ciri dan pembaikan terbaru." : "Update the app to get the latest features and fixes."}${notes}`,
      [
        ...(release.mandatory
          ? []
          : [
              {
                text: isMalay ? "Kemudian" : "Later",
                style: "cancel" as const,
                onPress: async () => {
                  try {
                    await AsyncStorage.setItem(
                      LAST_DISMISSED_UPDATE_KEY,
                      JSON.stringify({ versionCode: release.versionCode, timestamp: Date.now() })
                    );
                  } catch {}
                },
              },
            ]),
        {
          text: isMalay ? "Muat Turun Kemas Kini" : "Download Update",
          onPress: async () => {
            try {
              await Linking.openURL(release.downloadUrl);
            } catch {
              Alert.alert(
                isMalay ? "Gagal Membuka Muat Turun" : "Unable to Open Download",
                isMalay
                  ? "Sila cuba lagi atau buka pautan kemas kini secara manual."
                  : "Please try again or open the update link manually."
              );
            }
          },
        },
      ]
    );

    return release;
  } catch (error) {
    console.warn("[apkUpdater] Native update check failed:", error);
    if (options.manual && !options.suppressManualStatusAlert) {
      Alert.alert(
        options.language === "BM" ? "Kemas Kini Tidak Tersedia" : "Update Check Unavailable",
        options.language === "BM"
          ? "Sila cuba semula kemudian."
          : "Please try again later."
      );
    }
    return null;
  }
}