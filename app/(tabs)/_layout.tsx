import React from "react";
import { View, Text } from "react-native";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: COLORS.outlineVariant,
          height: 80 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: SPACING.sm,
        },
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACING.sm,
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
                backgroundColor: focused ? COLORS.primary : "transparent",
                borderRadius: 20,
                minWidth: focused ? 100 : 56,
              }}
            >
              <MaterialCommunityIcons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={focused ? COLORS.onPrimary : color}
              />
              {focused && (
                <Text
                  style={{
                    color: COLORS.onPrimary,
                    fontWeight: "600",
                    fontSize: 12,
                    textTransform: "uppercase",
                  }}
                >
                  Home
                </Text>
              )}
            </View>
          ),
        }}
      />

      {/* Cases Tab */}
      <Tabs.Screen
        name="cases"
        options={{
          title: "Cases",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACING.sm,
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
                backgroundColor: focused ? COLORS.primary : "transparent",
                borderRadius: 20,
                minWidth: focused ? 110 : 56,
              }}
            >
              <MaterialCommunityIcons
                name={focused ? "folder-multiple" : "folder-multiple-outline"}
                size={24}
                color={focused ? COLORS.onPrimary : color}
              />
              {focused && (
                <Text
                  style={{
                    color: COLORS.onPrimary,
                    fontWeight: "600",
                    fontSize: 12,
                    textTransform: "uppercase",
                  }}
                >
                  Cases
                </Text>
              )}
            </View>
          ),
        }}
      />

      {/* Tasks Tab (placeholder) */}
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACING.sm,
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
                backgroundColor: focused ? COLORS.primary : "transparent",
                borderRadius: 20,
                minWidth: focused ? 100 : 56,
              }}
            >
              <MaterialCommunityIcons
                name={focused ? "checkbox-marked-outline" : "checkbox-blank-outline"}
                size={24}
                color={focused ? COLORS.onPrimary : color}
              />
              {focused && (
                <Text
                  style={{
                    color: COLORS.onPrimary,
                    fontWeight: "600",
                    fontSize: 12,
                    textTransform: "uppercase",
                  }}
                >
                  Tasks
                </Text>
              )}
            </View>
          ),
        }}
      />

      {/* Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: SPACING.sm,
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
                backgroundColor: focused ? COLORS.primary : "transparent",
                borderRadius: 20,
                minWidth: focused ? 110 : 56,
              }}
            >
              <MaterialCommunityIcons
                name={focused ? "account" : "account-outline"}
                size={24}
                color={focused ? COLORS.onPrimary : color}
              />
              {focused && (
                <Text
                  style={{
                    color: COLORS.onPrimary,
                    fontWeight: "600",
                    fontSize: 12,
                    textTransform: "uppercase",
                  }}
                >
                  Profile
                </Text>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
