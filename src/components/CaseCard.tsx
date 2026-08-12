import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SPACING } from "@/constants/theme";
import { StatusBadge } from "./StatusBadge";
import type { PropertyCase } from "@/types/case";
import { useAppSettings } from "@/context/AppSettingsContext";

interface CaseCardProps {
  case: PropertyCase;
  onPress?: () => void;
  onDelete?: (caseId: string) => void;
  onStatusPress?: (caseItem: PropertyCase) => void;
}

export function CaseCard({ case: caseItem, onPress, onDelete, onStatusPress }: CaseCardProps) {
  const { themeColors, language, t } = useAppSettings();

  const handleLongPress = () => {
    if (!onDelete) return;
    const isBM = language === "BM";
    const alertTitle = isBM ? "Padam Kes" : "Delete Case";
    const alertMessage = isBM
      ? `Adakah anda pasti mahu memadam kes "${caseItem.namaCase}"?`
      : `Are you sure you want to delete case "${caseItem.namaCase}"?`;
    const cancelText = isBM ? "Batal" : "Cancel";
    const deleteText = isBM ? "Padam" : "Delete";

    Alert.alert(alertTitle, alertMessage, [
      { text: cancelText, onPress: () => {}, style: "cancel" },
      { text: deleteText, onPress: () => onDelete(caseItem.id), style: "destructive" },
    ]);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const vendorDisplay = caseItem.vendorName || caseItem.clientName || "—";
  const buyerDisplay = caseItem.buyerName || "—";

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
      style={{
        backgroundColor: themeColors.cardBackground,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: themeColors.borderColor,
        marginBottom: SPACING.md,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      {/* Top accent bar */}
      <View style={{ height: 4, backgroundColor: themeColors.maroonPrimary }} />

      <View style={{ padding: SPACING.md }}>
        {/* Property name + Status */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm, gap: SPACING.sm }}>
          <View
            style={{
              width: 42,
              height: 42,
              backgroundColor: themeColors.maroonLight,
              borderRadius: 12,
              justifyContent: "center",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <MaterialCommunityIcons name="home-modern" size={24} color={themeColors.maroonPrimary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 16, fontWeight: "700", color: themeColors.textPrimary, marginBottom: 2 }}
              numberOfLines={1}
            >
              {caseItem.namaCase}
            </Text>
            <Text style={{ fontSize: 12, color: themeColors.textMuted }}>
              {formatDate(caseItem.tarikh)}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onStatusPress?.(caseItem)}
            style={{
              padding: 4,
              borderRadius: 8,
              backgroundColor: themeColors.surfaceContainer,
            }}
          >
            <StatusBadge status={caseItem.status} size="sm" />
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: themeColors.borderColor, marginVertical: SPACING.sm }} />

        {/* Parties row */}
        <View style={{ flexDirection: "row", gap: SPACING.sm }}>
          {/* Vendor */}
          <View
            style={{
              flex: 1,
              backgroundColor: themeColors.surfaceContainer,
              borderRadius: 10,
              padding: SPACING.sm,
              borderLeftWidth: 4,
              borderLeftColor: "#F59E0B",
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#F59E0B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
              Vendor
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary }} numberOfLines={1}>
              {vendorDisplay}
            </Text>
            {caseItem.vendorPhone ? (
              <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 2 }} numberOfLines={1}>
                {caseItem.vendorPhone}
              </Text>
            ) : null}
          </View>

          {/* Buyer */}
          <View
            style={{
              flex: 1,
              backgroundColor: themeColors.surfaceContainer,
              borderRadius: 10,
              padding: SPACING.sm,
              borderLeftWidth: 4,
              borderLeftColor: "#10B981",
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#10B981", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
              Buyer
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary }} numberOfLines={1}>
              {buyerDisplay}
            </Text>
            {caseItem.buyerPhone ? (
              <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 2 }} numberOfLines={1}>
                {caseItem.buyerPhone}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Status history log entry */}
        {caseItem.statusHistory && caseItem.statusHistory.length > 0 && (
          <View
            style={{
              marginTop: 10,
              backgroundColor: themeColors.surfaceContainer,
              borderRadius: 8,
              paddingVertical: 6,
              paddingHorizontal: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <MaterialCommunityIcons name="history" size={14} color={themeColors.textMuted} />
            <Text style={{ fontSize: 11, color: themeColors.textMuted, flex: 1 }} numberOfLines={1}>
              {caseItem.statusHistory[caseItem.statusHistory.length - 1]}
            </Text>
          </View>
        )}

        {/* Finance info + Large Touch Area Buttons */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, gap: 6 }}>
          <MaterialCommunityIcons name="bank-outline" size={16} color={themeColors.textMuted} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: themeColors.textSecondary }}>{caseItem.finance}</Text>
          {caseItem.catatan ? (
            <Text style={{ fontSize: 12, color: themeColors.textMuted, flex: 1 }} numberOfLines={1}>
              · {caseItem.catatan}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {/* Large Touch Calendar Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              const { addToPhoneCalendar } = require("@/utils/calendar");
              const dateObj = new Date(caseItem.tarikh);
              const summary = `Vendor: ${vendorDisplay}\nBuyer: ${buyerDisplay}\nStatus: ${caseItem.status}\nFinance: ${caseItem.finance}${caseItem.catatan ? `\nNotes: ${caseItem.catatan}` : ""}`;
              addToPhoneCalendar(caseItem.namaCase, summary, dateObj);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              padding: 8,
              borderRadius: 20,
              backgroundColor: themeColors.maroonLight,
              marginRight: 6,
            }}
          >
            <MaterialCommunityIcons name="calendar-plus" size={22} color={themeColors.maroonPrimary} />
          </TouchableOpacity>

          {/* Large Touch Three-Dot Menu */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleLongPress}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              padding: 8,
              borderRadius: 20,
              backgroundColor: themeColors.surfaceContainer,
            }}
          >
            <MaterialCommunityIcons name="dots-vertical" size={22} color={themeColors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
