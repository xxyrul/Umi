import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAppSettings } from "@/context/AppSettingsContext";
import { PinKeypad } from "@/components";
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
import { SPACING } from "@/constants/theme";

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { themeColors, language, isDark, allowScreenshots, toggleAllowScreenshots } = useAppSettings();
  const isBM = language === "BM";

  // App Lock & Biometrics State
  const [appLockEnabled, setAppLockState] = useState(false);
  const [biometricsEnabled, setBiometricsState] = useState(false);
  const [appLockTimeout, setAppLockTimeoutState] = useState(60000);
  const [hasBiometrics, setHasBiometrics] = useState(false);

  // PIN Keypad Setup Modal State
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);
  const [pinStep, setPinStep] = useState<"verify_for_disable" | "verify_for_change" | "set_new" | "confirm_new">("set_new");
  const [pinError, setPinError] = useState("");
  const [tempPin, setTempPin] = useState("");
  const [pinFocusTick, setPinFocusTick] = useState(0);

  useEffect(() => {
    async function loadSecuritySettings() {
      try {
        const [lock, bio, supported, timeout] = await Promise.all([
          getAppLockEnabled(),
          getBiometricsEnabled(),
          isBiometricSupported(),
          getAppLockTimeout(),
        ]);
        setAppLockState(lock);
        setBiometricsState(bio);
        setHasBiometrics(supported);
        setAppLockTimeoutState(timeout);
      } catch (err) {
        console.warn("Error loading security settings:", err);
      }
    }
    loadSecuritySettings();
  }, []);

  const handleToggleAppLock = (val: boolean) => {
    setPinError("");
    setTempPin("");
    if (val) {
      setPinStep("set_new");
      setIsPinModalVisible(true);
    } else {
      setPinStep("verify_for_disable");
      setIsPinModalVisible(true);
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

  const handleSelectTimeout = async (timeoutMs: number) => {
    try {
      await setAppLockTimeout(timeoutMs);
      setAppLockTimeoutState(timeoutMs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangePinPress = () => {
    setPinError("");
    setTempPin("");
    setPinStep("verify_for_change");
    setIsPinModalVisible(true);
  };

  const handlePinCompleted = async (enteredPin: string) => {
    setPinError("");

    if (pinStep === "verify_for_disable") {
      const isValid = await verifyAppLockPin(enteredPin);
      if (isValid) {
        await setAppLockEnabled(false);
        setAppLockState(false);
        setIsPinModalVisible(false);
        Alert.alert(
          isBM ? "Kunci Aplikasi Dimatikan" : "App Lock Disabled",
          isBM ? "Kunci PIN telah dinyahaktifkan." : "PIN protection has been disabled."
        );
      } else {
        setPinError(isBM ? "PIN tidak sah. Sila cuba lagi." : "Incorrect PIN. Please try again.");
      }
    } else if (pinStep === "verify_for_change") {
      const isValid = await verifyAppLockPin(enteredPin);
      if (isValid) {
        setPinStep("set_new");
      } else {
        setPinError(isBM ? "PIN tidak sah. Sila cuba lagi." : "Incorrect PIN. Please try again.");
      }
    } else if (pinStep === "set_new") {
      setTempPin(enteredPin);
      setPinStep("confirm_new");
    } else if (pinStep === "confirm_new") {
      if (enteredPin === tempPin) {
        await setAppLockPin(enteredPin);
        await setAppLockEnabled(true);
        setAppLockState(true);
        setIsPinModalVisible(false);
        Alert.alert(
          isBM ? "PIN Berjaya Disimpan" : "PIN Saved Successfully",
          isBM ? "Kunci aplikasi kini dilindungi PIN." : "App lock is now active."
        );
      } else {
        setPinError(isBM ? "PIN tidak sepadan. Sila tetapkan semula." : "PINs do not match. Please try again.");
        setPinStep("set_new");
        setTempPin("");
      }
    }
  };

  const timeoutOptions = [
    { label: isBM ? "Serta-merta (Disyorkan)" : "Immediately (Recommended)", value: 0 },
    { label: isBM ? "1 Minit" : "1 Minute", value: 60000 },
    { label: isBM ? "5 Minit" : "5 Minutes", value: 300000 },
    { label: isBM ? "15 Minit" : "15 Minutes", value: 900000 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.canvasBackground }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16) + 8,
            backgroundColor: themeColors.canvasBackground,
            borderBottomColor: themeColors.borderColor,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
          {isBM ? "Privasi & Keselamatan" : "Privacy & Security"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          paddingTop: SPACING.md,
          paddingBottom: Math.max(insets.bottom, 24) + 40,
        }}
      >
        {/* Section 1: App Lock & Biometrics */}
        <Animated.View entering={FadeInDown.duration(300)} style={{ marginBottom: SPACING.lg }}>
          <Text style={[styles.sectionHeading, { color: themeColors.maroonPrimary }]}>
            {isBM ? "Kunci Aplikasi & Biometrik" : "App Lock & Biometrics"}
          </Text>

          <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
            {/* PIN Switch */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={20} color={themeColors.maroonPrimary} />
                  <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>
                    {isBM ? "Kunci Aplikasi (PIN 4-Digit)" : "App Lock (4-Digit PIN)"}
                  </Text>
                </View>
                <Text style={[styles.settingDesc, { color: themeColors.textSecondary }]}>
                  {isBM
                    ? "Lindungi akses ke CRM anda dengan kod PIN rahsia."
                    : "Require a secret 4-digit PIN code whenever opening the app."}
                </Text>
              </View>
              <Switch
                value={appLockEnabled}
                onValueChange={handleToggleAppLock}
                trackColor={{ false: themeColors.borderColor, true: themeColors.maroonPrimary }}
                thumbColor="#FFF"
              />
            </View>

            {/* Change PIN Button (if enabled) */}
            {appLockEnabled && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleChangePinPress}
                style={[styles.actionSubRow, { borderTopColor: themeColors.borderColor }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="form-textbox-password" size={18} color={themeColors.maroonPrimary} />
                  <Text style={[styles.subRowText, { color: themeColors.textPrimary }]}>
                    {isBM ? "Tukar Kod PIN Semasa" : "Change Current PIN"}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>
            )}

            {/* Biometrics Toggle (if hardware supported & app lock is on) */}
            {appLockEnabled && hasBiometrics && (
              <View style={[styles.subRowWrapper, { borderTopColor: themeColors.borderColor }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <MaterialCommunityIcons name="fingerprint" size={20} color={themeColors.maroonPrimary} />
                    <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>
                      {isBM ? "Buka Kunci Cap Jari / Biometrik" : "Biometric Unlock (Fingerprint)"}
                    </Text>
                  </View>
                  <Text style={[styles.settingDesc, { color: themeColors.textSecondary }]}>
                    {isBM ? "Gunakan imbasan biometrik pantas untuk membuka aplikasi." : "Use fast fingerprint / face recognition to unlock."}
                  </Text>
                </View>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={handleToggleBiometrics}
                  trackColor={{ false: themeColors.borderColor, true: themeColors.maroonPrimary }}
                  thumbColor="#FFF"
                />
              </View>
            )}

            {/* Inactivity Timeout Selector (if app lock is on) */}
            {appLockEnabled && (
              <View style={[styles.timeoutSection, { borderTopColor: themeColors.borderColor }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <MaterialCommunityIcons name="timer-outline" size={18} color={themeColors.maroonPrimary} />
                  <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>
                    {isBM ? "Kunci Semula Automatik" : "Auto-Lock Timeout"}
                  </Text>
                </View>
                <View style={{ gap: 8 }}>
                  {timeoutOptions.map((opt) => {
                    const isSelected = appLockTimeout === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => handleSelectTimeout(opt.value)}
                        activeOpacity={0.7}
                        style={[
                          styles.timeoutOption,
                          {
                            backgroundColor: isSelected
                              ? `${themeColors.maroonPrimary}14`
                              : themeColors.surfaceContainer,
                            borderColor: isSelected
                              ? themeColors.maroonPrimary
                              : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: isSelected ? "700" : "500",
                            color: isSelected ? themeColors.maroonPrimary : themeColors.textPrimary,
                          }}
                        >
                          {opt.label}
                        </Text>
                        <MaterialCommunityIcons
                          name={isSelected ? "radiobox-marked" : "radiobox-blank"}
                          size={18}
                          color={isSelected ? themeColors.maroonPrimary : themeColors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Section 2: Screenshot Protection */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ marginBottom: SPACING.lg }}>
          <Text style={[styles.sectionHeading, { color: themeColors.maroonPrimary }]}>
            {isBM ? "Perlindungan Skrin" : "Screen Protection"}
          </Text>

          <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                toggleAllowScreenshots();
              }}
              style={styles.settingRow}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <MaterialCommunityIcons name="monitor-screenshot" size={20} color={themeColors.maroonPrimary} />
                  <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>
                    {isBM ? "Benarkan Tangkapan Skrin" : "Allow Screenshots"}
                  </Text>
                </View>
                <Text style={[styles.settingDesc, { color: themeColors.textSecondary }]}>
                  {isBM
                    ? "Apabila dimatikan, sistem Android akan menyekat sebarang tangkapan skrin atau rakaman video untuk melindungi dokumen geran & IC pelanggan."
                    : "When disabled, Android prevents taking screenshots or recording screens inside the app to protect client ICs, title deeds, and confidential files."}
                </Text>
              </View>
              <Switch
                value={allowScreenshots}
                onValueChange={() => {
                  Haptics.selectionAsync().catch(() => {});
                  toggleAllowScreenshots();
                }}
                trackColor={{ false: themeColors.borderColor, true: themeColors.maroonPrimary }}
                thumbColor="#FFF"
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Section 3: Data & Vault Privacy Note */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDark ? "#161F2E" : "#F1F5F9",
                borderColor: themeColors.borderColor,
              },
            ]}
          >
            <MaterialCommunityIcons name="shield-check" size={24} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoTitle, { color: themeColors.textPrimary }]}>
                {isBM ? "Peti Besi Dokumen Dilindungi" : "Encrypted Document Vault"}
              </Text>
              <Text style={[styles.infoDesc, { color: themeColors.textSecondary }]}>
                {isBM
                  ? "Semua dokumen sensitif (Salinan IC, Geran Tanah, SPA) disimpan secara selamat dalam peti besi digital peribadi anda dan tidak boleh diakses oleh orang awam."
                  : "All sensitive files (IC copies, land titles, SPA contracts) are stored in your secure private vault and never exposed publicly."}
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* PIN Setup / Verification Modal */}
      <Modal
        visible={isPinModalVisible}
        transparent
        animationType="fade"
        onShow={() => {
          setPinFocusTick(Date.now());
        }}
        onRequestClose={() => setIsPinModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? "#1A1A1A" : themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                paddingBottom: Math.max(insets.bottom, 24) + 16,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                {pinStep === "verify_for_disable"
                  ? isBM ? "Sahkan PIN Semasa" : "Verify Current PIN"
                  : pinStep === "verify_for_change"
                  ? isBM ? "Masukkan PIN Lama" : "Enter Current PIN"
                  : pinStep === "set_new"
                  ? isBM ? "Tetapkan PIN 4-Digit Baru" : "Set New 4-Digit PIN"
                  : isBM ? "Sahkan PIN 4-Digit Baru" : "Confirm New 4-Digit PIN"}
              </Text>
              <TouchableOpacity
                onPress={() => setIsPinModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="close" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <PinKeypad
              title=""
              subtitle={
                pinStep === "verify_for_disable"
                  ? isBM ? "Masukkan PIN untuk mematikan kunci" : "Enter PIN to disable app lock"
                  : pinStep === "verify_for_change"
                  ? isBM ? "Sahkan identiti anda sebelum menukar PIN" : "Verify your identity before changing PIN"
                  : pinStep === "set_new"
                  ? isBM ? "Pilih 4 digit yang mudah diingati" : "Choose a memorable 4-digit code"
                  : isBM ? "Masukkan semula 4 digit untuk pengesahan" : "Re-enter the 4 digits to confirm"
              }
              onPinComplete={handlePinCompleted}
              showBiometricOption={false}
              errorMessage={pinError}
              focusTick={pinFocusTick}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  settingDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionSubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: 1,
  },
  subRowText: {
    fontSize: 14,
    fontWeight: "600",
  },
  subRowWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: 1,
  },
  timeoutSection: {
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: 1,
  },
  timeoutOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoCard: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
});
