import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SPACING } from "@/constants/theme";
import { useAppSettings } from "@/context/AppSettingsContext";
import { isBiometricSupported, authenticateBiometric } from "@/services/security";

interface PinKeypadProps {
  title?: string;
  subtitle?: string;
  onPinComplete: (pin: string) => void | Promise<void>;
  onBiometricSuccess?: () => void;
  showBiometricOption?: boolean;
  errorMessage?: string;
  focusTick?: number;
}

export function PinKeypad({
  title = "Enter Security PIN",
  subtitle = "Enter your 4-digit PIN to continue",
  onPinComplete,
  onBiometricSuccess,
  showBiometricOption = false,
  errorMessage = "",
}: PinKeypadProps) {
  const { themeColors, isDark, language } = useAppSettings();
  const [pin, setPin] = useState("");
  const [hasBiometrics, setHasBiometrics] = useState(false);

  const shakeX = useSharedValue(0);

  useEffect(() => {
    isBiometricSupported().then(setHasBiometrics);
  }, []);

  // Clear PIN whenever title/subtitle/step changes
  useEffect(() => {
    setPin("");
  }, [title, subtitle]);

  useEffect(() => {
    if (errorMessage) {
      shakeX.value = withSequence(
        withTiming(-12, { duration: 50 }),
        withTiming(12, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPin("");
    }
  }, [errorMessage]);

  const shakeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const handleDigitPress = (digit: string) => {
    if (pin.length >= 4) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      setTimeout(() => {
        onPinComplete(nextPin);
      }, 100);
    }
  };

  const handleDeletePress = () => {
    if (pin.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPin((prev) => prev.slice(0, -1));
  };

  const handleBiometricPress = async () => {
    Haptics.selectionAsync().catch(() => {});
    const success = await authenticateBiometric(
      language === "BM" ? "Buka artha" : "Unlock artha"
    );
    if (success && onBiometricSuccess) {
      onBiometricSuccess();
    }
  };

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        paddingHorizontal: SPACING.md,
        width: "100%",
      }}
    >
      {/* Lock Shield Icon */}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: themeColors.maroonLight,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 8,
          borderWidth: 1,
          borderColor: themeColors.maroonBorder,
        }}
      >
        <MaterialCommunityIcons
          name="shield-lock-outline"
          size={24}
          color={themeColors.maroonPrimary}
        />
      </View>

      {/* Title & Subtitle */}
      {Boolean(title) && (
        <Text
          style={{
            fontSize: 17,
            fontWeight: "800",
            color: themeColors.textPrimary,
            marginBottom: 2,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
      )}
      <Text
        style={{
          fontSize: 13,
          color: themeColors.textMuted,
          marginBottom: 14,
          textAlign: "center",
        }}
      >
        {subtitle}
      </Text>

      {/* 4-Box PIN Display with Shake Animation */}
      <Animated.View
        style={[
          {
            flexDirection: "row",
            justifyContent: "center",
            gap: 14,
            marginBottom: 12,
          },
          shakeAnimatedStyle,
        ]}
      >
        {[0, 1, 2, 3].map((index) => {
          const isFilled = index < pin.length;
          const isCurrent = index === pin.length;
          const hasError = Boolean(errorMessage);

          let borderColor = themeColors.borderColor;
          if (hasError) {
            borderColor = "#EF4444";
          } else if (isCurrent) {
            borderColor = themeColors.maroonPrimary;
          } else if (isFilled) {
            borderColor = themeColors.maroonPrimary;
          }

          return (
            <View
              key={index}
              style={{
                width: 52,
                height: 56,
                borderRadius: 14,
                borderWidth: isCurrent ? 2 : 1.5,
                borderColor,
                backgroundColor: isFilled
                  ? (isDark ? "rgba(255, 178, 184, 0.12)" : "rgba(122, 17, 40, 0.08)")
                  : themeColors.surfaceContainer,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {isFilled ? (
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: themeColors.maroonPrimary,
                  }}
                >
                  ●
                </Text>
              ) : isCurrent ? (
                <View
                  style={{
                    width: 2,
                    height: 18,
                    backgroundColor: themeColors.maroonPrimary,
                    borderRadius: 1,
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </Animated.View>

      {/* Error Message */}
      {errorMessage ? (
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: "#EF4444",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          {errorMessage}
        </Text>
      ) : (
        <View style={{ height: 8, marginBottom: 8 }} />
      )}

      {/* On-Screen Numeric Keypad */}
      <View style={{ width: "100%", maxWidth: 280, gap: 10 }}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
          ["bio", "0", "del"],
        ].map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {row.map((item, colIdx) => {
              if (item === "bio") {
                if (showBiometricOption && hasBiometrics) {
                  return (
                    <TouchableOpacity
                      key={colIdx}
                      activeOpacity={0.7}
                      onPress={handleBiometricPress}
                      style={{
                        width: 68,
                        height: 54,
                        borderRadius: 27,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <MaterialCommunityIcons name="fingerprint" size={28} color={themeColors.maroonPrimary} />
                    </TouchableOpacity>
                  );
                }
                return <View key={colIdx} style={{ width: 68, height: 54 }} />;
              }

              if (item === "del") {
                return (
                  <TouchableOpacity
                    key={colIdx}
                    activeOpacity={0.7}
                    onPress={handleDeletePress}
                    style={{
                      width: 68,
                      height: 54,
                      borderRadius: 27,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <MaterialCommunityIcons name="backspace-outline" size={24} color={themeColors.textPrimary} />
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={colIdx}
                  activeOpacity={0.65}
                  onPress={() => handleDigitPress(item)}
                  style={{
                    width: 68,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : themeColors.borderColor,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: "700", color: themeColors.textPrimary }}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
