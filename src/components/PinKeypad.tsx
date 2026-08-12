import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
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
}

export function PinKeypad({
  title = "Enter Security PIN",
  subtitle = "Enter your 4-digit PIN to continue",
  onPinComplete,
  onBiometricSuccess,
  showBiometricOption = true,
  errorMessage = "",
}: PinKeypadProps) {
  const { themeColors } = useAppSettings();
  const [pin, setPin] = useState("");
  const [hasBiometrics, setHasBiometrics] = useState(false);

  useEffect(() => {
    isBiometricSupported().then(setHasBiometrics);
  }, []);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        setTimeout(() => {
          onPinComplete(nextPin);
          setPin("");
        }, 100);
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const handleBiometricPress = async () => {
    const success = await authenticateBiometric("Unlock Umi CaseFlow");
    if (success && onBiometricSuccess) {
      onBiometricSuccess();
    }
  };

  const renderDot = (index: number) => {
    const isFilled = index < pin.length;
    const dotColor = errorMessage
      ? "#EF4444"
      : isFilled
      ? themeColors.maroonPrimary
      : themeColors.borderColor;

    return (
      <View
        key={index}
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: dotColor,
          backgroundColor: isFilled ? dotColor : "transparent",
          marginHorizontal: 10,
        }}
      />
    );
  };

  const renderKey = (
    label: string,
    value: string,
    icon?: string,
    onPressOverride?: () => void
  ) => {
    return (
      <TouchableOpacity
        key={label}
        onPress={onPressOverride || (() => handleKeyPress(value))}
        activeOpacity={0.7}
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: themeColors.surfaceContainer,
          justifyContent: "center",
          alignItems: "center",
          margin: 10,
          borderWidth: 1,
          borderColor: themeColors.borderColor,
        }}
      >
        {icon ? (
          <MaterialCommunityIcons
            name={icon as any}
            size={28}
            color={themeColors.textPrimary}
          />
        ) : (
          <Text
            style={{
              fontSize: 24,
              fontWeight: "600",
              color: themeColors.textPrimary,
            }}
          >
            {label}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: SPACING.xl,
        paddingHorizontal: SPACING.lg,
        width: "100%",
      }}
    >
      {/* Lock Icon */}
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: themeColors.maroonLight,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: SPACING.md,
          borderWidth: 1,
          borderColor: themeColors.maroonBorder,
        }}
      >
        <MaterialCommunityIcons
          name="lock-outline"
          size={36}
          color={themeColors.maroonPrimary}
        />
      </View>

      {/* Title & Subtitle */}
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: themeColors.textPrimary,
          marginBottom: 6,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: themeColors.textMuted,
          marginBottom: SPACING.lg,
          textAlign: "center",
        }}
      >
        {subtitle}
      </Text>

      {/* PIN Dots */}
      <View style={{ flexDirection: "row", marginBottom: SPACING.md }}>
        {[0, 1, 2, 3].map(renderDot)}
      </View>

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
        <View style={{ height: SPACING.md + 13 + SPACING.md }} />
      )}

      {/* Number Keypad */}
      <View style={{ width: 280, alignItems: "center" }}>
        <View style={{ flexDirection: "row" }}>
          {renderKey("1", "1")}
          {renderKey("2", "2")}
          {renderKey("3", "3")}
        </View>
        <View style={{ flexDirection: "row" }}>
          {renderKey("4", "4")}
          {renderKey("5", "5")}
          {renderKey("6", "6")}
        </View>
        <View style={{ flexDirection: "row" }}>
          {renderKey("7", "7")}
          {renderKey("8", "8")}
          {renderKey("9", "9")}
        </View>
        <View style={{ flexDirection: "row" }}>
          {showBiometricOption && hasBiometrics ? (
            renderKey("biometric", "", "fingerprint", handleBiometricPress)
          ) : (
            <View style={{ width: 72, height: 72, margin: 10 }} />
          )}
          {renderKey("0", "0")}
          {renderKey("backspace", "", "backspace-outline", handleBackspace)}
        </View>
      </View>
    </View>
  );
}
