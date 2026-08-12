import React from "react";
import { View, Text, Platform, StatusBar, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppSettings } from "@/context/AppSettingsContext";
import { addEventToNativeCalendar } from "@/services/calendar";

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { themeColors, t } = useAppSettings();

  const handleCreateTaskReminder = async () => {
    await addEventToNativeCalendar({
      title: "Follow-up Client & Semak Status Loan",
      startDate: new Date(Date.now() + 3600 * 1000 * 24), // Tomorrow
      endDate: new Date(Date.now() + 3600 * 1000 * 25),
      location: "Pejabat DRT Master Listing",
      notes: "Follow up status permohonan pinjaman bank pembeli.",
    });
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: themeColors.canvasBackground,
        paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 8 : insets.top,
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        {/* Glow check icon container */}
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: themeColors.maroonLight,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 20,
            borderWidth: 1,
            borderColor: themeColors.maroonBorder,
          }}
        >
          <MaterialCommunityIcons
            name="calendar-clock"
            size={48}
            color={themeColors.maroonPrimary}
          />
        </View>

        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: themeColors.textPrimary,
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          {t("tasksTitle")}
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: themeColors.textMuted,
            textAlign: "center",
            lineHeight: 22,
            marginBottom: 24,
            maxWidth: 320,
          }}
        >
          {t("tasksSubtitle")}
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleCreateTaskReminder}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: themeColors.maroonPrimary,
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderRadius: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <MaterialCommunityIcons name="calendar-plus" size={22} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
            {t("addReminderBtn")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
