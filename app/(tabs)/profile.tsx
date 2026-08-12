import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { checkForAppUpdates } from "@/services/updater";
import { SPACING } from "@/constants/theme";
import { Button } from "@/components";
import { PinKeypad } from "@/components/PinKeypad";
import { FeedbackForm } from "@/components/FeedbackForm";
import { getCurrentUserProfile, signOut, getUserInitials } from "@/services/auth";
import { useAppSettings } from "@/context/AppSettingsContext";
import firestore from "@react-native-firebase/firestore";

import {
  getAppLockEnabled,
  setAppLockEnabled,
  getBiometricsEnabled,
  setBiometricsEnabled,
  getAppLockPin,
  setAppLockPin,
  isBiometricSupported,
} from "@/services/security";
import type { UserProfile, PropertyCase } from "@/types/case";
import type { PropertyListing } from "@/types/listing";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { language, themeColors, isDark, toggleTheme, setLanguage, t } = useAppSettings();

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

  // App Lock States
  const [appLockEnabled, setAppLockEnabledState] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);

  // PIN Setup Modal state
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [pinSetupStep, setPinSetupStep] = useState<"create" | "confirm">("create");
  const [firstPin, setFirstPin] = useState("");
  const [pinSetupError, setPinSetupError] = useState("");

  // Interactive Account Settings State
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  useEffect(() => {
    const user = getCurrentUserProfile();
    setProfile(user);
    if (user?.displayName) {
      setDisplayNameInput(user.displayName);
    }
    getAppLockEnabled().then(setAppLockEnabledState);
    getBiometricsEnabled().then(setBiometricsEnabledState);
  }, []);

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

  const handleToggleAppLock = async (value: boolean) => {
    if (value) {
      const existingPin = await getAppLockPin();
      if (!existingPin) {
        setPinSetupStep("create");
        setFirstPin("");
        setPinSetupError("");
        setShowPinSetupModal(true);
      } else {
        setAppLockEnabledState(true);
        await setAppLockEnabled(true);
        const biometricsSupported = await isBiometricSupported();
        setBiometricsEnabledState(biometricsSupported);
        await setBiometricsEnabled(biometricsSupported);
        Alert.alert(t("appLockActive"), t("appLockActiveMsg"));
      }
    } else {
      setAppLockEnabledState(false);
      await setAppLockEnabled(false);
      setBiometricsEnabledState(false);
      await setBiometricsEnabled(false);
      Alert.alert(t("appLockOff"), t("appLockOffMsg"));
    }
  };

  const handleToggleBiometrics = async (value: boolean) => {
    if (!appLockEnabled) {
      Alert.alert(t("errorTitle"), t("appLockLabel"));
      return;
    }

    const supported = await isBiometricSupported();
    if (value && !supported) {
      Alert.alert(t("errorTitle"), "Biometric authentication is not available on this device.");
      return;
    }

    setBiometricsEnabledState(value);
    await setBiometricsEnabled(value);
  };

  const closePinSetupModal = () => {
    setShowPinSetupModal(false);
    setPinSetupStep("create");
    setFirstPin("");
    setPinSetupError("");
  };

  const handlePinSetupComplete = async (pin: string) => {
    if (pinSetupStep === "create") {
      setFirstPin(pin);
      setPinSetupStep("confirm");
      setPinSetupError("");
      return;
    }

    if (pin !== firstPin) {
      setPinSetupError("PIN mismatch. Please try again.");
      setPinSetupStep("create");
      setFirstPin("");
      return;
    }

    try {
      await setAppLockPin(pin);
      await setAppLockEnabled(true);
      setAppLockEnabledState(true);

      const biometricsSupported = await isBiometricSupported();
      setBiometricsEnabledState(biometricsSupported);
      await setBiometricsEnabled(biometricsSupported);

      closePinSetupModal();
      Alert.alert(t("appLockActive"), t("appLockActiveMsg"));
    } catch {
      setPinSetupError("Unable to save PIN. Please try again.");
      setPinSetupStep("create");
      setFirstPin("");
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
      const listingsSnap = await firestore().collection("listings").get();

      const allListings = listingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PropertyListing);
      const cases = casesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PropertyCase);

      const listings = allListings.filter(l => l.userId === user.uid || l.agentId === user.uid);

      // Total active cases (e.g. cases that are not completed and not cancelled)
      const activeCases = cases.filter(c => c.status !== "Completed" && c.status !== "Cancelled").length;

      // Total portfolio property value (sum of harga of active/aktif listings)
      const totalValue = listings.reduce((sum, l) => {
        const status = (l.status || "").toString().toLowerCase();
        if (status === "aktif" || status === "active" || status === "booking" || status === "under loan" || status === "under spa") {
          const val = parseFloat(l.harga.toString().replace(/[^0-9.]/g, '')) || 0;
          return sum + val;
        }
        return sum;
      }, 0);

      // Estimated commission (2% of total value)
      const estimatedCommission = totalValue * 0.02;

      const formatter = new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      const formattedValue = formatter.format(totalValue).replace("MYR", "RM");
      const formattedCommission = formatter.format(estimatedCommission).replace("MYR", "RM");

      // Construct CSV content
      let csvContent = `"DRT Master Listing CRM Report"\n`;
      csvContent += `"Generated At","${new Date().toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })} (MYT)"\n`;
      csvContent += `"Total Active Cases","${activeCases}"\n`;
      csvContent += `"Total Portfolio Value","${formattedValue}"\n`;
      csvContent += `"Estimated Commission (2%)","${formattedCommission}"\n\n`;

      csvContent += `"PROPERTY LISTINGS"\n`;
      csvContent += `"ID","Title","Price","Address","State","Type","Status","Agent ID","Created At"\n`;
      listings.forEach(l => {
        const cleanTitle = (l.tajuk || "").replace(/"/g, '""');
        const cleanAddress = (l.alamat || "").replace(/"/g, '""');
        csvContent += `"${l.id}","${cleanTitle}","${l.harga}","${cleanAddress}","${l.negeri}","${l.jenis}","${l.status}","${l.agentId}","${l.createdAt || ""}"\n`;
      });

      csvContent += `\n"PROPERTY CASES"\n`;
      csvContent += `"ID","Case Name","Status","Vendor","Buyer","Finance","Created At"\n`;
      cases.forEach(c => {
        const cleanCaseName = (c.namaCase || "").replace(/"/g, '""');
        const cleanVendor = (c.vendorName || "").replace(/"/g, '""');
        const cleanBuyer = (c.buyerName || "").replace(/"/g, '""');
        csvContent += `"${c.id}","${cleanCaseName}","${c.status}","${cleanVendor}","${cleanBuyer}","${c.finance}","${c.createdAt || ""}"\n`;
      });

      // Show alert
      const alertMsg = language === "BM"
        ? `Ringkasan Kes DRT Master Listing v1.1.1:\n\n• Kes Aktif: ${activeCases} Hartanah\n• Nilai Keseluruhan: ${formattedValue}\n• Anggaran Komisen: ${formattedCommission}\n\nLaporan CSV berjaya dieksport!`
        : `DRT Master Listing Summary v1.1.1:\n\n• Active Cases: ${activeCases} Properties\n• Total Value: ${formattedValue}\n• Estimated Commission: ${formattedCommission}\n\nCSV Report exported successfully!`;

      Alert.alert(
        language === "BM" ? "📊 Laporan Kes Hartanah" : "📊 Property Cases Report",
        alertMsg,
        [
          {
            text: language === "BM" ? "Kongsi / Simpan" : "Share / Save",
            onPress: async () => {
              try {
                await Share.share({
                  message: csvContent,
                  title: "DRT Master Listing CRM Report",
                });
              } catch (shareErr) {
                console.error("Error sharing report:", shareErr);
              }
            }
          },
          { text: "OK", style: "cancel" }
        ]
      );
    } catch (err) {
      console.error("Error generating export report:", err);
      Alert.alert("Error", "Failed to generate export report.");
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
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          paddingVertical: SPACING.xl,
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Avatar / Initials */}
        <View style={{ marginBottom: SPACING.lg, alignItems: "center" }}>
          {profile?.photoURL ? (
            <Image
              source={{ uri: profile.photoURL }}
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                borderWidth: 3,
                borderColor: themeColors.maroonPrimary,
                marginBottom: SPACING.md,
              }}
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
                {getUserInitials(profile?.displayName || "Azrul")}
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
            {profile?.displayName || "Azrul"}
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

          {/* Dark / Light Mode Switcher */}
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceInfo}>
              <MaterialCommunityIcons
                name={isDark ? "weather-night" : "weather-sunny"}
                size={22}
                color={themeColors.maroonPrimary}
              />
              <View>
                <Text style={[styles.preferenceTitle, { color: themeColors.textPrimary }]}>
                  {t("themeLabel")}
                </Text>
                <Text style={[styles.preferenceSubtitle, { color: themeColors.textMuted }]}>
                  {isDark ? t("darkMode") : t("lightMode")}
                </Text>
              </View>
            </View>

            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: "#D1D5DB", true: themeColors.maroonPrimary }}
              thumbColor={isDark ? "#FFFFFF" : "#F3F4F6"}
            />
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
          {renderOptionRow("shield-lock-outline", t("securityPin"), t("securitySubtitle"), () => setActiveSection("Security"))}
          {renderOptionRow("information-outline", t("appVersion"), "v1.1.1 (Native Release)", () => {
            checkForAppUpdates({ silent: false, autoApply: false });
          })}
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
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: themeColors.borderColor,
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
                  : activeSection === "Security"
                  ? t("securityPin")
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

              {activeSection === "Security" && (
                <View style={{ gap: SPACING.lg }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, paddingRight: SPACING.md }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: themeColors.textPrimary }}>
                        {t("appLockLabel")}
                      </Text>
                      <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                        {t("appLockSub")}
                      </Text>
                    </View>
                    <Switch value={appLockEnabled} onValueChange={handleToggleAppLock} trackColor={{ false: "#D1D5DB", true: themeColors.maroonPrimary }} thumbColor={appLockEnabled ? "#FFFFFF" : "#F3F4F6"} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, paddingRight: SPACING.md }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: themeColors.textPrimary }}>
                        {t("biometricsLabel")}
                      </Text>
                      <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                        {t("biometricsSub")}
                      </Text>
                    </View>
                    <Switch value={biometricsEnabled} onValueChange={handleToggleBiometrics} trackColor={{ false: "#D1D5DB", true: themeColors.maroonPrimary }} thumbColor={biometricsEnabled ? "#FFFFFF" : "#F3F4F6"} />
                  </View>
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
                        {language === "BM" ? "Ringkasan E-mel Mingguan" : "Weekly Email Digest"}
                      </Text>
                      <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                        {language === "BM" ? "Laporan prestasi harta dihantar ke e-mel" : "Property performance digest sent to email"}
                      </Text>
                    </View>
                    <Switch value={dailyDigestEnabled} onValueChange={setDailyDigestEnabled} trackColor={{ false: "#D1D5DB", true: themeColors.maroonPrimary }} thumbColor={dailyDigestEnabled ? "#FFFFFF" : "#F3F4F6"} />
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
                    onPress={() => Linking.openURL("https://wa.me/601114190091?text=Hello%20DRT%20Master%20Listing%20Support")}
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
                    onPress={() => Linking.openURL("mailto:azrul.baharum@proton.me?subject=Support%20Request%20-%20DRT%20Master%20Listing")}
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
        </View>
      </Modal>

      <Modal
        visible={showPinSetupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closePinSetupModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: themeColors.borderColor,
              padding: SPACING.lg,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: SPACING.md,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: themeColors.textPrimary }}>
                {pinSetupStep === "create" ? "Create 4-digit PIN" : "Confirm 4-digit PIN"}
              </Text>
              <TouchableOpacity onPress={closePinSetupModal}>
                <MaterialCommunityIcons name="close" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <PinKeypad
              title={pinSetupStep === "create" ? "Set Security PIN" : "Confirm Security PIN"}
              subtitle={pinSetupStep === "create" ? "Create your 4-digit PIN" : "Re-enter your PIN to confirm"}
              onPinComplete={handlePinSetupComplete}
              showBiometricOption={false}
              errorMessage={pinSetupError}
            />
          </View>
        </View>
      </Modal>

      {/* Feedback Form Modal */}
      <FeedbackForm
        visible={isFeedbackFormVisible}
        onClose={() => setIsFeedbackFormVisible(false)}
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
