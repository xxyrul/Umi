import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "@/context/AppSettingsContext";

// Explicitly define the 4 main tabs that belong in the bottom bar
const MAIN_TABS = ["index", "cases", "listings", "profile"] as const;

function CustomFloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useAppSettings();

  // Dynamic bottom offset adapting cleanly to Android gesture bars & iOS home indicators
  const bottomOffset = insets.bottom > 0 ? insets.bottom + 6 : 16;

  // Filter routes to ONLY include the 4 main navigation tabs
  const mainRoutes = state.routes.filter((route) =>
    (MAIN_TABS as readonly string[]).includes(route.name)
  );

  return (
    <View style={[styles.floatingContainer, { bottom: bottomOffset }]}>
      {mainRoutes.map((route) => {
        const index = state.routes.findIndex((r) => r.key === route.key);
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        // Determine icon & label based on route
        let iconName: keyof typeof MaterialCommunityIcons.glyphMap = "home-outline";
        let label = options.title !== undefined ? options.title : route.name;

        if (route.name === "index") {
          iconName = isFocused ? "home" : "home-outline";
          label = t("dashboard");
        } else if (route.name === "cases") {
          iconName = isFocused ? "briefcase" : "briefcase-outline";
          label = t("casesTab");
        } else if (route.name === "listings") {
          iconName = isFocused ? "home-city" : "home-city-outline";
          label = t("listingsTab");
        } else if (route.name === "profile") {
          iconName = isFocused ? "account" : "account-outline";
          label = t("profile");
        }

        const activeColor = "#FFB4B4";
        const inactiveColor = "#71717A";
        const tintColor = isFocused ? activeColor : inactiveColor;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
            style={styles.tabItem}
          >
            <MaterialCommunityIcons
              name={iconName}
              size={20}
              color={tintColor}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.tabLabel,
                { color: tintColor },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomFloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      {/* 1. Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
        }}
      />

      {/* 2. Cases */}
      <Tabs.Screen
        name="cases"
        options={{
          title: "Cases",
        }}
      />

      {/* 3. Listings */}
      <Tabs.Screen
        name="listings"
        options={{
          title: "Listings",
        }}
      />

      {/* 4. Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />

      {/* Hidden route: tambah (Add Listing Form) */}
      <Tabs.Screen
        name="tambah"
        options={{
          href: null,
        }}
      />

      {/* Hidden route: calculator */}
      <Tabs.Screen
        name="calculator"
        options={{
          href: null,
        }}
      />

      {/* Hidden route: tasks */}
      <Tabs.Screen
        name="tasks"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    left: 28,
    right: 28,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#1E1E1E",
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
});
