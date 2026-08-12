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
        padding: SPACING.md,
        flex: 1,
        minHeight: 110,
        justifyContent: "space-between",
      }}
    >
      {/* Top Row: Icon */}
      <View
        style={{
          width: 36,
          height: 36,
          backgroundColor: iconBackgroundColor,
          borderRadius: 8,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={20} color={iconColor} />
      </View>

      {/* Bottom Area: Value and Label */}
      <View style={{ marginTop: SPACING.sm }}>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "700",
            color: COLORS.onSurface,
            lineHeight: 34,
          }}
        >
          {value}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: COLORS.onSurfaceVariant,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            marginTop: SPACING.xs,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
