import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { useAppSettings } from "@/context/AppSettingsContext";
import { SPACING } from "@/constants/theme";

export const CaseSkeleton = () => {
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
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: themeColors.cardBackground,
          borderColor: themeColors.borderColor,
        },
        animatedStyle,
      ]}
    >
      <View style={[styles.topBar, { backgroundColor: themeColors.maroonPrimary }]} />
      <View style={{ padding: SPACING.md, gap: 12 }}>
        {/* Header row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: placeholderColor },
            ]}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={[styles.textLine, { width: "70%", height: 16, backgroundColor: placeholderColor }]} />
            <View style={[styles.textLine, { width: "40%", height: 12, backgroundColor: placeholderColor }]} />
          </View>
          <View style={[styles.badge, { backgroundColor: placeholderColor }]} />
        </View>

        {/* Client & Vendor Row */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <View
            style={[
              styles.partyBox,
              { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor },
            ]}
          >
            <View style={[styles.textLine, { width: "50%", height: 10, backgroundColor: placeholderColor }]} />
            <View style={[styles.textLine, { width: "80%", height: 14, backgroundColor: placeholderColor, marginTop: 4 }]} />
          </View>
          <View
            style={[
              styles.partyBox,
              { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor },
            ]}
          >
            <View style={[styles.textLine, { width: "50%", height: 10, backgroundColor: placeholderColor }]} />
            <View style={[styles.textLine, { width: "80%", height: 14, backgroundColor: placeholderColor, marginTop: 4 }]} />
          </View>
        </View>

        {/* Progress Stepper Line */}
        <View style={[styles.stepperPlaceholder, { backgroundColor: placeholderColor }]} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  topBar: {
    height: 4,
    opacity: 0.5,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  textLine: {
    borderRadius: 4,
  },
  badge: {
    width: 80,
    height: 24,
    borderRadius: 12,
  },
  partyBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  stepperPlaceholder: {
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
});
