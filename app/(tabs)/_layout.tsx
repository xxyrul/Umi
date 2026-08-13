import React from "react";
import { View, Text, Platform } from "react-native";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "@/context/AppSettingsContext";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { themeColors, t } = useAppSettings();

  const TAB_BAR_HEIGHT = 62 + Math.max(insets.bottom, 4);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: themeColors.maroonPrimary,
        tabBarInactiveTintColor: themeColors.textMuted,
        tabBarStyle: {
          backgroundColor: themeColors.cardBackground,
          borderTopWidth: 1,
          borderTopColor: themeColors.borderColor,
          height: TAB_BAR_HEIGHT,
          paddingBottom: Math.max(insets.bottom, 4),
          paddingTop: 6,
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: t("dashboard"),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center", justifyContent: "center", width: 68, gap: 2 }}>
              <MaterialCommunityIcons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={focused ? themeColors.maroonPrimary : color}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: focused ? themeColors.maroonPrimary : color,
                  fontSize: 10,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                {t("dashboard")}
              </Text>
            </View>
          ),
        }}
      />

      {/* Cases Tab */}
      <Tabs.Screen
        name="cases"
        options={{
          title: t("casesTab"),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center", justifyContent: "center", width: 60, gap: 2 }}>
              <MaterialCommunityIcons
                name={focused ? "briefcase" : "briefcase-outline"}
                size={24}
                color={focused ? themeColors.maroonPrimary : color}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: focused ? themeColors.maroonPrimary : color,
                  fontSize: 10,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                {t("casesTab")}
              </Text>
            </View>
          ),
        }}
      />

      {/* Master Listing Tab */}
      <Tabs.Screen
        name="listings"
        options={{
          title: t("listingsTab"),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center", justifyContent: "center", width: 60, gap: 2 }}>
              <MaterialCommunityIcons
                name={focused ? "home-city" : "home-city-outline"}
                size={24}
                color={focused ? themeColors.maroonPrimary : color}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: focused ? themeColors.maroonPrimary : color,
                  fontSize: 10,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                {t("listingsTab")}
              </Text>
            </View>
          ),
        }}
      />

      {/* Hidden route: add-listing form used by floating action button */}
      <Tabs.Screen
        name="tambah"
        options={{
          href: null,
        }}
      />

      {/* Calculator Screen — Hidden from bottom tab bar, accessed via Dashboard header */}
      <Tabs.Screen
        name="calculator"
        options={{
          href: null,
        }}
      />

      {/* Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile"),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center", justifyContent: "center", width: 60, gap: 2 }}>
              <MaterialCommunityIcons
                name={focused ? "account" : "account-outline"}
                size={24}
                color={focused ? themeColors.maroonPrimary : color}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: focused ? themeColors.maroonPrimary : color,
                  fontSize: 10,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                {t("profile")}
              </Text>
            </View>
          ),
        }}
      />

      {/* Tasks Tab — Hidden (still accessible via navigation) */}
      <Tabs.Screen
        name="tasks"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
