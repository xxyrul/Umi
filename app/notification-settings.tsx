import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAppSettings } from "@/context/AppSettingsContext";
import { getCurrentUserProfile } from "@/services/auth";
import {
  getUpdateNotificationsEnabled,
  getLastUpdateNotificationFailure,
  hasUpdateNotificationPermission,
  setUpdateNotificationsEnabled,
} from "@/services/updateNotifications";
import { SPACING } from "@/constants/theme";

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { themeColors, language } = useAppSettings();
  const isBM = language === "BM";

  const [pushEnabled, setPushEnabled] = useState(true);
  const [caseAlertsEnabled, setCaseAlertsEnabled] = useState(true);
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [updateAlertsEnabled, setUpdateAlertsEnabled] = useState(false);
  const [isSavingUpdateAlerts, setIsSavingUpdateAlerts] = useState(false);

  useEffect(() => {
    getUpdateNotificationsEnabled()
      .then(setUpdateAlertsEnabled)
      .catch(() => {});
  }, []);

  const handleToggleUpdateAlerts = async (value: boolean) => {
    const user = getCurrentUserProfile();
    if (!user) {
      Alert.alert(
        isBM ? "Ralat" : "Error",
        isBM
          ? "Sila log masuk untuk menguruskan makluman kemas kini."
          : "Please sign in to manage update alerts."
      );
      return;
    }

    Haptics.selectionAsync().catch(() => {});
    setIsSavingUpdateAlerts(true);
    try {
      const result = await setUpdateNotificationsEnabled({ uid: user.uid, language }, value);
      setUpdateAlertsEnabled(result);

      if (value && !result) {
        const permissionGranted = await hasUpdateNotificationPermission();
        if (!permissionGranted) {
          Alert.alert(
            isBM ? "Kebenaran Diperlukan" : "Permission Needed",
            isBM
              ? "Benarkan notifikasi dalam tetapan telefon untuk menerima makluman versi baharu."
              : "Allow notifications in your phone settings to receive new version alerts.",
            [
              {
                text: isBM ? "Buka Tetapan" : "Open Settings",
                onPress: () => {
                  void Linking.openSettings();
                },
              },
              {
                text: isBM ? "Batal" : "Cancel",
                style: "cancel",
              },
            ]
          );
        } else {
          const failure = getLastUpdateNotificationFailure();
          const failureMessage =
            failure === "token-unavailable"
              ? isBM
                ? "Android tidak dapat mencipta token FCM. Sila pastikan Google Play Services tersedia dan cuba lagi."
                : "Android could not create an FCM token. Make sure Google Play Services is available, then try again."
              : isBM
                ? "Pendaftaran peranti gagal. Sila cuba lagi."
                : "Device registration failed. Please try again.";
          Alert.alert(
            isBM ? "Makluman Tidak Diaktifkan" : "Alerts Not Enabled",
            failureMessage
          );
        }
      }
    } finally {
      setIsSavingUpdateAlerts(false);
    }
  };

  const renderToggleRow = (
    icon: string,
    title: string,
    subtitle: string,
    value: boolean,
    onValueChange: (val: boolean) => void,
    badgeColor: string,
    isLast = false,
    loading = false,
    badgeText?: string,
    disabled = false
  ) => {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: themeColors.borderColor,
          opacity: disabled ? 0.65 : 1,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: badgeColor,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 14,
          }}
        >
          <MaterialCommunityIcons name={icon as any} size={20} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1, paddingRight: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: themeColors.textPrimary }}>
              {title}
            </Text>
            {badgeText ? (
              <View
                style={{
                  backgroundColor: "rgba(255, 180, 180, 0.15)",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "700", color: themeColors.maroonPrimary }}>
                  {badgeText}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
            {subtitle}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
        ) : (
          <Switch
            value={value}
            disabled={disabled}
            onValueChange={(val) => {
              if (disabled) return;
              Haptics.selectionAsync().catch(() => {});
              onValueChange(val);
            }}
            trackColor={{
              false: themeColors.surfaceContainer,
              true: themeColors.maroonPrimary,
            }}
            thumbColor={disabled ? "#9CA3AF" : Platform.OS === "android" ? "#FFFFFF" : undefined}
          />
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.borderColor,
          backgroundColor: themeColors.cardBackground,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: themeColors.surfaceContainer,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "700", color: themeColors.textPrimary }}>
          {isBM ? "Tetapan Notifikasi" : "Notification Settings"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Push Alerts */}
        <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>
          {isBM ? "Makluman Tolak & Kes" : "Push & Case Alerts"}
        </Text>

        <Animated.View
          entering={FadeInDown.delay(50).duration(200)}
          style={{
            backgroundColor: themeColors.cardBackground,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            overflow: "hidden",
            marginBottom: SPACING.lg,
          }}
        >
          {renderToggleRow(
            "bell-ring-outline",
            isBM ? "Notifikasi Tolak" : "Push Notifications",
            isBM ? "Terima makluman terus pada peranti" : "Receive instant alerts on device",
            pushEnabled,
            setPushEnabled,
            "#EF4444"
          )}

          {renderToggleRow(
            "folder-sync-outline",
            isBM ? "Kemaskini Status Kes" : "Case Milestone Alerts",
            isBM ? "Makluman apabila status kes/peringkat berubah" : "Alerts when case progress changes",
            caseAlertsEnabled,
            setCaseAlertsEnabled,
            "#3B82F6"
          )}

          {renderToggleRow(
            "newspaper-variant-outline",
            isBM ? "Ringkasan Harian" : "Daily Digest Briefing",
            isBM ? "Ringkasan kes & temujanji setiap pagi" : "Morning summary of active cases & tasks",
            dailyDigestEnabled,
            setDailyDigestEnabled,
            "#F59E0B",
            true
          )}
        </Animated.View>

        {/* Section 2: App Release & Email */}
        <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>
          {isBM ? "Kemas Kini & Sistem" : "Updates & System"}
        </Text>

        <Animated.View
          entering={FadeInDown.delay(100).duration(200)}
          style={{
            backgroundColor: themeColors.cardBackground,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            overflow: "hidden",
          }}
        >
          {renderToggleRow(
            "cellphone-arrow-down",
            isBM ? "Makluman Versi Baharu" : "New Version Alerts",
            isBM ? "Peringatan automatik apabila APK baharu dikeluarkan" : "Automatic alerts when new APK is released",
            updateAlertsEnabled,
            handleToggleUpdateAlerts,
            "#10B981",
            false,
            isSavingUpdateAlerts
          )}

          {renderToggleRow(
            "email-outline",
            isBM ? "Ringkasan E-mel Mingguan" : "Weekly Email Digest",
            isBM ? "Laporan prestasi harta dihantar ke e-mel secara automatik." : "Automated property performance digest sent to email.",
            false,
            () => {},
            "#8B5CF6",
            true,
            false,
            isBM ? "AKAN DATANG" : "COMING SOON",
            true
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
