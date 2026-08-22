import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from "react-native";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "@/context/AppSettingsContext";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { ScrollAwareBarProvider, useScrollAwareBar } from "@/context/ScrollAwareBarContext";

const TABS = [
  { name: "index", labelEN: "Dashboard", labelBM: "Utama", icon: "view-dashboard" },
  { name: "cases", labelEN: "Cases", labelBM: "Kes", icon: "folder-home" },
  { name: "listings", labelEN: "Listings", labelBM: "Listing", icon: "view-list" },
  { name: "profile", labelEN: "Profile", labelBM: "Profil", icon: "account" },
];

function TabItemButton({
  tab,
  isFocused,
  onPress,
  tintColor,
  tabLabel,
}: any) {
  const iconScale = useSharedValue(1);

  useEffect(() => {
    if (isFocused) {
      iconScale.value = withSequence(
        withSpring(1.22, { damping: 10, stiffness: 220 }),
        withSpring(1.0, { damping: 12 })
      );
    }
  }, [isFocused]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      style={styles.tabItem}
    >
      <Animated.View style={animatedIconStyle}>
        <MaterialCommunityIcons
          name={tab.icon as any}
          size={20}
          color={tintColor}
        />
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          { color: tintColor, fontWeight: isFocused ? "700" : "600" },
        ]}
      >
        {tabLabel}
      </Text>
    </TouchableOpacity>
  );
}

function CustomFloatingTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { themeColors, isDark, language } = useAppSettings();
  const { barTranslateY } = useScrollAwareBar();

  const [barWidth, setBarWidth] = useState(0);
  const indicatorTranslateX = useSharedValue(0);

  const activeIndex = TABS.findIndex(
    (t) => t.name === state.routes[state.index]?.name
  );

  useEffect(() => {
    if (barWidth > 0 && activeIndex >= 0) {
      const tabWidth = (barWidth - 16) / TABS.length; // accounting for 8px padding each side
      indicatorTranslateX.value = withSpring(activeIndex * tabWidth + 8, {
        damping: 18,
        stiffness: 180,
        mass: 0.7,
      });
    }
  }, [activeIndex, barWidth]);

  // Clean UI-thread translateY without double-spring wrapping
  const animatedBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: barTranslateY.value }],
  }));

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorTranslateX.value }],
    width: barWidth > 0 ? (barWidth - 16) / TABS.length : 0,
  }));

  const currentRouteName = state.routes[state.index]?.name;
  const mainTabNames = TABS.map((t) => t.name);
  if (currentRouteName && !mainTabNames.includes(currentRouteName)) {
    return null;
  }

  const bottomInset = Math.max(insets.bottom, 12) + 12;

  const handleLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  return (
    <Animated.View
      style={[styles.floatingContainer, { bottom: bottomInset }, animatedBarStyle]}
    >
      <View
        onLayout={handleLayout}
        style={[
          styles.glassBar,
          {
            backgroundColor: isDark
              ? "rgba(26, 26, 28, 0.94)"
              : "rgba(255, 255, 255, 0.94)",
            borderColor: themeColors.borderColor,
          },
        ]}
      >
        {/* Animated Active Tab Pill Indicator */}
        {barWidth > 0 && (
          <Animated.View
            style={[
              styles.indicatorPill,
              {
                backgroundColor: isDark
                  ? "rgba(255, 178, 184, 0.20)"
                  : "rgba(122, 17, 40, 0.12)",
                borderWidth: 1,
                borderColor: isDark
                  ? "rgba(255, 178, 184, 0.35)"
                  : "rgba(122, 17, 40, 0.22)",
              },
              animatedIndicatorStyle,
            ]}
          />
        )}

        {TABS.map((tab) => {
          const routeIndex = state.routes.findIndex(
            (r: any) => r.name === tab.name
          );
          const isFocused = state.index === routeIndex;

          const onPress = () => {
            if (!isFocused && routeIndex !== -1) {
              navigation.navigate(tab.name);
            }
          };

          const activeColor = isDark ? "#FFB2B8" : themeColors.maroonPrimary;
          const inactiveColor = isDark ? "#71717A" : "#6B7280";
          const tintColor = isFocused ? activeColor : inactiveColor;
          const tabLabel = language === "BM" ? tab.labelBM : tab.labelEN;

          return (
            <TabItemButton
              key={tab.name}
              tab={tab}
              isFocused={isFocused}
              onPress={onPress}
              tintColor={tintColor}
              tabLabel={tabLabel}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { themeColors } = useAppSettings();

  return (
    <ScrollAwareBarProvider>
      <Tabs
        tabBar={(props) => <CustomFloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          freezeOnBlur: true,
          sceneStyle: {
            backgroundColor: themeColors.canvasBackground,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
        <Tabs.Screen name="cases" options={{ title: "Cases" }} />
        <Tabs.Screen name="listings" options={{ title: "Listings" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
        <Tabs.Screen name="calculator" options={{ href: null }} />
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
  indicatorPill: {
    position: "absolute",
    top: 6,
    bottom: 6,
    borderRadius: 21,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
});
