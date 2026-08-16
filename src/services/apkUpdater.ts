import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Alert, Linking, Platform } from "react-native";

const UPDATE_MANIFEST_URL = "https://umiren-d6a66.web.app/releases/latest.json";
const RELEASE_HOSTNAME = "umiren-d6a66.web.app";
const PACKAGE_NAME = "com.umi.caseflow";
const LAST_DISMISSED_UPDATE_KEY = "artha_last_dismissed_update_timestamp";
const NUDGE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 Days
const UPDATE_CACHE_DIR = `${FileSystem.cacheDirectory}updates/`;

export type NativeAppRelease = {
  versionName: string;
  versionCode: number;
  downloadUrl: string;
  packageName?: string;
  mandatory?: boolean;
  releaseNotes?: string[];
};

export type DownloadProgressCallback = (progress: {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  percent: number;
}) => void;

let promptedVersionCode: number | null = null;
let activeDownloadResumable: FileSystem.DownloadResumable | null = null;

export function getCurrentVersionCode() {
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

/**
 * Automatically purges all previously downloaded APK files from cache.
 * Keeps user device storage at 0MB occupied.
 */
export async function cleanupUpdateCache(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(UPDATE_CACHE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(UPDATE_CACHE_DIR, { idempotent: true });
    }
  } catch (err) {
    console.warn("[apkUpdater] Cleanup update cache error:", err);
  }
}

export async function fetchReleaseManifest(): Promise<NativeAppRelease | null> {
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

/**
 * Downloads the APK directly inside the app with live progress reporting,
 * then triggers Android native package installer intent.
 */
export async function downloadAndInstallUpdate(
  release: NativeAppRelease,
  onProgress?: DownloadProgressCallback
): Promise<void> {
  if (Platform.OS !== "android") {
    throw new Error("In-app APK installation is only supported on Android.");
  }

  try {
    // 1. Ensure updates cache directory exists and is clean
    await cleanupUpdateCache();
    await FileSystem.makeDirectoryAsync(UPDATE_CACHE_DIR, { intermediates: true });

    const localFileUri = `${UPDATE_CACHE_DIR}artha_v${release.versionName}_${release.versionCode}.apk`;

    // 2. Stream download with progress tracking
    activeDownloadResumable = FileSystem.createDownloadResumable(
      release.downloadUrl,
      localFileUri,
      {},
      (downloadProgress) => {
        const totalBytesWritten = downloadProgress.totalBytesWritten;
        const totalBytesExpectedToWrite = Math.max(1, downloadProgress.totalBytesExpectedToWrite);
        const percent = Math.min(100, Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100));

        if (onProgress) {
          onProgress({
            totalBytesWritten,
            totalBytesExpectedToWrite,
            percent,
          });
        }
      }
    );

    const downloadResult = await activeDownloadResumable.downloadAsync();
    activeDownloadResumable = null;

    if (!downloadResult || !downloadResult.uri) {
      throw new Error("Download completed without valid file URI.");
    }

    // 3. Obtain secure content URI from FileProvider
    const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);

    // 4. Launch Android Native Package Installer
    await IntentLauncher.startActivityAsync("android.intent.action.INSTALL_PACKAGE", {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
  } catch (error: any) {
    activeDownloadResumable = null;
    console.error("[apkUpdater] downloadAndInstallUpdate error:", error);
    throw error;
  }
}

export function cancelActiveDownload(): void {
  if (activeDownloadResumable) {
    try {
      activeDownloadResumable.cancelAsync().catch(() => {});
    } catch {}
    activeDownloadResumable = null;
  }
}

export async function dismissUpdatePrompt(versionCode: number): Promise<void> {
  try {
    await AsyncStorage.setItem(
      LAST_DISMISSED_UPDATE_KEY,
      JSON.stringify({ versionCode, timestamp: Date.now() })
    );
  } catch {}
}

export async function shouldShowUpdatePrompt(release: NativeAppRelease, manual: boolean = false): Promise<boolean> {
  if (manual || release.mandatory) {
    return true;
  }

  if (promptedVersionCode === release.versionCode) {
    return false;
  }

  try {
    const lastDismissedRaw = await AsyncStorage.getItem(LAST_DISMISSED_UPDATE_KEY);
    if (lastDismissedRaw) {
      const lastDismissed = JSON.parse(lastDismissedRaw);
      if (
        lastDismissed?.versionCode === release.versionCode &&
        Date.now() - (lastDismissed?.timestamp || 0) < NUDGE_INTERVAL_MS
      ) {
        return false;
      }
    }
  } catch {}

  promptedVersionCode = release.versionCode;
  return true;
}