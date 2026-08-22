import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
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
  focusTick,
}: PinKeypadProps) {
  const { themeColors, isDark, language } = useAppSettings();
  const [pin, setPin] = useState("");
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const shakeX = useSharedValue(0);

  useEffect(() => {
    isBiometricSupported().then(setHasBiometrics);
  }, []);

  // Automatically focus system keyboard on mount and on focusTick trigger
  useEffect(() => {
    const focus = () => {
      inputRef.current?.focus();
    };
    focus();
    const t1 = setTimeout(focus, 50);
    const t2 = setTimeout(focus, 150);
    const t3 = setTimeout(focus, 300);
    const t4 = setTimeout(focus, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [focusTick]);

  // Clear PIN and refocus whenever step/title/subtitle changes
  useEffect(() => {
    setPin("");
    inputRef.current?.clear();
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
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
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [errorMessage]);

  const shakeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const handleTextChange = (text: string) => {
    const sanitized = text.replace(/[^0-9]/g, "").slice(0, 4);
    setPin(sanitized);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (sanitized.length === 4) {
      setTimeout(() => {
        onPinComplete(sanitized);
      }, 120);
    }
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
    <Pressable
      onPress={() => inputRef.current?.focus()}
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        paddingHorizontal: SPACING.md,
        width: "100%",
        position: "relative",
      }}
    >
      {/* Real-focus system keyboard input */}
      <TextInput
        ref={inputRef}
        value={pin}
        onChangeText={handleTextChange}
        keyboardType="number-pad"
        maxLength={4}
        autoFocus={true}
        showSoftInputOnFocus={true}
        secureTextEntry={false}
        cursorColor="transparent"
        selectionColor="transparent"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          opacity: 1,
          color: "transparent",
          backgroundColor: "transparent",
        }}
      />

      {/* Lock Shield Icon */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: themeColors.maroonLight,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 10,
          borderWidth: 1,
          borderColor: themeColors.maroonBorder,
        }}
      >
        <MaterialCommunityIcons
          name="shield-lock-outline"
          size={26}
          color={themeColors.maroonPrimary}
        />
      </View>

      {/* Title & Subtitle */}
      <Text
        style={{
          fontSize: 18,
          fontWeight: "800",
          color: themeColors.textPrimary,
          marginBottom: 2,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: themeColors.textMuted,
          marginBottom: 16,
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
            marginBottom: SPACING.lg,
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
                width: 58,
                height: 64,
                borderRadius: 16,
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
                    fontSize: 24,
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
                    height: 22,
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
            fontSize: 13,
            fontWeight: "600",
            color: "#EF4444",
            marginBottom: SPACING.md,
            textAlign: "center",
          }}
        >
          {errorMessage}
        </Text>
      ) : (
        <View style={{ height: 20, marginBottom: SPACING.md }} />
      )}

      {/* Biometrics Quick Action */}
      {showBiometricOption && hasBiometrics && (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleBiometricPress}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: themeColors.surfaceContainer,
            borderColor: themeColors.borderColor,
            borderWidth: 1,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 24,
            marginTop: 8,
          }}
        >
          <MaterialCommunityIcons
            name="fingerprint"
            size={22}
            color={themeColors.maroonPrimary}
          />
          <Text
            style={{
              color: themeColors.textPrimary,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {language === "BM" ? "Buka dengan Cap Jari" : "Unlock with Biometrics"}
          </Text>
        </TouchableOpacity>
      )}
    </Pressable>
  );
}
