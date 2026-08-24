import React, { useState, useEffect, useCallback } from "react";
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
  TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn, FadeOut } from "react-native-reanimated";
import { router, useFocusEffect } from "expo-router";
import { checkForAppUpdates } from "@/services/updater";
import { fetchReleaseManifest, NativeAppRelease } from "@/services/apkUpdater";
import {
  getUpdateNotificationsEnabled,
  getLastUpdateNotificationFailure,
  hasUpdateNotificationPermission,
  setUpdateNotificationsEnabled,
} from "@/services/updateNotifications";
import { SPACING } from "@/constants/theme";
import { Button, InAppUpdateModal, PinKeypad } from "@/components";
import { FeedbackForm } from "@/components/FeedbackForm";
import { getCurrentUserProfile, signOut, getUserInitials, getUserRole } from "@/services/auth";
import {
  getAppLockEnabled,
  setAppLockEnabled,
  getBiometricsEnabled,
  setBiometricsEnabled,
  getAppLockTimeout,
  setAppLockTimeout,
  setAppLockPin,
  verifyAppLockPin,
  isBiometricSupported,
} from "@/services/security";
import { useAppSettings } from "@/context/AppSettingsContext";
import { firestore, auth } from "@/services/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { File as ExpoFile, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { Image as ExpoImage } from "expo-image";
import type { UserProfile, PropertyCase } from "@/types/case";
import type { PropertyListing } from "@/types/listing";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme, setTheme, language, themeColors, isDark, toggleTheme, setLanguage, t, allowScreenshots, toggleAllowScreenshots } = useAppSettings();

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
  const [phoneInput, setPhoneInput] = useState("");
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showTopMenu, setShowTopMenu] = useState(false);

  useEffect(() => {
    try {
      const user = getCurrentUserProfile();
      setProfile(user);
      if (user?.displayName) {
        setDisplayNameInput(user.displayName);
      }
      AsyncStorage.getItem("@artha_agent_phone").then((savedPhone) => {
        if (savedPhone) {
          setPhoneInput(savedPhone);
          if (user) {
            user.phoneNumber = savedPhone;
            user.phone = savedPhone;
          }
        } else if (user?.phoneNumber) {
          setPhoneInput(user.phoneNumber);
        }
      }).catch(() => {});
      if (user?.uid) {
        getUserRole(user.uid).then((r) => setIsAdmin(r === "admin")).catch(() => {});
      }
      getUpdateNotificationsEnabled()
        .then(setUpdateAlertsEnabled)
        .catch(() => {});
      getAppLockEnabled()
        .then(setAppLockState)
        .catch(() => {});
      getBiometricsEnabled()
        .then(setBiometricsState)
        .catch(() => {});
      getAppLockTimeout()
        .then(setAppLockTimeoutState)
        .catch(() => {});
    } catch (e) {
      console.warn("Profile load error:", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      getAppLockEnabled().then(setAppLockState).catch(() => {});
      getBiometricsEnabled().then(setBiometricsState).catch(() => {});
      getAppLockTimeout().then(setAppLockTimeoutState).catch(() => {});
    }, [])
  );

  // App Lock PIN & Biometrics State
  const [appLockEnabled, setAppLockState] = useState(false);
  const [biometricsEnabled, setBiometricsState] = useState(false);
  const [appLockTimeout, setAppLockTimeoutState] = useState(60000);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [isAppLockModalVisible, setIsAppLockModalVisible] = useState(false);
  const [appLockStep, setAppLockStep] = useState<"menu" | "verify_for_disable" | "verify_for_change" | "set_new" | "confirm_new">("menu");
  const [tempPin, setTempPin] = useState("");
  const [pinError, setPinError] = useState("");

  const handleSelectTimeout = async (timeoutMs: number) => {
    try {
      await setAppLockTimeout(timeoutMs);
      setAppLockTimeoutState(timeoutMs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleBiometrics = async (val: boolean) => {
    try {
      await setBiometricsEnabled(val);
      setBiometricsState(val);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePinCompleted = async (enteredPin: string) => {
    setPinError("");
    if (appLockStep === "verify_for_disable") {
      const isValid = await verifyAppLockPin(enteredPin);
      if (isValid) {
        await setAppLockEnabled(false);
        setAppLockState(false);
        setIsAppLockModalVisible(false);
        Alert.alert(
          language === "BM" ? "Kunci Aplikasi Dimatikan" : "App Lock Disabled",
          language === "BM" ? "Kunci PIN telah dinyahaktifkan." : "PIN protection has been disabled."
        );
      } else {
        setPinError(language === "BM" ? "PIN tidak sah. Sila cuba lagi." : "Incorrect PIN. Please try again.");
      }
    } else if (appLockStep === "verify_for_change") {
      const isValid = await verifyAppLockPin(enteredPin);
      if (isValid) {
        setAppLockStep("set_new");
      } else {
        setPinError(language === "BM" ? "PIN semasa salah." : "Incorrect current PIN.");
      }
    } else if (appLockStep === "set_new") {
      setTempPin(enteredPin);
      setAppLockStep("confirm_new");
    } else if (appLockStep === "confirm_new") {
      if (enteredPin === tempPin) {
        await setAppLockPin(enteredPin);
        await setAppLockEnabled(true);
        setAppLockState(true);
        setIsAppLockModalVisible(false);
        setTempPin("");
        Alert.alert(
          language === "BM" ? "Kunci PIN Disimpan" : "PIN Saved",
          language === "BM"
            ? "Aplikasi anda kini dilindungi dengan kata laluan PIN."
            : "Your app is now protected with your 4-digit PIN."
        );
      } else {
        setPinError(language === "BM" ? "PIN tidak sepadan! Sila masukkan semula." : "PINs do not match! Try again.");
        setTempPin("");
        setAppLockStep("set_new");
      }
    }
  };

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
      const cleanName = displayNameInput.trim();
      const cleanPhone = phoneInput.trim();

      await Promise.all([
        auth().currentUser?.updateProfile({ displayName: cleanName }).catch(() => {}),
        AsyncStorage.setItem("@artha_agent_phone", cleanPhone),
        auth().currentUser?.uid
          ? firestore().collection("users").doc(auth().currentUser!.uid).set(
              {
                displayName: cleanName,
                phoneNumber: cleanPhone,
                phone: cleanPhone,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            ).catch(() => {})
          : Promise.resolve(),
      ]);

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              displayName: cleanName,
              phoneNumber: cleanPhone,
              phone: cleanPhone,
            }
          : null
      );
      Alert.alert(
        language === "BM" ? "Profil Dikemaskini" : "Profile Updated",
        language === "BM"
          ? "Maklumat nama dan nombor WhatsApp anda berjaya disimpan."
          : "Your name and WhatsApp number have been saved successfully."
      );
      setActiveSection(null);
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
    onPress?: () => void,
    badgeColor?: string,
    isLast?: boolean
  ) => {
    return (
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress?.();
        }}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10.5,
          paddingHorizontal: 16,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: themeColors.borderColor,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            backgroundColor: badgeColor || themeColors.maroonPrimary,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}
        >
          <MaterialCommunityIcons name={icon as any} size={18} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontSize: 14.5, fontWeight: "600", color: themeColors.textPrimary }}>
            {title}
          </Text>
          {subtitle && (
            <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 1 }}>
              {subtitle}
            </Text>
          )}
        </View>

        <MaterialCommunityIcons name="chevron-right" size={18} color={themeColors.textMuted} />
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
      const listingsSnap = await firestore().collection("publicListings").where("userId", "==", user.uid).get();

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
      {/* Top 3-Dots Action Bar */}
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          paddingHorizontal: SPACING.lg,
          paddingVertical: 4,
          zIndex: 100,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setShowTopMenu(true);
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <MaterialCommunityIcons name="dots-vertical" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* 3-Dots Dropdown Modal with Smooth Animation and Outside Tap Dismissal */}
      <Modal
        visible={showTopMenu}
        transparent={true}
        animationType="none"
        onRequestClose={() => setShowTopMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTopMenu(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }}>
            <TouchableWithoutFeedback>
              <Animated.View
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(100)}
                style={{
                  position: "absolute",
                  top: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 44,
                  right: 16,
                  backgroundColor: isDark ? "#1E2022" : "#FFFFFF",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.25,
                  shadowRadius: 16,
                  elevation: 12,
                  minWidth: 160,
                  overflow: "hidden",
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => {
                    setShowTopMenu(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    handleSignOut();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 18,
                  }}
                >
                  <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#EF4444" }}>
                    {t("logout")}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ScrollView
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          paddingVertical: SPACING.sm,
          paddingBottom: Math.max(insets.bottom, 24) + 140,
          alignItems: "center",
        }}
        scrollIndicatorInsets={{ bottom: Math.max(insets.bottom, 24) + 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Telegram-style Centered Profile Header */}
        <Animated.View
          entering={FadeInDown.duration(180)}
          style={{
            alignItems: "center",
            width: "100%",
            paddingVertical: 10,
            marginBottom: 8,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/account" as any)}
            style={{ position: "relative", marginBottom: 8 }}
          >
            {profile?.photoURL ? (
              <ExpoImage
                source={{ uri: profile.photoURL }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 2,
                  borderColor: themeColors.maroonPrimary,
                }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: themeColors.maroonLight,
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: themeColors.maroonPrimary,
                }}
              >
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "700",
                    color: themeColors.maroonPrimary,
                  }}
                >
                  {getUserInitials(profile?.displayName || "Agent")}
                </Text>
              </View>
            )}

            {/* Telegram-style Camera Edit Badge */}
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                backgroundColor: "#3B82F6",
                width: 26,
                height: 26,
                borderRadius: 13,
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 2,
                borderColor: themeColors.canvasBackground,
              }}
            >
              <MaterialCommunityIcons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/account" as any)}
            style={{ alignItems: "center" }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: themeColors.textPrimary,
                marginBottom: 2,
              }}
            >
              {profile?.displayName || "Agent"}
            </Text>

            <Text style={{ fontSize: 13, color: themeColors.textMuted, textAlign: "center" }}>
              {phoneInput || profile?.phoneNumber
                ? `${phoneInput || profile?.phoneNumber}  •  ${profile?.email || "ejen@drtmasterlisting.com"}`
                : profile?.email || "ejen@drtmasterlisting.com"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Group 1: Account & Identity */}
        <Animated.View
          entering={FadeInDown.delay(50).duration(200)}
          style={{
            width: "100%",
            backgroundColor: themeColors.cardBackground,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          {renderOptionRow(
            "account-outline",
            t("accountSettings"),
            t("accountSubtitle"),
            () => router.push("/account" as any),
            "#3B82F6",
            !isAdmin
          )}
          {isAdmin &&
            renderOptionRow(
              "shield-crown-outline",
              t("adminPortalTitle"),
              t("adminPortalSub"),
              () => Linking.openURL("https://artharen.web.app/admin").catch(() => {}),
              "#F59E0B",
              true
            )}
        </Animated.View>

        {/* Group 2: Settings & Preferences */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(200)}
          style={{
            width: "100%",
            backgroundColor: themeColors.cardBackground,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          {/* Theme Row with inline Segmented Switch */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 9.5,
              paddingHorizontal: 16,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: themeColors.borderColor,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                backgroundColor: "#F97316",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 12,
              }}
            >
              <MaterialCommunityIcons
                name={theme === "system" ? "cellphone-cog" : isDark ? "weather-night" : "weather-sunny"}
                size={18}
                color="#FFFFFF"
              />
            </View>

            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 14.5, fontWeight: "600", color: themeColors.textPrimary }}>
                {t("themeLabel")}
              </Text>
              <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 1 }}>
                {theme === "system"
                  ? `Auto (${isDark ? "Dark" : "Light"})`
                  : isDark ? "Dark Mode" : "Light Mode"}
              </Text>
            </View>

            <View style={[styles.segmentContainer, { backgroundColor: themeColors.surfaceContainer }]}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setTheme("system");
                }}
                style={[
                  styles.segmentOption,
                  theme === "system" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: theme === "system" ? "#FFF" : themeColors.textMuted, fontSize: 11.5 },
                  ]}
                >
                  Auto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setTheme("light");
                }}
                style={[
                  styles.segmentOption,
                  theme === "light" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <MaterialCommunityIcons
                  name="weather-sunny"
                  size={13}
                  color={theme === "light" ? "#FFF" : themeColors.textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setTheme("dark");
                }}
                style={[
                  styles.segmentOption,
                  theme === "dark" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <MaterialCommunityIcons
                  name="weather-night"
                  size={13}
                  color={theme === "dark" ? "#FFF" : themeColors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Language Row with inline Segmented Switch */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 9.5,
              paddingHorizontal: 16,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: themeColors.borderColor,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                backgroundColor: "#8B5CF6",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 12,
              }}
            >
              <MaterialCommunityIcons name="translate" size={18} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 14.5, fontWeight: "600", color: themeColors.textPrimary }}>
                {t("languageLabel")}
              </Text>
              <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 1 }}>
                {language === "BM" ? t("bahasaMelayu") : t("english")}
              </Text>
            </View>

            <View style={[styles.segmentContainer, { backgroundColor: themeColors.surfaceContainer }]}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setLanguage("BM");
                }}
                style={[
                  styles.segmentOption,
                  language === "BM" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: language === "BM" ? "#FFF" : themeColors.textMuted, fontSize: 11.5 },
                  ]}
                >
                  BM
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setLanguage("EN");
                }}
                style={[
                  styles.segmentOption,
                  language === "EN" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: language === "EN" ? "#FFF" : themeColors.textMuted, fontSize: 11.5 },
                  ]}
                >
                  EN
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Privacy & Security */}
          {renderOptionRow(
            "shield-check-outline",
            t("privacySecurityTitle"),
            t("privacySecuritySubtitle"),
            () => router.push("/security" as any),
            "#10B981"
          )}

          {/* Notifications */}
          {renderOptionRow(
            "bell-ring-outline",
            t("notifications"),
            t("notifSubtitle"),
            () => router.push("/notification-settings" as any),
            "#EF4444"
          )}

          {/* Export Report */}
          {renderOptionRow(
            "file-table-outline",
            t("exportReport"),
            t("exportSubtitle"),
            handleExportReport,
            "#06B6D4",
            true
          )}
        </Animated.View>

        {/* Group 3: Support & App Version */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(200)}
          style={{
            width: "100%",
            backgroundColor: themeColors.cardBackground,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            overflow: "hidden",
            marginBottom: SPACING.lg,
          }}
        >
          {renderOptionRow(
            "information-outline",
            t("appVersion"),
            `v${Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "?"} · ${t("checkForUpdates")}`,
            () => router.push("/updates" as any),
            "#64748B"
          )}
          {renderOptionRow(
            "help-circle-outline",
            t("helpFeedback"),
            t("helpSubtitle"),
            () => router.push("/help" as any),
            "#6366F1",
            true
          )}
        </Animated.View>
      </ScrollView>

      {/* App Lock Management Modal */}
      <Modal
        visible={isAppLockModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAppLockModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
              paddingHorizontal: 20,
              maxHeight: "90%",
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                paddingBottom: 10,
                borderBottomWidth: 1,
                borderBottomColor: themeColors.borderColor,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons name="shield-lock-outline" size={22} color={themeColors.maroonPrimary} />
                <Text style={{ fontSize: 17, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Keselamatan & Kunci PIN" : "App Lock & Security"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsAppLockModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={22} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            {appLockStep === "menu" && (
              <View style={{ gap: 14 }}>
                <View
                  style={{
                    backgroundColor: themeColors.surfaceContainer,
                    padding: 16,
                    borderRadius: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                      {language === "BM" ? "Kunci Aplikasi PIN" : "App PIN Protection"}
                    </Text>
                    <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                      {appLockEnabled
                        ? (language === "BM" ? "PIN aktif untuk keselamatan akaun" : "PIN active for account security")
                        : (language === "BM" ? "Lindungi data kes & listing anda" : "Protect your cases & listings")}
                    </Text>
                  </View>
                  <Switch
                    value={appLockEnabled}
                    onValueChange={(val) => {
                      if (val) {
                        setAppLockStep("set_new");
                      } else {
                        setAppLockStep("verify_for_disable");
                      }
                      setPinError("");
                    }}
                    trackColor={{ false: themeColors.borderColor, true: themeColors.maroonPrimary }}
                  />
                </View>

                {hasBiometrics && appLockEnabled && (
                  <View
                    style={{
                      backgroundColor: themeColors.surfaceContainer,
                      padding: 16,
                      borderRadius: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                        {language === "BM" ? "Buka dengan Cap Jari / Biometrik" : "Unlock with Biometrics"}
                      </Text>
                      <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                        {language === "BM" ? "Gunakan cap jari untuk buka pantas" : "Use fingerprint for fast access"}
                      </Text>
                    </View>
                    <Switch
                      value={biometricsEnabled}
                      onValueChange={handleToggleBiometrics}
                      trackColor={{ false: themeColors.borderColor, true: themeColors.maroonPrimary }}
                    />
                  </View>
                )}

                {appLockEnabled && (
                  <View
                    style={{
                      backgroundColor: themeColors.surfaceContainer,
                      padding: 16,
                      borderRadius: 14,
                      gap: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <MaterialCommunityIcons name="timer-outline" size={20} color={themeColors.maroonPrimary} />
                      <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                        {language === "BM" ? "Kunci Semula Automatik" : "Auto-Lock Timeout"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: themeColors.textMuted }}>
                      {language === "BM"
                        ? "Pilih tempoh sebelum aplikasi dikunci semula selepas diminimumkan:"
                        : "Choose when the app relocks after being minimized:"}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                      {[
                        { label: language === "BM" ? "Serta-merta" : "Immediately", value: 0 },
                        { label: language === "BM" ? "1 Minit" : "1 Minute", value: 60000 },
                        { label: language === "BM" ? "5 Minit" : "5 Minutes", value: 300000 },
                        { label: language === "BM" ? "15 Minit" : "15 Minutes", value: 900000 },
                      ].map((opt) => {
                        const isSelected = appLockTimeout === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            activeOpacity={0.75}
                            onPress={() => handleSelectTimeout(opt.value)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 10,
                              backgroundColor: isSelected ? themeColors.maroonPrimary : themeColors.cardBackground,
                              borderWidth: 1,
                              borderColor: isSelected ? themeColors.maroonPrimary : themeColors.borderColor,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: isSelected ? "#FFFFFF" : themeColors.textPrimary,
                              }}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {appLockEnabled && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setAppLockStep("verify_for_change");
                      setPinError("");
                    }}
                    style={{
                      backgroundColor: themeColors.surfaceContainer,
                      padding: 16,
                      borderRadius: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <MaterialCommunityIcons name="form-textbox-password" size={22} color={themeColors.maroonPrimary} />
                      <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                        {language === "BM" ? "Tukar Kata Laluan PIN" : "Change PIN Passcode"}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {appLockStep === "verify_for_disable" && (
              <View style={{ alignItems: "center" }}>
                <PinKeypad
                  title={language === "BM" ? "Sahkan PIN Semasa" : "Confirm Current PIN"}
                  subtitle={language === "BM" ? "Masukkan PIN anda untuk mematikan kunci" : "Enter PIN to disable app lock"}
                  onPinComplete={handlePinCompleted}
                  showBiometricOption={false}
                  errorMessage={pinError}
                />
              </View>
            )}

            {appLockStep === "verify_for_change" && (
              <View style={{ alignItems: "center" }}>
                <PinKeypad
                  title={language === "BM" ? "Masukkan PIN Semasa" : "Enter Current PIN"}
                  subtitle={language === "BM" ? "Sahkan identiti anda sebelum menukar PIN" : "Verify identity before changing PIN"}
                  onPinComplete={handlePinCompleted}
                  showBiometricOption={false}
                  errorMessage={pinError}
                />
              </View>
            )}

            {appLockStep === "set_new" && (
              <View style={{ alignItems: "center" }}>
                <PinKeypad
                  title={language === "BM" ? "Tetapkan PIN 4-Digit Baru" : "Set New 4-Digit PIN"}
                  subtitle={language === "BM" ? "Pilih kod PIN yang mudah diingati" : "Choose a memorable 4-digit code"}
                  onPinComplete={handlePinCompleted}
                  showBiometricOption={false}
                  errorMessage={pinError}
                />
              </View>
            )}

            {appLockStep === "confirm_new" && (
              <View style={{ alignItems: "center" }}>
                <PinKeypad
                  title={language === "BM" ? "Sahkan PIN Baru Anda" : "Confirm Your New PIN"}
                  subtitle={language === "BM" ? "Masukkan sekali lagi kod PIN yang sama" : "Re-enter the same 4-digit code"}
                  onPinComplete={handlePinCompleted}
                  showBiometricOption={false}
                  errorMessage={pinError}
                />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Feedback Form Modal */}
      <FeedbackForm
        visible={isFeedbackFormVisible}
        onClose={() => setIsFeedbackFormVisible(false)}
      />

      {/* In-App Update Modal */}
      
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
    borderRadius: 7,
    padding: 2,
  },
  segmentOption: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 5,
  },
  segmentText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
});
