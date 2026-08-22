import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import NetInfo from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppSettings } from "@/context/AppSettingsContext";

export function OfflineBanner() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const insets = useSafeAreaInsets();
  const { themeColors, language } = useAppSettings();
  const isBM = language === "BM";

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isConnected can be null initially, treat it as true to avoid flashing
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  if (isConnected) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInUp.duration(400)}
      exiting={FadeOutUp.duration(400)}
      style={[
        styles.container,
        {
          top: Math.max(insets.top, Platform.OS === "android" ? 24 : 16) + 6,
          backgroundColor: themeColors.errorText || "#DC2626",
        },
      ]}
    >
      <View style={styles.content}>
        <MaterialCommunityIcons name="wifi-off" size={16} color="#FFFFFF" />
        <Text style={styles.text}>
          {isBM ? "Tiada sambungan internet" : "No internet connection"}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 9999,
    elevation: 10,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
