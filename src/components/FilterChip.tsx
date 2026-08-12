import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { SPACING } from "@/constants/theme";
import { useAppSettings } from "@/context/AppSettingsContext";

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

export function FilterChip({ label, isActive, onPress }: FilterChipProps) {
  const { themeColors } = useAppSettings();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: SPACING.xs,
        backgroundColor: isActive ? themeColors.maroonPrimary : themeColors.surfaceContainer,
        borderWidth: 1,
        borderColor: isActive ? themeColors.maroonPrimary : themeColors.borderColor,
      }}
    >
      <Text
        style={{
          color: isActive ? "#FFFFFF" : themeColors.textSecondary,
          fontSize: 12,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
