import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING } from "@/constants/theme";
import { StatusBadge } from "./StatusBadge";
import type { PropertyCase } from "@/types/case";

interface CaseCardProps {
  case: PropertyCase;
  onPress?: () => void;
  onDelete?: (caseId: string) => void;
}

export function CaseCard({ case: caseItem, onPress, onDelete }: CaseCardProps) {
  const handleLongPress = () => {
    if (!onDelete) return;

    Alert.alert("Delete Case", `Delete "${caseItem.namaCase}"?`, [
      { text: "Cancel", onPress: () => {}, style: "cancel" },
      {
        text: "Delete",
        onPress: () => onDelete(caseItem.id),
        style: "destructive",
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.surfaceContainer,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        marginBottom: SPACING.md,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          gap: SPACING.md,
        }}
      >
        {/* Property Icon */}
        <View
          style={{
            width: 56,
            height: 56,
            backgroundColor: COLORS.surfaceContainerHigh,
            borderRadius: 12,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <MaterialCommunityIcons
            name="home-modern"
            size={28}
            color={COLORS.primary}
          />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Property Name */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: COLORS.onSurface,
              marginBottom: SPACING.xs,
            }}
            numberOfLines={1}
          >
            {caseItem.namaCase}
          </Text>

          {/* Client subtitle */}
          <Text
            style={{
              fontSize: 13,
              color: COLORS.onSurfaceVariant,
              marginBottom: SPACING.sm,
            }}
            numberOfLines={1}
          >
            {caseItem.clientName} • {caseItem.clientType}
          </Text>

          {/* Date and Status Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialCommunityIcons
                name="calendar"
                size={14}
                color={COLORS.onSurfaceVariant}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.onSurfaceVariant,
                }}
              >
                {formatDate(caseItem.tarikh)}
              </Text>
            </View>

            {/* Status Badge */}
            <StatusBadge status={caseItem.status} size="sm" />
          </View>
        </View>

        {/* Options Icon */}
        <TouchableOpacity
          style={{
            width: 32,
            height: 32,
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={handleLongPress}
        >
          <MaterialCommunityIcons
            name="dots-vertical"
            size={20}
            color={COLORS.onSurfaceVariant}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
