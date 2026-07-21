import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING } from "@/constants/theme";

interface MetricCardProps {
  label: string;
  value: number;
  icon: string;
  iconBackgroundColor: string;
  iconColor: string;
}

export function MetricCard({
  label,
  value,
  icon,
  iconBackgroundColor,
  iconColor,
}: MetricCardProps) {
  return (
    <View
      style={{
        backgroundColor: COLORS.surfaceContainerHigh,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        padding: SPACING.lg,
        flex: 1,
      }}
    >
      {/* Icon container - top right */}
      <View
        style={{
          position: "absolute",
          top: SPACING.lg,
          right: SPACING.lg,
          width: 48,
          height: 48,
          backgroundColor: iconBackgroundColor,
          borderRadius: 12,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={24} color={iconColor} />
      </View>

      {/* Content - left aligned */}
      <View style={{ paddingRight: 60 }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "500",
            color: COLORS.onSurfaceVariant,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: SPACING.md,
          }}
        >
          {label}
        </Text>

        <Text
          style={{
            fontSize: 32,
            fontWeight: "700",
            color: COLORS.onSurface,
            marginTop: SPACING.lg,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}
