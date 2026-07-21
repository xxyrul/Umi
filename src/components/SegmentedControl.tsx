import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { COLORS, SPACING } from "@/constants/theme";

interface SegmentedControlProps {
  options: string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function SegmentedControl({
  options,
  selectedValue,
  onValueChange,
  disabled = false,
}: SegmentedControlProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: COLORS.surfaceContainerHigh,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        padding: 4,
      }}
    >
      {options.map((option) => {
        const isSelected = selectedValue === option;

        return (
          <TouchableOpacity
            key={option}
            onPress={() => !disabled && onValueChange(option)}
            style={{
              flex: 1,
              paddingVertical: SPACING.md,
              paddingHorizontal: SPACING.sm,
              backgroundColor: isSelected ? COLORS.primary : "transparent",
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
            }}
            disabled={disabled}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: isSelected ? COLORS.onPrimary : COLORS.onSurfaceVariant,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
