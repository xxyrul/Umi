import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Constants from "expo-constants";
import { useAppSettings } from "@/context/AppSettingsContext";
import { FeedbackForm } from "@/components/FeedbackForm";
import { SPACING } from "@/constants/theme";

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const { themeColors, language } = useAppSettings();
  const isBM = language === "BM";

  const [isFeedbackFormVisible, setIsFeedbackFormVisible] = useState(false);

  const handleOpenWhatsApp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert(
      isBM ? "Saluran WhatsApp Bantuan" : "WhatsApp Support Channel",
      isBM
        ? "Saluran WhatsApp sokongan rasmi sedang dinaik taraf dan akan dilancarkan tidak lama lagi. Sila gunakan fungsi 'Lapor Masalah / Cadangan' buat masa ini."
        : "Official WhatsApp support channel is being upgraded and will launch soon. Please use 'Report Bug / Feedback' in the meantime."
    );
  };

  const renderActionRow = (
    icon: string,
    title: string,
    subtitle: string,
    onPress: () => void,
    badgeColor: string,
    badgeText?: string,
    isLast = false
  ) => {
    return (
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: themeColors.borderColor,
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

        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: themeColors.textPrimary }}>
              {title}
            </Text>
            {badgeText ? (
              <View
                style={{
                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: "rgba(245, 158, 11, 0.35)",
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#F59E0B" }}>
                  {badgeText}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
            {subtitle}
          </Text>
        </View>

        <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textMuted} />
      </TouchableOpacity>
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
          {isBM ? "Bantuan & Sokongan" : "Help & Support"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Support Channels Group */}
        <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>
          {isBM ? "Saluran Bantuan Agensi" : "Agency Support Channels"}
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
          {renderActionRow(
            "whatsapp",
            isBM ? "Hubungi Sokongan WhatsApp" : "Contact WhatsApp Support",
            isBM ? "Bantuan teknikal dan pertanyaan terus ejen" : "Direct agent technical help & inquiries",
            handleOpenWhatsApp,
            "#25D366",
            isBM ? "Akan Datang" : "Coming Soon",
            false
          )}

          {renderActionRow(
            "bug-outline",
            isBM ? "Lapor Masalah / Cadangan" : "Report Bug / Feedback",
            isBM ? "Hantar maklum balas & tangkapan skrin terus kepada pembangun" : "Submit bugs, ideas & feedback to developers",
            () => setIsFeedbackFormVisible(true),
            "#F59E0B",
            undefined,
            true
          )}
        </Animated.View>
      </ScrollView>

      {/* Feedback Modal Form */}
      <FeedbackForm
        visible={isFeedbackFormVisible}
        onClose={() => setIsFeedbackFormVisible(false)}
      />
    </View>
  );
}
