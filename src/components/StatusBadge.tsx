import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { STATUS_CONFIG } from "@/constants/theme";
import type { CaseStatus } from "@/types/case";

interface StatusBadgeProps {
  status: CaseStatus;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  if (!config) {
    return null;
  }

  const sizeConfig = {
    sm: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      fontSize: 12,
      iconSize: 14,
    },
    md: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      fontSize: 13,
      iconSize: 16,
    },
    lg: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      fontSize: 14,
      iconSize: 18,
    },
  };

  const sizes = sizeConfig[size];

  return (
    <View
      style={{
        backgroundColor: config.backgroundColor,
        borderRadius: 12,
        paddingVertical: sizes.paddingVertical,
        paddingHorizontal: sizes.paddingHorizontal,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      }}
    >
      <MaterialCommunityIcons
        name={config.icon as any}
        size={sizes.iconSize}
        color={config.textColor}
      />
      <Text
        style={{
          color: config.textColor,
          fontSize: sizes.fontSize,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {status}
      </Text>
    </View>
  );
}
