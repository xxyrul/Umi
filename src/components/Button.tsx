import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING } from "@/constants/theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "tertiary";
  size?: "sm" | "md" | "lg";
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const sizeConfig = {
    sm: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      fontSize: 14,
    },
    md: {
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      fontSize: 16,
    },
    lg: {
      paddingVertical: SPACING.lg,
      paddingHorizontal: SPACING.xl,
      fontSize: 16,
    },
  };

  const variantConfig = {
    primary: {
      backgroundColor: disabled ? COLORS.outlineVariant : COLORS.primary,
      textColor: disabled ? COLORS.onSurfaceVariant : COLORS.onPrimary,
      borderColor: "transparent",
      borderWidth: 0,
    },
    secondary: {
      backgroundColor: "transparent",
      textColor: COLORS.onSurfaceVariant,
      borderColor: COLORS.outlineVariant,
      borderWidth: 1,
    },
    tertiary: {
      backgroundColor: "transparent",
      textColor: COLORS.primary,
      borderColor: "transparent",
      borderWidth: 0,
    },
  };

  const sizes = sizeConfig[size];
  const colors = variantConfig[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: colors.borderWidth,
          borderRadius: 8,
          paddingVertical: sizes.paddingVertical,
          paddingHorizontal: sizes.paddingHorizontal,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACING.sm,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={colors.textColor}
          style={{ marginRight: SPACING.xs }}
        />
      )}
      {icon && !loading && (
        <MaterialCommunityIcons
          name={icon as any}
          size={20}
          color={colors.textColor}
        />
      )}
      <Text
        style={{
          fontSize: sizes.fontSize,
          fontWeight: "600",
          color: colors.textColor,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
