import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { COLORS, SPACING } from "@/constants/theme";

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

export function FilterChip({ label, isActive, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: 20,
        marginRight: SPACING.sm,
        backgroundColor: isActive ? COLORS.primary : "transparent",
        borderWidth: 1,
        borderColor: isActive ? COLORS.primary : COLORS.outlineVariant,
      }}
    >
      <Text
        style={{
          color: isActive ? COLORS.onPrimary : COLORS.onSurfaceVariant,
          fontSize: 14,
          fontWeight: "500",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
