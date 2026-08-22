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
import { getCurrentUserProfile } from "@/services/auth";
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}
    >
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

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Email Identity Card */}
        <Animated.View
          entering={FadeInDown.delay(50).duration(200)}
          style={{
            backgroundColor: themeColors.cardBackground,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            padding: 16,
            marginBottom: SPACING.md,
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
              backgroundColor: "#3B82F6",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="email-check-outline" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {isBM ? "Emel Berdaftar" : "Registered Email"}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary, marginTop: 2 }}>
              {profile?.email || auth().currentUser?.email || "ejen@drtmasterlisting.com"}
            </Text>
          </View>
        </Animated.View>

        {/* Edit Form Group */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(200)}
          style={{
            backgroundColor: themeColors.cardBackground,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            padding: 16,
            marginBottom: SPACING.md,
            gap: 16,
          }}
        >
          {/* Display Name Input */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary }}>
              {isBM ? "Nama Paparan / Ejen" : "Display / Agent Name"}
            </Text>
            <TextInput
              style={{
                backgroundColor: themeColors.surfaceContainer,
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

          {/* WhatsApp Phone Number Input */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary }}>
              {isBM ? "Nombor Telefon WhatsApp" : "WhatsApp Phone Number"}
            </Text>
            <TextInput
              style={{
                backgroundColor: themeColors.surfaceContainer,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: themeColors.textPrimary,
              }}
              placeholder="0123456789"
              placeholderTextColor={themeColors.textMuted}
              value={phoneInput}
              onChangeText={setPhoneInput}
              keyboardType="phone-pad"
            />
            <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 2 }}>
              {isBM
                ? "Digunakan untuk butang 'WhatsApp Ejen' di paparan showcase web awam."
                : "Used for direct 'WhatsApp Agent' action on public listing showcase pages."}
            </Text>
          </View>
        </Animated.View>

        {/* Save CTA Button */}
        <Animated.View entering={FadeInDown.delay(150).duration(200)}>
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
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3,
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
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
