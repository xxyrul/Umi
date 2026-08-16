import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  StatusBar,
  Modal,
  Switch,
  TextInput,
  StyleSheet,
  Linking,
  Share,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { checkForAppUpdates } from "@/services/updater";
import { fetchReleaseManifest, NativeAppRelease } from "@/services/apkUpdater";
import {
  getUpdateNotificationsEnabled,
  getLastUpdateNotificationFailure,
  hasUpdateNotificationPermission,
  setUpdateNotificationsEnabled,
} from "@/services/updateNotifications";
import { SPACING } from "@/constants/theme";
import { Button, InAppUpdateModal } from "@/components";
import { FeedbackForm } from "@/components/FeedbackForm";
import { getCurrentUserProfile, signOut, getUserInitials } from "@/services/auth";
import { useAppSettings } from "@/context/AppSettingsContext";
import { firestore } from "@/services/firebase";
import Constants from "expo-constants";
import { File as ExpoFile, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import type { UserProfile, PropertyCase } from "@/types/case";
import type { PropertyListing } from "@/types/listing";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme, setTheme, language, themeColors, isDark, toggleTheme, setLanguage, t } = useAppSettings();

  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Settings Overlay State
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Feedback Form State
  const [isFeedbackFormVisible, setIsFeedbackFormVisible] = useState(false);

  // Switch Toggle States for Notifications
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [caseAlertsEnabled, setCaseAlertsEnabled] = useState(true);
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false);
  const [updateAlertsEnabled, setUpdateAlertsEnabled] = useState(false);
  const [isSavingUpdateAlerts, setIsSavingUpdateAlerts] = useState(false);

  // Interactive Account Settings State
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  useEffect(() => {
    try {
      const user = getCurrentUserProfile();
      setProfile(user);
      if (user?.displayName) {
        setDisplayNameInput(user.displayName);
      }
      getUpdateNotificationsEnabled()
        .then(setUpdateAlertsEnabled)
        .catch(() => {});
    } catch (e) {
      console.warn("Profile load error:", e);
    }
  }, []);

  const handleToggleUpdateAlerts = async (value: boolean) => {
    const user = getCurrentUserProfile();
    if (!user) {
      Alert.alert(
        t("errorTitle"),
        language === "BM"
          ? "Sila log masuk untuk menguruskan makluman kemas kini."
          : "Please sign in to manage update alerts."
      );
      return;
    }

    setIsSavingUpdateAlerts(true);
    try {
      const result = await setUpdateNotificationsEnabled({ uid: user.uid, language }, value);
      setUpdateAlertsEnabled(result);

      if (value && !result) {
        const permissionGranted = await hasUpdateNotificationPermission();
        if (!permissionGranted) {
          Alert.alert(
            language === "BM" ? "Kebenaran Diperlukan" : "Permission Needed",
            language === "BM"
              ? "Benarkan notifikasi dalam tetapan telefon untuk menerima makluman versi baharu."
              : "Allow notifications in your phone settings to receive new version alerts.",
            [
              {
                text: language === "BM" ? "Buka Tetapan" : "Open Settings",
                onPress: () => {
                  void Linking.openSettings();
                },
              },
              {
                text: language === "BM" ? "Batal" : "Cancel",
                style: "cancel",
              },
            ]
          );
        } else {
          const failure = getLastUpdateNotificationFailure();
          const failureMessage =
            failure === "token-unavailable"
              ? language === "BM"
                ? "Android tidak dapat mencipta token FCM. Sila pastikan Google Play Services tersedia dan cuba lagi."
                : "Android could not create an FCM token. Make sure Google Play Services is available, then try again."
              : failure === "firestore-permission-denied"
                ? language === "BM"
                  ? "Firebase menolak pendaftaran peranti. Peraturan Firestore untuk pengguna/peranti perlu diterbitkan."
                  : "Firebase rejected the device registration. The Firestore users/devices rule must be published."
                : failure === "firestore-unauthenticated"
                  ? language === "BM"
                    ? "Sesi log masuk Firebase telah tamat. Sila log masuk semula dan cuba lagi."
                    : "The Firebase sign-in session expired. Please sign in again and try again."
                  : failure === "firestore-unavailable"
                    ? language === "BM"
                      ? "Firebase tidak tersedia. Sila semak sambungan internet dan cuba lagi."
                      : "Firebase is unavailable. Check your internet connection and try again."
                    : language === "BM"
                      ? "Pendaftaran peranti gagal. Sila cuba lagi."
                      : "Device registration failed. Please try again.";
          Alert.alert(
            language === "BM" ? "Makluman Tidak Diaktifkan" : "Alerts Not Enabled",
            failureMessage
          );
        }
      }
    } finally {
      setIsSavingUpdateAlerts(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!displayNameInput.trim()) {
      Alert.alert(t("invalidName"), t("invalidNameMsg"));
      return;
    }
    try {
      setIsSavingAccount(true);
      if (profile) {
        profile.displayName = displayNameInput.trim();
      }
      Alert.alert(t("profileUpdated"), t("profileUpdatedMsg"));
    } catch (error) {
      Alert.alert(t("errorTitle"), t("failUpdateProfile"));
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t("logout"), t("confirmLogout"), [
      { text: t("cancelBtn"), onPress: () => {}, style: "cancel" },
      {
        text: t("logout"),
        onPress: async () => {
          try {
            await signOut();
            router.replace("/login");
          } catch (error) {
            Alert.alert(t("errorTitle"), t("failLogout"));
          }
        },
        style: "destructive",
      },
    ]);
  };

  // In-App Update Modal State
  const [profileRelease, setProfileRelease] = useState<NativeAppRelease | null>(null);
  const [isProfileUpdateModalVisible, setIsProfileUpdateModalVisible] = useState(false);

  const handleCheckForUpdates = async () => {
    try {
      const release = await fetchReleaseManifest();
      if (release) {
        setProfileRelease(release);
        setIsProfileUpdateModalVisible(true);
      } else {
        Alert.alert(
          language === "BM" ? "Aplikasi Terkini" : "App Up to Date",
          language === "BM"
            ? `Anda sedang menggunakan versi terkini Artha (v${Constants.expoConfig?.version || "1.1.34"}).`
            : `You are using the latest version of Artha (v${Constants.expoConfig?.version || "1.1.34"}).`
        );
      }
    } catch {
      Alert.alert(
        language === "BM" ? "Kemas Kini Tidak Tersedia" : "Update Check Unavailable",
        language === "BM" ? "Sila cuba semula kemudian." : "Please try again later."
      );
    }
  };

  const renderOptionRow = (
    icon: string,
    title: string,
    subtitle?: string,
    onPress?: () => void
  ) => {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: SPACING.md,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.borderColor,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: themeColors.surfaceContainer,
            justifyContent: "center",
            alignItems: "center",
            marginRight: SPACING.md,
          }}
        >
          <MaterialCommunityIcons name={icon as any} size={22} color={themeColors.maroonPrimary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: themeColors.textPrimary }}>
            {title}
          </Text>
          {subtitle && (
            <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
              {subtitle}
            </Text>
          )}
        </View>

        <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textMuted} />
      </TouchableOpacity>
    );
  };

  const handleExportReport = async () => {
    try {
      const user = getCurrentUserProfile();
      if (!user) {
        Alert.alert(t("errorTitle"), "User not authenticated.");
        return;
      }

      // Fetch user-specific cases
      const casesSnap = await firestore()
        .collection("cases")
        .where("userId", "==", user.uid)
        .get();

      // Fetch all listings but filter by user ownership
      const listingsSnap = await firestore().collection("publicListings").get();

      const allListings = listingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PropertyListing);
      const cases = casesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PropertyCase);

      const listings = allListings.filter(l => l && (l.userId === user.uid || l.agentId === user.uid));

      // Total active cases (e.g. cases that are not completed and not cancelled)
      const activeCases = cases.filter(c => c && c.status !== "Completed" && c.status !== "Cancelled").length;

      // Total portfolio property value (sum of harga of active/aktif listings)
      const totalValue = listings.reduce((sum, l) => {
        if (!l || l.harga === undefined || l.harga === null) return sum;
        const status = (l.status || "").toString().toLowerCase();
        if (status === "aktif" || status === "active" || status === "booking" || status === "under loan" || status === "under spa") {
          const val = parseFloat(l.harga.toString().replace(/[^0-9.]/g, '')) || 0;
          return sum + val;
        }
        return sum;
      }, 0);

      // Helper to format date
      const formatDate = (isoString: string | undefined | null) => {
        if (!isoString) return "";
        try {
          const d = new Date(isoString);
          if (isNaN(d.getTime())) return isoString;
          const day = String(d.getDate()).padStart(2, "0");
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const year = d.getFullYear();
          return `${day}/${month}/${year}`;
        } catch {
          return isoString;
        }
      };

      // Helper to format CSV row with 9 columns (the max column count)
      const csvRow = (cells: any[], totalCols = 9) => {
        const cleanCells = cells.map(c => {
          if (c === undefined || c === null) return '""';
          // Replace all types of weird whitespace with regular spaces
          const cleanStr = c.toString().replace(/[\u00A0\u202F]/g, " ").replace(/"/g, '""');
          return `"${cleanStr}"`;
        });
        while (cleanCells.length < totalCols) {
          cleanCells.push('""');
        }
        return cleanCells.join(",") + "\n";
      };

      // Estimated commission (2% of total value)
      const estimatedCommission = totalValue * 0.02;

      const formatter = new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });

      // Clean special Unicode spaces from formatting
      const rawValue = formatter.format(totalValue).replace("MYR", "RM");
      const rawCommission = formatter.format(estimatedCommission).replace("MYR", "RM");
      const formattedValue = rawValue.replace(/[\u00A0\u202F]/g, " ");
      const formattedCommission = rawCommission.replace(/[\u00A0\u202F]/g, " ");

      const rawGenTime = new Date().toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });
      const genTime = rawGenTime.replace(/[\u00A0\u202F]/g, " ");

      // Construct CSV content with UTF-8 BOM so Excel opens it with correct encoding
      let csvContent = "\ufeff";
      csvContent += csvRow(["DRT Master Listing CRM Report"]);
      csvContent += csvRow(["Generated At", `${genTime} (MYT)`]);
      csvContent += csvRow(["Total Active Cases", String(activeCases)]);
      csvContent += csvRow(["Total Portfolio Value", formattedValue]);
      csvContent += csvRow(["Estimated Commission (2%)", formattedCommission]);
      csvContent += csvRow([]); // Empty spacer row

      csvContent += csvRow(["PROPERTY LISTINGS"]);
      csvContent += csvRow(["ID", "Title", "Price", "Address", "State", "Type", "Status", "Agent ID", "Created At"]);
      listings.forEach(l => {
        if (!l) return;
        csvContent += csvRow([
          l.id,
          l.tajuk || "",
          (l.harga !== undefined && l.harga !== null) ? l.harga.toString() : "",
          l.alamat || "",
          l.negeri || "",
          l.jenis || "",
          l.status || "",
          l.agentId || "",
          formatDate(l.createdAt),
        ]);
      });

      csvContent += csvRow([]); // Empty spacer row
      csvContent += csvRow(["PROPERTY CASES"]);
      csvContent += csvRow(["ID", "Case Name", "Status", "Vendor", "Buyer", "Finance", "Created At"]);
      cases.forEach(c => {
        if (!c) return;
        csvContent += csvRow([
          c.id,
          c.namaCase || "",
          c.status || "",
          c.vendorName || "",
          c.buyerName || "",
          c.finance || "",
          formatDate(c.createdAt),
        ]);
      });

      // Show alert
      const appVersion = Constants.expoConfig?.version || "1.1.34";
      const alertMsg =
        language === "BM"
          ? `Ringkasan Kes Artha Master Listing v${appVersion}:\n\n• Kes Aktif: ${activeCases} Hartanah\n• Nilai Keseluruhan: ${formattedValue}\n• Anggaran Komisen: ${formattedCommission}\n\nLaporan CSV berjaya dieksport!`
          : `Artha Master Listing Summary v${appVersion}:\n\n• Active Cases: ${activeCases} Properties\n• Total Value: ${formattedValue}\n• Estimated Commission: ${formattedCommission}\n\nCSV Report exported successfully!`;

      Alert.alert(
        language === "BM" ? "📊 Laporan Kes Hartanah" : "📊 Property Cases Report",
        alertMsg,
        [
          {
            text: language === "BM" ? "Kongsi / Simpan" : "Share / Save",
            onPress: async () => {
              try {
                const file = new ExpoFile(Paths.document, "Artha_Cases_Report.csv");
                if (!file.exists) {
                  file.create();
                }
                file.write(csvContent);
                const fileUri = file.uri;

                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(fileUri, {
                    mimeType: "text/csv",
                    dialogTitle: language === "BM" ? "Kongsi Laporan Kes Hartanah" : "Share Property Cases Report",
                    UTI: "public.comma-separated-values-text",
                  });
                } else {
                  await Share.share({
                    message: csvContent,
                    title: "Artha Master Listing CRM Report",
                  });
                }
              } catch (shareErr: any) {
                console.error("Error sharing report:", shareErr);
                Alert.alert(
                  language === "BM" ? "Ralat Perkongsian" : "Sharing Error",
                  shareErr.message || JSON.stringify(shareErr)
                );
              }
            }
          },
          { text: "OK", style: "cancel" }
        ]
      );
    } catch (err: any) {
      console.error("Error generating export report:", err);
      Alert.alert(
        language === "BM" ? "Ralat" : "Error",
        (language === "BM" ? "Gagal menjana laporan eksport: " : "Failed to generate export report: ") + (err.message || JSON.stringify(err))
      );
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: themeColors.canvasBackground,
        paddingTop: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6,
      }}
    >
      <ScrollView
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          paddingVertical: SPACING.xl,
          paddingBottom: Math.max(insets.bottom, 24) + 104,
          alignItems: "center",
        }}
        scrollIndicatorInsets={{ bottom: Math.max(insets.bottom, 24) + 104 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Avatar / Initials */}
        <View style={{ marginBottom: SPACING.lg, alignItems: "center" }}>
          {profile?.photoURL ? (
            <ExpoImage
              source={{ uri: profile.photoURL }}
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                borderWidth: 3,
                borderColor: themeColors.maroonPrimary,
                marginBottom: SPACING.md,
              }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          ) : (
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: themeColors.maroonLight,
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 3,
                borderColor: themeColors.maroonPrimary,
                marginBottom: SPACING.md,
              }}
            >
              <Text
                style={{
                  fontSize: 36,
                  fontWeight: "700",
                  color: themeColors.maroonPrimary,
                }}
              >
                {getUserInitials(profile?.displayName || "Agent")}
              </Text>
            </View>
          )}

          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: themeColors.textPrimary,
              marginBottom: 4,
            }}
          >
            {profile?.displayName || "Agent"}
          </Text>

          <Text style={{ fontSize: 14, color: themeColors.textMuted }}>
            {profile?.email || "ejen@drtmasterlisting.com"}
          </Text>
        </View>

        {/* Quick App Preferences Card (Theme & Language Switchers) */}
        <View
          style={{
            width: "100%",
            backgroundColor: themeColors.cardBackground,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            padding: SPACING.lg,
            marginBottom: SPACING.lg,
            gap: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: themeColors.maroonPrimary }}>
            {t("settingsTitle")}
          </Text>

          {/* Theme Mode Selector (Auto / Light / Dark) */}
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceInfo}>
              <MaterialCommunityIcons
                name={theme === "system" ? "cellphone-cog" : isDark ? "weather-night" : "weather-sunny"}
                size={22}
                color={themeColors.maroonPrimary}
              />
              <View>
                <Text style={[styles.preferenceTitle, { color: themeColors.textPrimary }]}>
                  {t("themeLabel")}
                </Text>
                <Text style={[styles.preferenceSubtitle, { color: themeColors.textMuted }]}>
                  {theme === "system"
                    ? `Auto (${isDark ? "Dark" : "Light"})`
                    : isDark ? "Dark Mode" : "Light Mode"}
                </Text>
              </View>
            </View>

            <View style={[styles.segmentContainer, { backgroundColor: themeColors.surfaceContainer }]}>
              <TouchableOpacity
                onPress={() => setTheme("system")}
                style={[
                  styles.segmentOption,
                  theme === "system" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: theme === "system" ? "#FFF" : themeColors.textMuted },
                  ]}
                >
                  Auto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setTheme("light")}
                style={[
                  styles.segmentOption,
                  theme === "light" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <MaterialCommunityIcons
                  name="weather-sunny"
                  size={15}
                  color={theme === "light" ? "#FFF" : themeColors.textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setTheme("dark")}
                style={[
                  styles.segmentOption,
                  theme === "dark" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <MaterialCommunityIcons
                  name="weather-night"
                  size={15}
                  color={theme === "dark" ? "#FFF" : themeColors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Language Switcher (BM / EN) */}
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceInfo}>
              <MaterialCommunityIcons
                name="translate"
                size={22}
                color={themeColors.maroonPrimary}
              />
              <View>
                <Text style={[styles.preferenceTitle, { color: themeColors.textPrimary }]}>
                  {t("languageLabel")}
                </Text>
                <Text style={[styles.preferenceSubtitle, { color: themeColors.textMuted }]}>
                  {language === "BM" ? t("bahasaMelayu") : t("english")}
                </Text>
              </View>
            </View>

            <View style={[styles.segmentContainer, { backgroundColor: themeColors.surfaceContainer }]}>
              <TouchableOpacity
                onPress={() => setLanguage("BM")}
                style={[
                  styles.segmentOption,
                  language === "BM" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: language === "BM" ? "#FFF" : themeColors.textMuted },
                  ]}
                >
                  BM
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setLanguage("EN")}
                style={[
                  styles.segmentOption,
                  language === "EN" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: language === "EN" ? "#FFF" : themeColors.textMuted },
                  ]}
                >
                  EN
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Detailed Settings Card */}
        <View
          style={{
            width: "100%",
            backgroundColor: themeColors.cardBackground,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            paddingHorizontal: SPACING.lg,
            paddingVertical: SPACING.sm,
            marginBottom: SPACING.xl,
          }}
        >
          {renderOptionRow("account-outline", t("accountSettings"), t("accountSubtitle"), () => setActiveSection("Account"))}
          {renderOptionRow("file-export-outline", t("exportReport"), t("exportSubtitle"), handleExportReport)}
          {renderOptionRow("bell-ring-outline", t("notifications"), t("notifSubtitle"), () => setActiveSection("Notifications"))}
          {renderOptionRow(
            "information-outline",
            t("appVersion"),
            `v${Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "—"} · ${t("checkForUpdates")}`,
            handleCheckForUpdates
          )}
          {renderOptionRow("help-circle-outline", t("helpFeedback"), t("helpSubtitle"), () => setActiveSection("Help"))}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSignOut}
          style={{
            width: "100%",
            backgroundColor: themeColors.cardBackground,
            borderWidth: 1,
            borderColor: "#EF4444",
            borderRadius: 12,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
          <Text style={{ color: "#EF4444", fontSize: 15, fontWeight: "700" }}>
            {t("logout")}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Settings Modal Sheet */}
      <Modal
        visible={activeSection !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveSection(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: isDark ? "#1E1E1E" : themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : themeColors.borderColor,
              padding: SPACING.lg,
              maxHeight: "85%",
              minHeight: "45%",
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: SPACING.lg,
                borderBottomWidth: 1,
                borderBottomColor: themeColors.borderColor,
                paddingBottom: SPACING.md,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: themeColors.textPrimary }}>
                {activeSection === "Account"
                  ? t("accountSettings")
                  : activeSection === "Notifications"
                  ? t("notifications")
                  : activeSection === "Help"
                  ? t("helpFeedback")
                  : activeSection}
              </Text>
              <TouchableOpacity onPress={() => setActiveSection(null)}>
                <MaterialCommunityIcons name="close" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Modal Scroll Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xl }}>
              {activeSection === "Account" && (
                <View style={{ gap: SPACING.md }}>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.maroonPrimary, textTransform: "uppercase", marginBottom: 6 }}>
                      {t("displayName")}
                    </Text>
                    <TextInput
                      value={displayNameInput}
                      onChangeText={setDisplayNameInput}
                      placeholder={t("displayNamePlaceholder")}
                      placeholderTextColor={themeColors.textMuted}
                      autoFocus={activeSection === "Account"}
                      style={{
                        fontSize: 15,
                        color: themeColors.textPrimary,
                        backgroundColor: themeColors.canvasBackground,
                        padding: SPACING.md,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: themeColors.borderColor,
                      }}
                    />
                  </View>

                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.maroonPrimary, textTransform: "uppercase", marginBottom: 6 }}>
                      {t("email")}
                    </Text>
                    <Text style={{ fontSize: 15, color: themeColors.textMuted, backgroundColor: themeColors.canvasBackground, padding: SPACING.md, borderRadius: 10, borderWidth: 1, borderColor: themeColors.borderColor }}>
                      {profile?.email || "ejen@drtmasterlisting.com"}
                    </Text>
                  </View>

                  <Button
                    label={t("saveInfo")}
                    variant="primary"
                    icon="content-save-outline"
                    loading={isSavingAccount}
                    onPress={handleSaveAccount}
                    style={{ marginTop: SPACING.md, backgroundColor: themeColors.maroonPrimary }}
                  />
                </View>
              )}

              {activeSection === "Notifications" && (
                <View style={{ gap: SPACING.lg }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, paddingRight: SPACING.md }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: themeColors.textPrimary }}>
                        {language === "BM" ? "Notifikasi Push" : "Push Notifications"}
                      </Text>
                      <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                        {language === "BM" ? "Terima amaran segera pada peranti" : "Receive instant alerts on your device"}
                      </Text>
                    </View>
                    <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ false: "#D1D5DB", true: themeColors.maroonPrimary }} thumbColor={pushEnabled ? "#FFFFFF" : "#F3F4F6"} />
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, paddingRight: SPACING.md }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: themeColors.textPrimary }}>
                        {language === "BM" ? "Peringatan Kes & Temujanji" : "Case & Appointment Alerts"}
                      </Text>
                      <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                        {language === "BM" ? "Peringatan automatik susulan pembeli / vendor" : "Auto-reminders for buyer / vendor follow-ups"}
                      </Text>
                    </View>
                    <Switch value={caseAlertsEnabled} onValueChange={setCaseAlertsEnabled} trackColor={{ false: "#D1D5DB", true: themeColors.maroonPrimary }} thumbColor={caseAlertsEnabled ? "#FFFFFF" : "#F3F4F6"} />
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, paddingRight: SPACING.md }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: themeColors.textPrimary }}>
                        {language === "BM" ? "Makluman Versi Baharu" : "New Version Alerts"}
                      </Text>
                      <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                        {language === "BM"
                          ? "Beritahu saya apabila kemas kini aplikasi dikeluarkan"
                          : "Notify me when an app update is released"}
                      </Text>
                    </View>
                    <Switch
                      value={updateAlertsEnabled}
                      onValueChange={handleToggleUpdateAlerts}
                      disabled={isSavingUpdateAlerts}
                      trackColor={{ false: "#D1D5DB", true: themeColors.maroonPrimary }}
                      thumbColor={updateAlertsEnabled ? "#FFFFFF" : "#F3F4F6"}
                    />
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", opacity: 0.65 }}>
                    <View style={{ flex: 1, paddingRight: SPACING.md }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: "600", color: themeColors.textPrimary }}>
                          {language === "BM" ? "Ringkasan E-mel Mingguan" : "Weekly Email Digest"}
                        </Text>
                        <View style={{ backgroundColor: "rgba(255, 180, 180, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFB4B4" }}>
                            {language === "BM" ? "AKAN DATANG" : "COMING SOON"}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                        {language === "BM" ? "Laporan prestasi harta dihantar ke e-mel secara automatik." : "Automated property performance digest sent to email."}
                      </Text>
                    </View>
                    <Switch value={false} disabled={true} trackColor={{ false: "#4B5563", true: themeColors.maroonPrimary }} thumbColor="#9CA3AF" />
                  </View>
                </View>
              )}

              {activeSection === "Help" && (
                <View style={{ gap: SPACING.md }}>
                  <Text style={{ fontSize: 14, color: themeColors.textSecondary, marginBottom: 4 }}>
                    {language === "BM"
                      ? "Memerlukan bantuan teknikal atau ingin melaporkan maklum balas berkenaan aplikasi DRT Master Listing?"
                      : "Need technical support or want to report feedback regarding DRT Master Listing CRM?"}
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setActiveSection(null);
                      setIsFeedbackFormVisible(true);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: themeColors.maroonPrimary,
                      borderRadius: 12,
                      padding: 14,
                      gap: 12,
                    }}
                  >
                    <MaterialCommunityIcons name="comment-multiple-outline" size={24} color="#FFF" />
                    <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "700" }}>
                      {language === "BM" ? "Hantar Maklum Balas" : "Send Feedback"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => Linking.openURL("https://wa.me/601114190091?text=Hello%20Artha%20Master%20Listing%20Support")}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#10B981",
                      borderRadius: 12,
                      padding: 14,
                      gap: 12,
                    }}
                  >
                    <MaterialCommunityIcons name="whatsapp" size={24} color="#FFF" />
                    <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "700" }}>
                      {language === "BM" ? "Sembang Bantuan WhatsApp" : "WhatsApp Support Chat"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => Linking.openURL("mailto:azrul.baharum@proton.me?subject=Support%20Request%20-%20Artha%20Master%20Listing")}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: themeColors.surfaceContainer,
                      borderColor: themeColors.borderColor,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 14,
                      gap: 12,
                    }}
                  >
                    <MaterialCommunityIcons name="email-outline" size={24} color={themeColors.maroonPrimary} />
                    <Text style={{ color: themeColors.textPrimary, fontSize: 15, fontWeight: "700" }}>
                      {language === "BM" ? "Hantar E-mel Sokongan" : "Email Customer Support"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Feedback Form Modal */}
      <FeedbackForm
        visible={isFeedbackFormVisible}
        onClose={() => setIsFeedbackFormVisible(false)}
      />

      {/* In-App Update Modal */}
      <InAppUpdateModal
        visible={isProfileUpdateModalVisible}
        release={profileRelease}
        onClose={() => setIsProfileUpdateModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preferenceInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  preferenceTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  preferenceSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 8,
    padding: 3,
  },
  segmentOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
