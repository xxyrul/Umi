import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppSettings } from "@/context/AppSettingsContext";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import {
  getUpdateCacheSize,
  fetchReleaseHistory,
  fetchReleaseManifest,
  downloadAndInstallUpdate,
  cancelActiveDownload,
  NativeAppRelease,
  getCurrentVersionCode,
  UPDATE_CACHE_DIR,
} from "@/services/apkUpdater";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";

export default function UpdatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeColors, t, language } = useAppSettings();
  const isMalay = language === "BM";

  const currentVersion = Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "1.0.0";
  const currentVersionCode = getCurrentVersionCode();

  const [cacheSizeMb, setCacheSizeMb] = useState<string>("0.00");
  const [history, setHistory] = useState<NativeAppRelease[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Update check and download state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [availableRelease, setAvailableRelease] = useState<NativeAppRelease | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedMb, setDownloadedMb] = useState("0");
  const [totalMb, setTotalMb] = useState("0");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const progressWidth = useSharedValue(0);
  useEffect(() => {
    progressWidth.value = withTiming(downloadProgress, { duration: 300 });
  }, [downloadProgress]);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const checkForUpdates = async (showFeedback = false) => {
    try {
      setIsCheckingUpdate(true);
      setErrorMessage(null);
      const manifest = await fetchReleaseManifest();
      setAvailableRelease(manifest);
      setHasChecked(true);

      if (showFeedback && !manifest) {
        Alert.alert(
          isMalay ? "Tiada Kemas Kini" : "No Updates Available",
          isMalay
            ? "Aplikasi anda sudah berada pada versi terkini."
            : "You are already using the latest version of Artha."
        );
      }
    } catch (err) {
      console.warn("[UpdatesScreen] Check update error:", err);
      if (showFeedback) {
        Alert.alert(
          isMalay ? "Ralat" : "Error",
          isMalay
            ? "Gagal menyemak kemas kini. Sila periksa sambungan internet anda."
            : "Failed to check for updates. Please check your internet connection."
        );
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const loadData = async () => {
    try {
      setIsLoadingHistory(true);
      const sizeBytes = await getUpdateCacheSize();
      setCacheSizeMb((sizeBytes / (1024 * 1024)).toFixed(2));

      const relHistory = await fetchReleaseHistory();
      setHistory(relHistory);
    } catch (e) {
      console.warn("Failed to load updates screen data", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
    checkForUpdates(false);
  }, []);

  const clearCache = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(UPDATE_CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(UPDATE_CACHE_DIR, { idempotent: true });
        setCacheSizeMb("0.00");
        Alert.alert(
          isMalay ? "Berjaya" : "Success",
          isMalay ? "Cache storan telah dikosongkan." : "Storage cache cleared."
        );
      }
    } catch (error) {
      console.warn("Failed to clear cache", error);
    }
  };

  const handleStartUpdate = async () => {
    if (!availableRelease) return;

    try {
      setIsDownloading(true);
      setErrorMessage(null);
      setDownloadProgress(0);

      await downloadAndInstallUpdate(availableRelease, (progress) => {
        setDownloadProgress(progress.percent);
        setDownloadedMb((progress.totalBytesWritten / (1024 * 1024)).toFixed(1));
        setTotalMb((progress.totalBytesExpectedToWrite / (1024 * 1024)).toFixed(1));
      });

      setIsDownloading(false);
    } catch (err: any) {
      console.error("[UpdatesScreen] Update failed:", err);
      setIsDownloading(false);
      const isPermissionErr =
        err?.message?.includes("permission") || err?.message?.includes("REQUEST_INSTALL_PACKAGES");

      if (isPermissionErr) {
        setErrorMessage(
          isMalay
            ? "Sila benarkan 'Pasang apl tidak diketahui' dalam tetapan peranti."
            : "Please enable 'Install unknown apps' in your device settings."
        );
      } else {
        setErrorMessage(
          isMalay
            ? "Muat turun gagal. Sila cuba lagi atau muat turun melalui pelayar."
            : "Download failed. Please try again or download via web browser."
        );
      }
    }
  };

  const handleCancelDownload = () => {
    cancelActiveDownload();
    setIsDownloading(false);
    setDownloadProgress(0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      {/* Header with Back button */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: themeColors.borderColor,
            backgroundColor: themeColors.cardBackground,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>
          {isMalay ? "Kemas Kini Aplikasi" : "App Updates"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Top Action Card: Update Available OR Up to Date */}
        {availableRelease ? (
          <Animated.View
            entering={FadeInDown.delay(50)}
            style={[
              styles.actionCard,
              {
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.maroonPrimary,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: themeColors.maroonLight }]}>
                <MaterialCommunityIcons name="rocket-launch" size={24} color={themeColors.maroonPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
                  {isMalay ? "Kemas Kini Baru Tersedia!" : "New Update Available!"}
                </Text>
                <Text style={[styles.newVersionBadge, { color: themeColors.maroonPrimary }]}>
                  v{availableRelease.versionName} (Build {availableRelease.versionCode})
                </Text>
              </View>
            </View>

            {/* Release notes summary */}
            {availableRelease.releaseNotes && availableRelease.releaseNotes.length > 0 && (
              <View style={[styles.notesContainer, { backgroundColor: themeColors.surfaceContainer }]}>
                {availableRelease.releaseNotes.map((note, idx) => (
                  <View key={idx} style={styles.noteRow}>
                    <MaterialCommunityIcons
                      name="check-circle-outline"
                      size={16}
                      color={themeColors.maroonPrimary}
                      style={{ marginTop: 2 }}
                    />
                    <Text style={[styles.noteText, { color: themeColors.textPrimary }]}>{note}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Download Progress Bar */}
            {isDownloading && (
              <View style={styles.downloadContainer}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressTitle, { color: themeColors.textPrimary }]}>
                    {isMalay ? "Memuat turun fail APK..." : "Downloading APK update..."}
                  </Text>
                  <Text style={[styles.progressPercent, { color: themeColors.maroonPrimary }]}>
                    {downloadProgress}%
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: themeColors.surfaceContainer }]}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      animatedProgressStyle,
                      { backgroundColor: themeColors.maroonPrimary },
                    ]}
                  />
                </View>
                {totalMb !== "0" && (
                  <Text style={[styles.mbCounter, { color: themeColors.textMuted }]}>
                    {downloadedMb} MB / {totalMb} MB
                  </Text>
                )}
              </View>
            )}

            {/* Error Message */}
            {errorMessage && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#EA4335" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              {!isDownloading ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleStartUpdate}
                  style={[styles.primaryBtn, { backgroundColor: themeColors.maroonPrimary }]}
                >
                  <MaterialCommunityIcons name="download" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    {isMalay ? "Muat Turun & Pasang" : "Download & Install Update"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleCancelDownload}
                  style={[
                    styles.secondaryBtn,
                    {
                      borderColor: themeColors.borderColor,
                      backgroundColor: themeColors.surfaceContainer,
                    },
                  ]}
                >
                  <Text style={[styles.secondaryBtnText, { color: themeColors.textSecondary }]}>
                    {isMalay ? "Batal" : "Cancel"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {errorMessage && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Linking.openURL(availableRelease.downloadUrl).catch(() => {})}
                style={{ marginTop: 12, alignItems: "center" }}
              >
                <Text style={{ fontSize: 13, color: themeColors.maroonPrimary, textDecorationLine: "underline" }}>
                  {isMalay ? "Muat turun melalui pelayar web" : "Download via web browser"}
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeInDown.delay(50)}
            style={[
              styles.card,
              { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: "#34A85322" }]}>
                <MaterialCommunityIcons name="check-decagram" size={24} color="#34A853" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
                  {isMalay ? "Versi Terkini" : "Up to Date"}
                </Text>
                <Text style={[styles.versionSub, { color: themeColors.textMuted }]}>
                  Artha v{currentVersion}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => checkForUpdates(true)}
              disabled={isCheckingUpdate}
              style={[
                styles.checkUpdateBtn,
                {
                  backgroundColor: themeColors.surfaceContainer,
                  borderColor: themeColors.borderColor,
                },
              ]}
            >
              {isCheckingUpdate ? (
                <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="refresh" size={18} color={themeColors.textPrimary} />
                  <Text style={[styles.checkUpdateBtnText, { color: themeColors.textPrimary }]}>
                    {isMalay ? "Semak Kemas Kini" : "Check for Updates"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Current Version Card */}
        <Animated.View
          entering={FadeInDown.delay(100)}
          style={[
            styles.card,
            { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
          ]}
        >
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="cellphone-arrow-down" size={24} color={themeColors.maroonPrimary} />
            <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
              {isMalay ? "Versi Semasa" : "Current Version"}
            </Text>
          </View>
          <Text style={[styles.versionText, { color: themeColors.textPrimary }]}>
            v{currentVersion}
          </Text>
        </Animated.View>

        {/* Storage Cache Card */}
        <Animated.View
          entering={FadeInDown.delay(200)}
          style={[
            styles.card,
            { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
          ]}
        >
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="database-outline" size={24} color={themeColors.maroonPrimary} />
            <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
              {isMalay ? "Cache Storan APK" : "Storage Cache"}
            </Text>
          </View>
          <View style={styles.cacheRow}>
            <Text style={[styles.cacheSize, { color: themeColors.textSecondary }]}>{cacheSizeMb} MB</Text>
            <TouchableOpacity
              onPress={clearCache}
              style={[
                styles.clearBtn,
                { backgroundColor: themeColors.maroonLight, borderColor: themeColors.maroonBorder },
              ]}
            >
              <Text style={{ color: themeColors.maroonPrimary, fontWeight: "600" }}>
                {isMalay ? "Kosongkan Cache" : "Clear Cache"}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Release History */}
        <Animated.Text
          entering={FadeInDown.delay(300)}
          style={[styles.sectionTitle, { color: themeColors.textPrimary }]}
        >
          {isMalay ? "Sejarah Versi" : "Release History"}
        </Animated.Text>

        {isLoadingHistory ? (
          <ActivityIndicator color={themeColors.maroonPrimary} style={{ marginTop: 20 }} />
        ) : (
          history.map((rel, idx) => (
            <Animated.View
              key={idx}
              entering={FadeInDown.delay(400 + idx * 100)}
              style={[
                styles.card,
                { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
              ]}
            >
              <View style={styles.historyHeader}>
                <Text style={[styles.historyVersion, { color: themeColors.maroonPrimary }]}>
                  v{rel.versionName}
                </Text>
                <Text style={[styles.historyDate, { color: themeColors.textMuted }]}>{rel.releaseDate || (rel as any).date}</Text>
              </View>
              {rel.releaseNotes?.map((note, nIdx) => (
                <View key={nIdx} style={styles.noteRow}>
                  <Text style={[styles.bullet, { color: themeColors.textMuted }]}>•</Text>
                  <Text style={[styles.noteText, { color: themeColors.textSecondary }]}>{note}</Text>
                </View>
              ))}
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backBtn: {
    padding: 4,
  },
  title: { fontSize: 22, fontWeight: "700" },
  content: { padding: 20, gap: 16, paddingBottom: 100 },
  card: { padding: 18, borderRadius: 16, borderWidth: 1 },
  actionCard: { padding: 18, borderRadius: 16, borderWidth: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  newVersionBadge: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  versionSub: { fontSize: 13, marginTop: 2 },
  versionText: { fontSize: 22, fontWeight: "700", marginLeft: 36 },
  cacheRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginLeft: 36 },
  cacheSize: { fontSize: 17, fontWeight: "600" },
  clearBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  sectionTitle: { fontSize: 19, fontWeight: "700", marginTop: 8 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  historyVersion: { fontSize: 17, fontWeight: "700" },
  historyDate: { fontSize: 13, fontWeight: "600" },
  notesContainer: {
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 12,
  },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4 },
  bullet: { fontSize: 18, lineHeight: 20, fontWeight: "700" },
  noteText: { fontSize: 14, flex: 1, lineHeight: 20 },
  checkUpdateBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
  },
  checkUpdateBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  downloadContainer: {
    marginBottom: 12,
    marginTop: 6,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  mbCounter: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EA433515",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: {
    color: "#EA4335",
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
});
