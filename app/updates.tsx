import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
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

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/profile");
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleGoBack();
        return true;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [handleGoBack])
  );

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
      }
      setCacheSizeMb("0.00");
      Alert.alert(
        isMalay ? "Berjaya" : "Success",
        isMalay ? "Cache storan telah dikosongkan (0.00 MB)." : "Storage cache cleared (0.00 MB)."
      );
    } catch (error) {
      console.warn("Failed to clear cache", error);
      Alert.alert(
        isMalay ? "Ralat" : "Error",
        isMalay ? "Gagal mengosongkan cache storan." : "Failed to clear storage cache."
      );
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

  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});

  const toggleVersionExpand = (versionName: string) => {
    setExpandedVersions((prev) => ({
      ...prev,
      [versionName]: !prev[versionName],
    }));
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
          onPress={handleGoBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>
          {t("appVersion")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 60 }]}>
        {/* 1. Unified Hero Status Card */}
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
                  {t("updateAvailableStatus")}
                </Text>
                <Text style={[styles.newVersionBadge, { color: themeColors.maroonPrimary }]}>
                  v{availableRelease.versionName} ({t("buildLabel")} {availableRelease.versionCode})
                </Text>
              </View>
            </View>

            {/* Release notes summary */}
            {availableRelease.releaseNotes && (
              <View style={[styles.notesContainer, { backgroundColor: themeColors.surfaceContainer }]}>
                {(Array.isArray(availableRelease.releaseNotes) ? availableRelease.releaseNotes : [availableRelease.releaseNotes]).map((note, idx) => (
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
                <Text style={[styles.mbCounter, { color: themeColors.textMuted }]}>
                  {parseFloat(totalMb) > 0
                    ? `${downloadedMb} MB / ${totalMb} MB`
                    : `${downloadedMb} MB`}
                </Text>
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
              <View style={[styles.iconCircle, { backgroundColor: "#10B98122" }]}>
                <MaterialCommunityIcons name="check-decagram" size={26} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
                  {t("upToDateStatus")}
                </Text>
                <Text style={[styles.versionSub, { color: themeColors.textMuted }]}>
                  Artha v{currentVersion} ({t("buildLabel")} {currentVersionCode}) · {t("productionChannel")}
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
                    {t("checkForUpdates")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* 2. Android Installation Permission Tip Banner */}
        <Animated.View
          entering={FadeInDown.delay(100)}
          style={[
            styles.tipCard,
            {
              backgroundColor: themeColors.surfaceContainer,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={[styles.tipIconWrap, { backgroundColor: "rgba(225, 29, 72, 0.12)" }]}>
              <MaterialCommunityIcons name="lightbulb-outline" size={20} color={themeColors.maroonPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tipTitle, { color: themeColors.textPrimary }]}>
                {t("androidInstallTipTitle")}
              </Text>
              <Text style={[styles.tipDesc, { color: themeColors.textMuted }]}>
                {t("androidInstallTipDesc")}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* 3. Collapsible Release History */}
        {(() => {
          // Deduplicate history entries and exclude the available release if it's already shown in hero
          const displayedHistory = history
            .filter((rel, idx, arr) => arr.findIndex((r) => r.versionName === rel.versionName) === idx)
            .filter((rel) => !availableRelease || rel.versionCode < (availableRelease.versionCode || 0));

          if (isLoadingHistory) {
            return <ActivityIndicator color={themeColors.maroonPrimary} style={{ marginTop: 20 }} />;
          }

          if (displayedHistory.length === 0) return null;

          return (
            <>
              <Animated.Text
                entering={FadeInDown.delay(150)}
                style={[styles.sectionTitle, { color: themeColors.textPrimary }]}
              >
                {availableRelease
                  ? (isMalay ? "Versi Terdahulu" : "Previous Versions")
                  : (isMalay ? "Sejarah Versi & Log Perubahan" : "Release History & Changelogs")}
              </Animated.Text>

              {displayedHistory.map((rel, idx) => {
                const isLatest = !availableRelease && idx === 0;
                const isExpanded = expandedVersions[rel.versionName] ?? isLatest;
                const notes = Array.isArray(rel.releaseNotes) ? rel.releaseNotes : [rel.releaseNotes].filter(Boolean);

                return (
                  <Animated.View
                    key={rel.versionName + "_" + idx}
                    entering={FadeInDown.delay(200 + idx * 60)}
                    style={[
                      styles.card,
                      {
                        backgroundColor: themeColors.cardBackground,
                        borderColor: isLatest ? themeColors.maroonPrimary : themeColors.borderColor,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => toggleVersionExpand(rel.versionName)}
                      style={styles.historyHeader}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Text style={[styles.historyVersion, { color: isLatest ? themeColors.maroonPrimary : themeColors.textPrimary }]}>
                          v{rel.versionName}
                        </Text>
                        {rel.versionCode && (
                          <View style={[styles.buildBadge, { backgroundColor: themeColors.surfaceContainer }]}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: themeColors.textMuted }}>
                              {t("buildLabel")} {rel.versionCode}
                            </Text>
                          </View>
                        )}
                        {isLatest && (
                          <View style={[styles.latestBadge, { backgroundColor: themeColors.maroonLight }]}>
                            <Text style={{ fontSize: 10, fontWeight: "800", color: themeColors.maroonPrimary }}>
                              CURRENT
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={[styles.historyDate, { color: themeColors.textMuted }]}>
                          {rel.releaseDate || (rel as any).date || ""}
                        </Text>
                        <MaterialCommunityIcons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={20}
                          color={themeColors.textMuted}
                        />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: themeColors.borderColor }}>
                        {notes.map((note, nIdx) => (
                          <View key={nIdx} style={styles.noteRow}>
                            <Text style={[styles.bullet, { color: themeColors.maroonPrimary }]}>•</Text>
                            <Text style={[styles.noteText, { color: themeColors.textSecondary }]}>{note}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </>
          );
        })()}
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
  title: { fontSize: 20, fontWeight: "700" },
  content: { padding: 18, gap: 14, paddingBottom: 100 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1 },
  actionCard: { padding: 16, borderRadius: 16, borderWidth: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  newVersionBadge: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  versionSub: { fontSize: 13, marginTop: 3 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginTop: 10, marginBottom: 2 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyVersion: { fontSize: 16, fontWeight: "800" },
  historyDate: { fontSize: 12, fontWeight: "600" },
  buildBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  latestBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tipCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  tipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },
  tipDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  notesContainer: {
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 12,
  },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4 },
  bullet: { fontSize: 18, lineHeight: 20, fontWeight: "700" },
  noteText: { fontSize: 13, flex: 1, lineHeight: 19 },
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
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  downloadContainer: {
    marginBottom: 12,
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
    fontSize: 13,
    fontWeight: "700",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  mbCounter: {
    fontSize: 11,
    textAlign: "right",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  errorText: {
    color: "#EA4335",
    fontSize: 12,
    flex: 1,
  },
});
