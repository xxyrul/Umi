import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppSettings } from "@/context/AppSettingsContext";
import { Image as ExpoImage } from "expo-image";
import { getCurrentUserProfile, getUserInitials } from "@/services/auth";
import { firestore, auth } from "@/services/firebase";
import { SPACING } from "@/constants/theme";
import type { UserProfile } from "@/types/case";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { themeColors, language } = useAppSettings();
  const isBM = language === "BM";

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const user = getCurrentUserProfile();
    setProfile(user);
    if (user?.displayName) {
      setDisplayNameInput(user.displayName);
    }
    AsyncStorage.getItem("@artha_agent_phone").then((savedPhone) => {
      if (savedPhone) {
        setPhoneInput(savedPhone);
      } else if (user?.phoneNumber) {
        setPhoneInput(user.phoneNumber);
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!displayNameInput.trim()) {
      Alert.alert(
        isBM ? "Nama Diperlukan" : "Name Required",
        isBM ? "Sila masukkan nama ejen yang sah." : "Please enter a valid agent name."
      );
      return;
    }

    try {
      setIsSaving(true);
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        isBM ? "Profil Dikemaskini" : "Profile Updated",
        isBM
          ? "Maklumat nama dan nombor WhatsApp anda berjaya disimpan."
          : "Your name and WhatsApp number have been saved successfully.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert(
        isBM ? "Ralat" : "Error",
        isBM ? "Gagal mengemas kini maklumat profil." : "Failed to update profile information."
      );
    } finally {
      setIsSaving(false);
    }
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
          {isBM ? "Tetapan Akaun" : "Account Settings"}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Math.max(insets.bottom, 24) + 100, // Leave room for anchored button
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Agent Avatar Header */}
          <Animated.View
            entering={FadeInDown.delay(50).duration(200)}
            style={{
              alignItems: "center",
              marginBottom: SPACING.xl,
            }}
          >
            {profile?.photoURL || auth().currentUser?.photoURL ? (
              <ExpoImage
                source={{ uri: profile?.photoURL || auth().currentUser?.photoURL || "" }}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  marginBottom: 12,
                  borderWidth: 2.5,
                  borderColor: themeColors.maroonPrimary,
                }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
              <View
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  backgroundColor: themeColors.surfaceContainer,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                  borderWidth: 2,
                  borderColor: themeColors.borderColor,
                }}
              >
                {displayNameInput.trim() ? (
                  <Text style={{ fontSize: 26, fontWeight: "800", color: themeColors.maroonPrimary }}>
                    {getUserInitials(displayNameInput)}
                  </Text>
                ) : (
                  <MaterialCommunityIcons name="account" size={40} color={themeColors.textMuted} />
                )}
              </View>
            )}
            <View
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <MaterialCommunityIcons name="check-decagram" size={14} color="#10B981" />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#10B981" }}>
                {isBM ? "Ejen Disahkan" : "Verified Agent"}
              </Text>
            </View>
          </Animated.View>

          {/* Group 1: Profile & Credentials */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>
            {isBM ? "Profil & Kredensial" : "Profile & Credentials"}
          </Text>
          <Animated.View
            entering={FadeInDown.delay(100).duration(200)}
            style={{
              backgroundColor: themeColors.cardBackground,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: themeColors.borderColor,
              padding: 16,
              marginBottom: SPACING.lg,
              gap: 16,
            }}
          >
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: themeColors.textSecondary }}>
                {isBM ? "Nama Paparan" : "Display Name"}
              </Text>
              <TextInput
                style={{
                  backgroundColor: themeColors.canvasBackground,
                  borderColor: themeColors.borderColor,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: themeColors.textPrimary,
                }}
                placeholder={isBM ? "Cth. Ahmad Rizal" : "e.g. Ahmad Rizal"}
                placeholderTextColor={themeColors.textMuted}
                value={displayNameInput}
                onChangeText={setDisplayNameInput}
                autoCapitalize="words"
              />
            </View>
          </Animated.View>

          {/* Group 2: WhatsApp Contact */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>
            {isBM ? "Kenalan WhatsApp" : "WhatsApp Contact"}
          </Text>
          <Animated.View
            entering={FadeInDown.delay(150).duration(200)}
            style={{
              backgroundColor: themeColors.cardBackground,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: themeColors.borderColor,
              padding: 16,
              marginBottom: SPACING.lg,
              gap: 16,
            }}
          >
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: themeColors.textSecondary }}>
                {isBM ? "Nombor Telefon" : "Phone Number"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    backgroundColor: themeColors.canvasBackground,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: themeColors.textPrimary }}>
                    +60
                  </Text>
                </View>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: themeColors.canvasBackground,
                    borderColor: themeColors.borderColor,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 15,
                    color: themeColors.textPrimary,
                  }}
                  placeholder="123456789"
                  placeholderTextColor={themeColors.textMuted}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  keyboardType="phone-pad"
                />
              </View>
              <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 2 }}>
                {isBM
                  ? "Digunakan untuk butang 'WhatsApp Ejen' awam."
                  : "Used for public 'WhatsApp Agent' button."}
              </Text>
            </View>
          </Animated.View>

          {/* Group 3: Account Security */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>
            {isBM ? "Keselamatan Akaun" : "Account Security"}
          </Text>
          <Animated.View
            entering={FadeInDown.delay(200).duration(200)}
            style={{
              backgroundColor: themeColors.cardBackground,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: themeColors.borderColor,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: themeColors.surfaceContainer,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="email-check-outline" size={24} color={themeColors.textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textMuted }}>
                {isBM ? "Emel Berdaftar" : "Registered Email"}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary, marginTop: 2 }}>
                {profile?.email || auth().currentUser?.email || "ejen@drtmasterlisting.com"}
              </Text>
            </View>
            <MaterialCommunityIcons name="lock-outline" size={18} color={themeColors.textMuted} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Anchored Bottom Save Button */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: themeColors.cardBackground,
          borderTopWidth: 1,
          borderTopColor: themeColors.borderColor,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 24) + 16,
        }}
      >
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
          style={{
            backgroundColor: themeColors.maroonPrimary,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save-outline" size={20} color="#FFFFFF" />
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>
                {isBM ? "Simpan Perubahan" : "Save Changes"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
