import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, useColorScheme } from "react-native";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppSettings } from "@/context/AppSettingsContext";
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
} from "react-native-reanimated";
import { ScrollAwareBarProvider, useScrollAwareBar } from "@/context/ScrollAwareBarContext";

const { width } = Dimensions.get("window");

const TABS = [
  { name: "index", label: "Dashboard", icon: "view-dashboard" },
  { name: "cases", label: "Cases", icon: "folder-home" },
  { name: "listings", label: "Listings", icon: "view-list" },
  { name: "profile", label: "Profile", icon: "account" },
];

function CustomFloatingTabBar({ state, descriptors, navigation }: any) {
  const { themeColors, isDark } = useAppSettings();
  const { barTranslateY } = useScrollAwareBar();

  // The bar container slides down (hides) when scrolling down, based on context
  const animatedBarStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: withSpring(barTranslateY.value, { damping: 20, stiffness: 150 }) }],
    };
  });

  const currentRouteName = state.routes[state.index]?.name;
  const mainTabNames = TABS.map(t => t.name);
  if (currentRouteName && !mainTabNames.includes(currentRouteName)) {
    return null;
  }

  return (
    <Animated.View style={[styles.floatingContainer, animatedBarStyle]}>
      <View 
        style={[
          styles.glassBar,
          { 
            backgroundColor: isDark ? "rgba(30, 30, 30, 0.92)" : "rgba(255, 255, 255, 0.92)",
            borderColor: themeColors.borderColor 
          }
        ]}
      >
        {TABS.map((tab, index) => {
          const routeIndex = state.routes.findIndex((r: any) => r.name === tab.name);
          const isFocused = state.index === routeIndex;

          const onPress = () => {
            if (!isFocused && routeIndex !== -1) {
              navigation.navigate(tab.name);
            }
          };

          const activeColor = isDark ? "#FFB2B8" : themeColors.maroonPrimary;
          const inactiveColor = isDark ? "#71717A" : "#6B7280";
          const tintColor = isFocused ? activeColor : inactiveColor;

          return (
            <TouchableOpacity key={tab.name} onPress={onPress} style={styles.tabItem}>
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={20}
                color={tintColor}
              />
              <Text 
                style={[
                  styles.tabLabel, 
                  { color: tintColor, fontWeight: isFocused ? "700" : "600" }
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <ScrollAwareBarProvider>
      <Tabs
        tabBar={(props) => <CustomFloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
        <Tabs.Screen name="cases" options={{ title: "Cases" }} />
        <Tabs.Screen name="listings" options={{ title: "Listings" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
        <Tabs.Screen name="tambah" options={{ href: null }} />
        <Tabs.Screen name="calculator" options={{ href: null }} />
        <Tabs.Screen name="updates" options={{ href: null }} />
        <Tabs.Screen name="tasks" options={{ href: null }} />
      </Tabs>
    </ScrollAwareBarProvider>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 24,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
  },
  glassBar: {
    flexDirection: "row",
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    // iOS Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    // Android Shadow
    elevation: 8,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
});
