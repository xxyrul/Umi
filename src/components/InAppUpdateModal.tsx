import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppSettings } from "@/context/AppSettingsContext";
import { SPACING } from "@/constants/theme";
import {
  NativeAppRelease,
  downloadAndInstallUpdate,
  cancelActiveDownload,
  dismissUpdatePrompt,
} from "@/services/apkUpdater";

interface InAppUpdateModalProps {
  visible: boolean;
  release: NativeAppRelease | null;
  onClose: () => void;
}

export function InAppUpdateModal({ visible, release, onClose }: InAppUpdateModalProps) {
  const { themeColors, language, isDark } = useAppSettings();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedMb, setDownloadedMb] = useState("0");
  const [totalMb, setTotalMb] = useState("0");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setIsDownloading(false);
      setDownloadProgress(0);
      setErrorMessage(null);
    }
  }, [visible]);

  if (!release) return null;

  const isMalay = language === "BM";

  const handleStartUpdate = async () => {
    try {
      setIsDownloading(true);
      setErrorMessage(null);
      setDownloadProgress(0);

      await downloadAndInstallUpdate(release, (progress) => {
        setDownloadProgress(progress.percent);
        setDownloadedMb((progress.totalBytesWritten / (1024 * 1024)).toFixed(1));
        setTotalMb((progress.totalBytesExpectedToWrite / (1024 * 1024)).toFixed(1));
      });

      // Once intent launcher is triggered, close modal
      setIsDownloading(false);
      onClose();
    } catch (err: any) {
      console.error("[InAppUpdateModal] Update failed:", err);
      setIsDownloading(false);
      const isPermissionErr =
        err?.message?.includes("permission") || err?.message?.includes("REQUEST_INSTALL_PACKAGES");

      if (isPermissionErr) {
        setErrorMessage(
          isMalay
            ? "Sila benarkan 'Pasang apl tidak diketahui' dalam tetapan peranti."
            : "Please enable 'Install unknown apps' permission in your device settings."
        );
      } else {
        setErrorMessage(
          isMalay
            ? "Muat turun gagal. Sila cuba lagi atau buka melalui pelayar web."
            : "Download failed. Please try again or open via browser."
        );
      }
    }
  };

  const handleDismiss = async () => {
    cancelActiveDownload();
    await dismissUpdatePrompt(release.versionCode);
    onClose();
  };

  const handleOpenBrowserFallback = () => {
    onClose();
    Linking.openURL(release.downloadUrl).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: themeColors.cardBackground,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          {/* Top Brand Tag & Version */}
          <View style={styles.headerRow}>
            <View style={[styles.iconCircle, { backgroundColor: themeColors.maroonLight }]}>
              <MaterialCommunityIcons name="rocket-launch" size={24} color={themeColors.maroonPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: themeColors.textPrimary }]}>
                {isMalay ? "Kemas Kini Tersedia" : "New Update Available"}
              </Text>
              <View style={styles.badgeRow}>
                <View style={[styles.versionBadge, { backgroundColor: themeColors.surfaceContainer }]}>
                  <Text style={[styles.versionText, { color: themeColors.maroonPrimary }]}>
                    v{release.versionName}
                  </Text>
                </View>
                {release.mandatory && (
                  <View style={[styles.versionBadge, { backgroundColor: "#EA433522" }]}>
                    <Text style={[styles.versionText, { color: "#EA4335" }]}>
                      {isMalay ? "Wajib" : "Mandatory"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Release Notes */}
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            {isMalay ? "Ciri-ciri & Pembaikan Terbaru:" : "What's New in this Version:"}
          </Text>

          <View
            style={[
              styles.notesBox,
              {
                backgroundColor: themeColors.surfaceContainer,
                borderColor: themeColors.borderColor,
              },
            ]}
          >
            {release.releaseNotes && release.releaseNotes.length > 0 ? (
              release.releaseNotes.map((note, idx) => (
                <View key={idx} style={styles.noteRow}>
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={16}
                    color={themeColors.maroonPrimary}
                    style={{ marginTop: 2 }}
                  />
                  <Text style={[styles.noteText, { color: themeColors.textPrimary }]}>{note}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.noteText, { color: themeColors.textMuted }]}>
                {isMalay ? "Penambahbaikan prestasi dan kestabilan sistem." : "Performance and stability improvements."}
              </Text>
            )}
          </View>

          {/* Download Progress Bar / State */}
          {isDownloading ? (
            <View style={styles.downloadContainer}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressTitle, { color: themeColors.textPrimary }]}>
                  {isMalay ? "Memuat Turun Kemas Kini..." : "Downloading Update..."}
                </Text>
                <Text style={[styles.progressPercent, { color: themeColors.maroonPrimary }]}>
                  {downloadProgress}%
                </Text>
              </View>

              {/* Progress Track */}
              <View style={[styles.progressTrack, { backgroundColor: themeColors.surfaceContainer }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${downloadProgress}%`,
                      backgroundColor: themeColors.maroonPrimary,
                    },
                  ]}
                />
              </View>

              {totalMb !== "0" && (
                <Text style={[styles.mbCounter, { color: themeColors.textMuted }]}>
                  {downloadedMb} MB / {totalMb} MB
                </Text>
              )}
            </View>
          ) : null}

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#EA4335" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {!isDownloading && !release.mandatory && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleDismiss}
                style={[
                  styles.btnSecondary,
                  {
                    borderColor: themeColors.borderColor,
                    backgroundColor: themeColors.surfaceContainer,
                  },
                ]}
              >
                <Text style={[styles.btnSecondaryText, { color: themeColors.textSecondary }]}>
                  {isMalay ? "Kemudian" : "Later"}
                </Text>
              </TouchableOpacity>
            )}

            {!isDownloading ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleStartUpdate}
                style={[
                  styles.btnPrimary,
                  { backgroundColor: themeColors.maroonPrimary, flex: release.mandatory ? 1 : 1.4 },
                ]}
              >
                <MaterialCommunityIcons name="download" size={20} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>
                  {isMalay ? "Kemas Kini Sekarang" : "Update Now"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleDismiss}
                style={[
                  styles.btnSecondary,
                  {
                    flex: 1,
                    borderColor: themeColors.borderColor,
                    backgroundColor: themeColors.surfaceContainer,
                  },
                ]}
              >
                <Text style={[styles.btnSecondaryText, { color: themeColors.textSecondary }]}>
                  {isMalay ? "Batal" : "Cancel"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Fallback link if needed */}
          {errorMessage && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleOpenBrowserFallback}
              style={{ marginTop: 12, alignItems: "center" }}
            >
              <Text style={{ fontSize: 13, color: themeColors.maroonPrimary, textDecorationLine: "underline" }}>
                {isMalay ? "Muat turun melalui pelayar web" : "Download via web browser"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  versionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  versionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  notesBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  downloadContainer: {
    marginBottom: 16,
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
    marginBottom: 14,
  },
  errorText: {
    color: "#EA4335",
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  btnSecondary: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  btnPrimary: {
    height: 46,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
