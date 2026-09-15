import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { useAppSettings } from "@/context/AppSettingsContext";
import { getCurrentUserProfile, signOut, isUserRegistrationComplete } from "@/services/auth";
import { firebaseDB } from "@/services/firebase";
import { SPACING } from "@/constants/theme";

export default function PendingApprovalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { themeColors, isDark, language } = useAppSettings();

  const [isChecking, setIsChecking] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isRejectedState, setIsRejectedState] = useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState("");

  const profile = getCurrentUserProfile();

  useEffect(() => {
    if (profile?.uid) {
      isUserRegistrationComplete(profile.uid)
        .then((res) => {
          if (res.isRejected) {
            setIsRejectedState(true);
            setRejectionReasonText(res.rejectionReason || "");
          } else if (res.isRegistered && !res.isPending && !res.isSuspended) {
            router.replace("/(tabs)");
          }
        })
        .catch(() => {});
    }
  }, [profile?.uid]);

  const handleCheckStatus = async () => {
    if (!profile?.uid) {
      router.replace("/login");
      return;
    }

    try {
      setIsChecking(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const { isRegistered, isSuspended, isPending, isRejected, rejectionReason } =
        await isUserRegistrationComplete(profile.uid);

      if (isSuspended) {
        await signOut();
        Alert.alert(
          language === "BM" ? "Akaun Digantung" : "Account Suspended",
          language === "BM"
            ? "Akaun ejen anda telah digantung oleh pentadbir agensi."
            : "Your agent account has been suspended by the agency administrator."
        );
        router.replace("/login");
        return;
      }

      if (isRejected) {
        setIsRejectedState(true);
        setRejectionReasonText(rejectionReason || "");
        Alert.alert(
          language === "BM" ? "Permohonan Ditolak" : "Application Rejected",
          language === "BM"
            ? (rejectionReason || "Permohonan pendaftaran anda telah ditolak oleh pentadbir. Anda boleh menghantar permohonan semula.")
            : (rejectionReason || "Your registration application was rejected by the administrator. You may submit a re-application.")
        );
        return;
      }

      setIsRejectedState(false);

      if (isRegistered && !isPending) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(
          language === "BM" ? "Akaun Disahkan! 🎉" : "Account Approved! 🎉",
          language === "BM"
            ? "Tahniah! Pentadbir telah mengesahkan akaun anda. Selamat datang ke Artha."
            : "Congratulations! The administrator has verified your account. Welcome to Artha.",
          [
            {
              text: language === "BM" ? "Teruskan" : "Continue",
              onPress: () => router.replace("/(tabs)"),
            },
          ]
        );
      } else {
        Alert.alert(
          language === "BM" ? "Masih Dalam Semakan" : "Still Pending Verification",
          language === "BM"
            ? "Akaun anda masih dalam proses pengesahan oleh pentadbir agensi."
            : "Your account is still awaiting administrator approval."
        );
      }
    } catch (e: any) {
      Alert.alert(
        language === "BM" ? "Ralat Semakan" : "Verification Error",
        language === "BM" ? "Gagal menyemak status akaun. Sila cuba lagi." : "Failed to check account status. Please try again."
      );
    } finally {
      setIsChecking(false);
    }
  };

  const handleReapply = async () => {
    if (!profile?.uid) return;
    try {
      setIsChecking(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const now = new Date().toISOString();
      await firebaseDB.collection("users").doc(profile.uid).set(
        {
          status: "PENDING_APPROVAL",
          approved: false,
          registeredWithCode: "DIRECT_REQUEST",
          rejectionReason: null,
          updatedAt: now,
          createdAt: now,
        },
        { merge: true }
      );
      setIsRejectedState(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        language === "BM" ? "Permohonan Dihantar Semula! 🚀" : "Application Re-submitted! 🚀",
        language === "BM"
          ? "Permohonan pendaftaran anda telah dihantar semula kepada pentadbir agensi untuk semakan."
          : "Your application has been re-submitted to the administrator for review."
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to submit re-application.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      language === "BM" ? "Log Keluar" : "Sign Out",
      language === "BM" ? "Adakah anda pasti untuk log keluar?" : "Are you sure you want to sign out?",
      [
        { text: language === "BM" ? "Batal" : "Cancel", style: "cancel" },
        {
          text: language === "BM" ? "Log Keluar" : "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              setIsSigningOut(true);
              await signOut();
              router.replace("/login");
            } catch (err) {
              Alert.alert("Error", "Could not sign out.");
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={themeColors.canvasBackground}
      />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingVertical: Math.max(insets.bottom, 24) + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={{
            width: "100%",
            maxWidth: 420,
            alignItems: "center",
          }}
        >
          {/* Animated Hourglass / Shield Icon Badge */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              borderWidth: 1.5,
              borderColor: "rgba(245, 158, 11, 0.35)",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 20,
              shadowColor: "#F59E0B",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <MaterialCommunityIcons name="shield-account-outline" size={42} color="#F59E0B" />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: themeColors.textPrimary,
              textAlign: "center",
              letterSpacing: -0.4,
              marginBottom: 8,
            }}
          >
            {language === "BM" ? "Akaun Sedang Disahkan" : "Account Pending Approval"}
          </Text>

          {/* Subtitle */}
          <Text
            style={{
              fontSize: 14,
              color: themeColors.textMuted,
              textAlign: "center",
              lineHeight: 22,
              marginBottom: 24,
              paddingHorizontal: 8,
            }}
          >
            {language === "BM"
              ? "Pendaftaran anda telah diterima. Pentadbir agensi sedang menyemak butiran akaun anda sebelum memberikan akses penuh ke sistem CRM Artha."
              : "Your registration was received. The agency administrator is reviewing your account details before granting full CRM access."}
          </Text>

          {/* User Preview Card */}
          <View
            style={{
              width: "100%",
              backgroundColor: themeColors.cardBackground,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: themeColors.borderColor,
              padding: 16,
              marginBottom: 24,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: themeColors.maroonLight,
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: themeColors.maroonPrimary,
                }}
              >
                <MaterialCommunityIcons name="account" size={24} color={themeColors.maroonPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                  {profile?.displayName || "Ejen Baru"}
                </Text>
                <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 1 }}>
                  {profile?.email || ""}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: themeColors.surfaceContainer,
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 10,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textMuted }}>
                {language === "BM" ? "Status Semakan:" : "Review Status:"}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: isRejectedState ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: isRejectedState ? "#EF4444" : "#F59E0B",
                  }}
                />
                <Text style={{ fontSize: 11.5, fontWeight: "700", color: isRejectedState ? "#EF4444" : "#F59E0B" }}>
                  {isRejectedState
                    ? (language === "BM" ? "Permohonan Ditolak" : "Application Rejected")
                    : (language === "BM" ? "Menunggu Kelulusan" : "Pending Approval")}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ width: "100%", gap: 12 }}>
            {isRejectedState ? (
              /* Re-Apply Button */
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleReapply}
                disabled={isChecking}
                style={{
                  width: "100%",
                  backgroundColor: themeColors.maroonPrimary,
                  paddingVertical: 14,
                  borderRadius: 14,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 10,
                  shadowColor: themeColors.maroonPrimary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {isChecking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>
                      {language === "BM" ? "Hantar Permohonan Semula" : "Re-Submit Application"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              /* Recheck Status Button */
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleCheckStatus}
                disabled={isChecking}
                style={{
                  width: "100%",
                  backgroundColor: themeColors.maroonPrimary,
                  paddingVertical: 14,
                  borderRadius: 14,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 10,
                  shadowColor: themeColors.maroonPrimary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {isChecking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>
                      {language === "BM" ? "Semak Semula Status" : "Refresh Status"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Sign Out Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleSignOut}
              disabled={isSigningOut}
              style={{
                width: "100%",
                paddingVertical: 12,
                borderRadius: 14,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              <MaterialCommunityIcons name="logout" size={18} color={themeColors.textMuted} />
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: themeColors.textMuted }}>
                {language === "BM" ? "Log Keluar Akaun" : "Sign Out"}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
