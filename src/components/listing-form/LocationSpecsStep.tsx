import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  SlideInRight,
  SlideOutLeft,
  SlideInLeft,
  SlideOutRight,
} from "react-native-reanimated";
import { useAppSettings } from "@/context/AppSettingsContext";
import { SPACING } from "@/constants/theme";
import type { PropertyLocation } from "@/types/listing";

export const NEGERI_LIST = [
  "Selangor", "Kuala Lumpur", "Johor", "Penang", "Perak", "Kedah", "Pahang",
  "Negeri Sembilan", "Melaka", "Kelantan", "Terengganu", "Sabah", "Sarawak",
  "Perlis", "Putrajaya",
];

interface LocationSpecsStepProps {
  location: PropertyLocation | null;
  negeri: string;
  autoDetectedStateInfo: { keyword: string; state: string } | null;
  alamat: string;
  setAlamat: (v: string) => void;
  navLink: string;
  handleNavLinkChange: (v: string) => void;
  listingStatus: "Aktif" | "Booking" | "Sold" | "Draft";
  setListingStatus: (v: "Aktif" | "Booking" | "Sold" | "Draft") => void;
  namaOwner: string;
  setNamaOwner: (v: string) => void;
  telOwner: string;
  setTelOwner: (v: string) => void;
  isFetchingLocation: boolean;
  handleOpenMapPicker: () => void;
  handlePinLocation: () => void;
  setIsStateModalVisible: (v: boolean) => void;
  handleAddressBlur: () => void;
  handleInputFocus: (e: any) => void;
  isMovingForward: boolean;
  currentStep: number;
}

