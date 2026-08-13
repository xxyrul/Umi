import React from "react";
import { View, Text, TouchableOpacity, Alert, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SPACING } from "@/constants/theme";
import { StatusBadge } from "./StatusBadge";
import type { PropertyCase, CaseStatus } from "@/types/case";
import { useAppSettings } from "@/context/AppSettingsContext";

interface CaseCardProps {
  case: PropertyCase;
  onPress?: () => void;
  onDelete?: (caseId: string) => void;
  onStatusPress?: (caseItem: PropertyCase) => void;
  onReminderPress?: (caseItem: PropertyCase) => void;
}

const CASE_PROGRESS_STAGES: CaseStatus[] = [
  "Viewing",
  "Booking Paid",
  "Loan Approved",
  "SPA Signed",
  "Completed",
];

export function CaseCard({ case: caseItem, onPress, onDelete, onStatusPress, onReminderPress }: CaseCardProps) {
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
  const currentStageIndex = CASE_PROGRESS_STAGES.indexOf(caseItem.status);

  const getStatusLabel = (status: CaseStatus) => {
    const labels: Record<CaseStatus, string> = {
      Viewing: t("statusViewing"),
      "Booking Paid": t("statusBookingPaid"),
      "Loan Approved": t("statusLoanApproved"),
      "SPA Signed": t("statusSpaSigned"),
      Completed: t("statusCompleted"),
      Cancelled: t("statusCancelled"),
      Pending: t("statusPending"),
      Review: t("statusReview"),
    };
    return labels[status];
  };

  const formatReminderDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString(language === "BM" ? "ms-MY" : "en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert(t("noInfoTitle"), t("noPhoneMsg"));
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert(t("errorTitle"), t("callFailed"));
    });
  };

  const handleWhatsApp = (phone?: string, name?: string) => {
    if (!phone) {
      Alert.alert(t("noInfoTitle"), t("noPhoneMsg"));
      return;
    }
    let cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = `60${cleanPhone.slice(1)}`;
    }
    const message = encodeURIComponent(
      `Salam / Hai ${name || "Client"}, saya berkenaan kes hartanah anda: "${caseItem.namaCase}".`,
    );
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${message}`).catch(() => {
      Alert.alert(t("errorTitle"), t("waFailed"));
    });
  };

  const renderPartyActions = (phone: string | undefined, name: string) => (
    <View style={{ flexDirection: "row", gap: 6, marginTop: 7 }}>
      <TouchableOpacity
        activeOpacity={0.75}
        disabled={!phone}
        onPress={(event) => {
          event.stopPropagation();
          handleCall(phone);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t("callLabel")} ${name}`}
        style={{
          width: 34,
          height: 30,
          borderRadius: 8,
          backgroundColor: phone ? themeColors.maroonLight : themeColors.surfaceContainerLow,
          alignItems: "center",
          justifyContent: "center",
          opacity: phone ? 1 : 0.55,
        }}
      >
        <MaterialCommunityIcons name="phone-outline" size={15} color={themeColors.maroonPrimary} />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.75}
        disabled={!phone}
        onPress={(event) => {
          event.stopPropagation();
          handleWhatsApp(phone, name);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t("whatsappLabel")} ${name}`}
        style={{
          width: 34,
          height: 30,
          borderRadius: 8,
          backgroundColor: phone ? "#D1FAE5" : themeColors.surfaceContainerLow,
          alignItems: "center",
          justifyContent: "center",
          opacity: phone ? 1 : 0.55,
        }}
      >
        <MaterialCommunityIcons name="whatsapp" size={16} color="#047857" />
      </TouchableOpacity>
    </View>
  );

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
              {t("vendorLabel")}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary }} numberOfLines={1}>
              {vendorDisplay}
            </Text>
            {caseItem.vendorPhone ? (
              <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 2 }} numberOfLines={1}>
                {caseItem.vendorPhone}
              </Text>
            ) : null}
            {renderPartyActions(caseItem.vendorPhone, vendorDisplay)}
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
              {t("buyerLabel")}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary }} numberOfLines={1}>
              {buyerDisplay}
            </Text>
            {caseItem.buyerPhone ? (
              <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 2 }} numberOfLines={1}>
                {caseItem.buyerPhone}
              </Text>
            ) : null}
            {renderPartyActions(caseItem.buyerPhone, buyerDisplay)}
          </View>
        </View>

        {currentStageIndex >= 0 ? (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: themeColors.textMuted, fontSize: 11, fontWeight: "700" }}>
                {t("currentStage")}
              </Text>
              <Text style={{ color: themeColors.maroonPrimary, fontSize: 11, fontWeight: "800" }}>
                {currentStageIndex + 1}/{CASE_PROGRESS_STAGES.length}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {CASE_PROGRESS_STAGES.map((stage, index) => (
                <View
                  key={stage}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor:
                      index <= currentStageIndex ? themeColors.maroonPrimary : themeColors.borderColor,
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={(event) => {
            event.stopPropagation();
            if (!caseItem.reminderDate) {
              onReminderPress?.(caseItem);
            }
          }}
          style={{
            marginTop: 10,
            backgroundColor: caseItem.reminderDate ? themeColors.accentSuccessLight : themeColors.surfaceContainer,
            borderRadius: 8,
            paddingVertical: 7,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <MaterialCommunityIcons
            name={caseItem.reminderDate ? "calendar-clock" : "calendar-plus-outline"}
            size={15}
            color={caseItem.reminderDate ? themeColors.accentSuccess : themeColors.textMuted}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: themeColors.textMuted, fontWeight: "700", textTransform: "uppercase" }}>
              {t("followUpLabel")}
            </Text>
            <Text style={{ fontSize: 11, color: themeColors.textSecondary, fontWeight: "600", marginTop: 2 }} numberOfLines={1}>
              {caseItem.reminderDate
                ? `${t("followUpOn")}: ${formatReminderDate(caseItem.reminderDate)}`
                : t("followUpNone")}
            </Text>
            {!caseItem.reminderDate ? (
              <Text style={{ fontSize: 10, color: themeColors.maroonPrimary, fontWeight: "800", marginTop: 3 }}>
                {t("addFollowUp")}
              </Text>
            ) : null}
            {caseItem.reminderNote ? (
              <Text style={{ fontSize: 10, color: themeColors.textMuted, marginTop: 2 }} numberOfLines={1}>
                {caseItem.reminderNote}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

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
