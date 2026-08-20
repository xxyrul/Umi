import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from "react-native-reanimated";
import { useAppSettings } from "@/context/AppSettingsContext";

const { width } = Dimensions.get("window");

export const ListingSkeleton = () => {
  const { themeColors } = useAppSettings();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const placeholderColor = themeColors.borderColor;

  return (
    <Animated.View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }, animatedStyle]}>
      <View style={[styles.imagePlaceholder, { backgroundColor: placeholderColor }]} />
      <View style={styles.content}>
        <View style={[styles.textLine, { width: "40%", height: 20, backgroundColor: placeholderColor }]} />
        <View style={[styles.textLine, { width: "80%", height: 16, backgroundColor: placeholderColor }]} />
        <View style={[styles.textLine, { width: "60%", height: 14, backgroundColor: placeholderColor, marginTop: 8 }]} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <View style={[styles.chip, { backgroundColor: placeholderColor }]} />
          <View style={[styles.chip, { backgroundColor: placeholderColor }]} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  imagePlaceholder: {
    width: "100%",
    height: 180,
  },
  content: {
    padding: 16,
    gap: 8,
  },
  textLine: {
    borderRadius: 4,
  },
  chip: {
    width: 60,
    height: 24,
    borderRadius: 12,
  },
});