export function LocationSpecsStep({
  location,
  negeri,
  autoDetectedStateInfo,
  alamat,
  setAlamat,
  navLink,
  handleNavLinkChange,
  listingStatus,
  setListingStatus,
  namaOwner,
  setNamaOwner,
  telOwner,
  setTelOwner,
  isFetchingLocation,
  handleOpenMapPicker,
  handlePinLocation,
  setIsStateModalVisible,
  handleAddressBlur,
  handleInputFocus,
  isMovingForward,
  currentStep,
}: LocationSpecsStepProps) {
  const { themeColors, language, t } = useAppSettings();

  const stepEntering = isMovingForward ? SlideInRight.duration(240) : SlideInLeft.duration(240);
  const stepExiting = isMovingForward ? SlideOutLeft.duration(240) : SlideOutRight.duration(240);

  return (
    <Animated.View
      key={`step-${currentStep}`}
      entering={stepEntering}
      exiting={stepExiting}
      style={styles.stepContainer}
    >
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
        {language === "BM" ? "Lokasi Hartanah" : "Property Location"}
      </Text>

      {/* 2-Button Choice: Pick on Map OR Pin GPS */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleOpenMapPicker}
          style={[
            styles.locationChoiceBtn,
            {
              flex: 1,
              backgroundColor: themeColors.maroonPrimary,
              borderColor: themeColors.maroonPrimary,
            },
          ]}
        >
          <MaterialCommunityIcons name="map-marker-outline" size={20} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>
            {language === "BM" ? "Pilih di Peta" : "Pick on Map"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handlePinLocation}
          disabled={isFetchingLocation}
          style={[
            styles.locationChoiceBtn,
            {
              flex: 1,
              backgroundColor: themeColors.surfaceContainer,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          {isFetchingLocation ? (
            <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
          ) : (
            <>
              <MaterialCommunityIcons name="crosshairs-gps" size={18} color={themeColors.textPrimary} />
              <Text style={{ color: themeColors.textPrimary, fontWeight: "700", fontSize: 13 }}>
                {language === "BM" ? "GPS Terkini" : "Current GPS"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Confirmed GPS Location Badge */}
      {location ? (
        <View
          style={[
            styles.confirmedLocationCard,
            {
              backgroundColor: `${themeColors.maroonPrimary}12`,
              borderColor: `${themeColors.maroonPrimary}30`,
            },
          ]}
        >
          <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textPrimary }}>
              {language === "BM" ? "Koordinat GPS Disahkan" : "GPS Coordinates Set"}
            </Text>
            <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleOpenMapPicker}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 6,
              backgroundColor: themeColors.maroonPrimary,
            }}
          >
            <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>
              {language === "BM" ? "Ubah" : "Change"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* State (Negeri) Dropdown Trigger */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
          marginTop: 4,
        }}
      >
        <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 0 }]}>
          {language === "BM" ? "Negeri" : "State"}
        </Text>
        {autoDetectedStateInfo ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: `${themeColors.maroonPrimary}15`,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: `${themeColors.maroonPrimary}30`,
            }}
          >
            <MaterialCommunityIcons name="auto-fix" size={12} color={themeColors.maroonPrimary} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: themeColors.maroonPrimary }}>
              {language === "BM"
                ? `Dikesan: ${autoDetectedStateInfo.keyword}`
                : `Detected: ${autoDetectedStateInfo.keyword}`}
            </Text>
          </View>
        ) : null}
      </View>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setIsStateModalVisible(true)}
        style={[
          styles.selectTrigger,
          {
            backgroundColor: themeColors.cardBackground,
            borderColor: themeColors.borderColor,
            marginBottom: SPACING.sm,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <MaterialCommunityIcons name="map-marker-radius-outline" size={20} color={themeColors.maroonPrimary} />
          <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
            {negeri}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-down" size={20} color={themeColors.textMuted} />
      </TouchableOpacity>

      {/* Full Property Address */}
      <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 6 }]}>
        {t("addressPlaceholder") || "Alamat Penuh"}
      </Text>
      <TextInput
        placeholder={t("addressPlaceholder") || "Alamat penuh hartanah (cth: No 12, Jalan ABC...)"}
        placeholderTextColor={themeColors.textMuted}
        value={alamat}
        onChangeText={setAlamat}
        onBlur={handleAddressBlur}
        multiline
        numberOfLines={3}
        onFocus={handleInputFocus}
        style={[
          styles.input,
          styles.multilineInput,
          {
            color: themeColors.textPrimary,
            backgroundColor: themeColors.cardBackground,
            borderColor: themeColors.borderColor,
          },
        ]}
      />

      {/* Navigation Link (Auto-generates or manual paste) */}
      <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 6, marginTop: 4 }]}>
        {language === "BM" ? "Pautan Navigasi (Google Maps / Waze)" : "Navigation Link (Google Maps / Waze)"}
      </Text>
      <TextInput
        placeholder={
          language === "BM"
            ? "Pautan Google Maps / Waze (Auto-isi dari peta)"
            : "Google Maps / Waze Link (Auto-fills from map)"
        }
        placeholderTextColor={themeColors.textMuted}
        value={navLink}
        onChangeText={handleNavLinkChange}
        onFocus={handleInputFocus}
        style={[
          styles.input,
          {
            color: themeColors.textPrimary,
            backgroundColor: themeColors.cardBackground,
            borderColor: themeColors.borderColor,
          },
        ]}
      />

      {/* Listing Status Selection */}
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
        {language === "BM" ? "Status Listing" : "Listing Status"}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        {(
          [
            { value: "Aktif", label: language === "BM" ? "Aktif" : "Active", icon: "check-circle", color: "#10B981" },
            { value: "Booking", label: "Booking", icon: "clock-outline", color: "#F59E0B" },
            { value: "Sold", label: language === "BM" ? "Terjual" : "Sold", icon: "tag-check", color: "#3B82F6" },
            { value: "Draft", label: "Draft", icon: "pencil-outline", color: "#6B7280" },
          ] as const
        ).map((opt) => {
          const isActive = listingStatus === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setListingStatus(opt.value)}
              style={[
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 2,
                  flex: 1,
                  minWidth: "45%",
                  justifyContent: "center",
                  borderColor: isActive ? opt.color : themeColors.borderColor,
                  backgroundColor: isActive ? `${opt.color}18` : themeColors.cardBackground,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={opt.icon as any}
                size={18}
                color={isActive ? opt.color : themeColors.textMuted}
              />
              <Text
                style={{
                  fontWeight: "700",
                  fontSize: 14,
                  color: isActive ? opt.color : themeColors.textSecondary,
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Owner / Agent Details */}
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
        {t("ownerDetails")}
      </Text>
      <TextInput
        placeholder={t("ownerNamePlaceholder") || "Nama Ejen"}
        placeholderTextColor={themeColors.textMuted}
        value={namaOwner}
        onChangeText={setNamaOwner}
        onFocus={handleInputFocus}
        style={[
          styles.input,
          {
            color: themeColors.textPrimary,
            backgroundColor: themeColors.cardBackground,
            borderColor: themeColors.borderColor,
          },
        ]}
      />
      <TextInput
        placeholder={t("ownerPhonePlaceholder") || "No. Telefon Ejen"}
        placeholderTextColor={themeColors.textMuted}
        value={telOwner}
        onChangeText={setTelOwner}
        keyboardType="phone-pad"
        onFocus={handleInputFocus}
        style={[
          styles.input,
          {
            color: themeColors.textPrimary,
            backgroundColor: themeColors.cardBackground,
            borderColor: themeColors.borderColor,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    width: "100%",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 6,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: SPACING.md,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  locationChoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  confirmedLocationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  selectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: SPACING.md,
  },
});
