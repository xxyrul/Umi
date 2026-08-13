import Constants from "expo-constants";
import { Alert, Linking, Platform } from "react-native";

const UPDATE_MANIFEST_URL = "https://umiren-d6a66.web.app/releases/latest.json";
const RELEASE_HOSTNAME = "umiren-d6a66.web.app";
const PACKAGE_NAME = "com.umi.caseflow";

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
  if (Platform.OS !== "android" || __DEV__) {
    return null;
  }

  const response = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Update manifest request failed with ${response.status}`);
  }

  const release = (await response.json()) as Partial<NativeAppRelease>;
  if (
    typeof release.versionName !== "string" ||
    typeof release.versionCode !== "number" ||
    !Number.isInteger(release.versionCode) ||
    typeof release.downloadUrl !== "string" ||
    !isSafeDownloadUrl(release.downloadUrl)
  ) {
    throw new Error("Update manifest has an invalid format");
  }

  if (release.packageName && release.packageName !== PACKAGE_NAME) {
    throw new Error("Update manifest is for a different Android package");
  }

  if (release.versionCode <= getCurrentVersionCode()) {
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

    if (!options.manual && !options.forcePrompt && promptedVersionCode === release.versionCode) {
      return release;
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
          : [{ text: isMalay ? "Kemudian" : "Later", style: "cancel" as const }]),
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