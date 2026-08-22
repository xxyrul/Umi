import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  SlideInRight,
  SlideOutLeft,
  SlideInLeft,
  SlideOutRight,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useAppSettings } from "@/context/AppSettingsContext";
import { SPACING } from "@/constants/theme";
import type { PeganganType, LotStatusType } from "@/types/listing";

export const JENIS_LIST = [
  "Residential / Teres",
  "Condominium / Apartment",
  "Bungalow / Semi-D",
  "Commercial / Shoplot",
  "Factory / Warehouse",
  "Agricultural Land",
];

interface BasicInfoStepProps {
  tajuk: string;
  setTajuk: (v: string) => void;
  harga: string;
  setHarga: (v: string) => void;
  jenis: string;
  setJenis: (v: string) => void;
  pegangan: PeganganType;
  setPegangan: (v: PeganganType) => void;
  lot: LotStatusType;
  setLot: (v: LotStatusType) => void;
  bilikTidur: string;
  incrementBilikTidur: () => void;
  decrementBilikTidur: () => void;
  bilikAir: string;
  incrementBilikAir: () => void;
  decrementBilikAir: () => void;
  keluasan: string;
  setKeluasan: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  isPropertyTypeModalVisible: boolean;
  setIsPropertyTypeModalVisible: (v: boolean) => void;
  isMovingForward: boolean;
  currentStep: number;
  handleInputFocus: (e: any) => void;
  bedAnimatedStyle: any;
  bathAnimatedStyle: any;
}

export function BasicInfoStep({
  tajuk,
  setTajuk,
  harga,
  setHarga,
  jenis,
  setJenis,
  pegangan,
  setPegangan,
  lot,
  setLot,
  bilikTidur,
  incrementBilikTidur,
  decrementBilikTidur,
  bilikAir,
  incrementBilikAir,
  decrementBilikAir,
  keluasan,
  setKeluasan,
  description,
  setDescription,
  isPropertyTypeModalVisible,
  setIsPropertyTypeModalVisible,
  isMovingForward,
  currentStep,
  handleInputFocus,
  bedAnimatedStyle,
  bathAnimatedStyle,
}: BasicInfoStepProps) {
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
        {t("basicInfo")}
      </Text>
      <TextInput
        placeholder={t("titlePlaceholder")}
        placeholderTextColor={themeColors.textMuted}
        value={tajuk}
        onChangeText={setTajuk}
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

      <View
        style={[
          styles.priceInputContainer,
          {
            backgroundColor: themeColors.cardBackground,
            borderColor: themeColors.borderColor,
          },
        ]}
      >
        <Text style={[styles.pricePrefix, { color: themeColors.textPrimary }]}>RM</Text>
        <TextInput
          placeholder={t("pricePlaceholder")}
          placeholderTextColor={themeColors.textMuted}
          value={harga.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
          onChangeText={(v) => setHarga(v.replace(/,/g, "").replace(/\D/g, ""))}
          keyboardType="numeric"
          onFocus={handleInputFocus}
          style={[styles.priceInput, { color: themeColors.textPrimary }]}
        />
      </View>

      {/* Property Type Dropdown Trigger */}
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
        {t("propertyType") || "Jenis Hartanah"}
      </Text>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setIsPropertyTypeModalVisible(true)}
        style={[
          styles.selectTrigger,
          {
            backgroundColor: themeColors.cardBackground,
            borderColor: themeColors.borderColor,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <MaterialCommunityIcons name="home-city-outline" size={20} color={themeColors.maroonPrimary} />
          <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
            {jenis}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-down" size={20} color={themeColors.textMuted} />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
        {t("specsTitle")}
      </Text>

      {/* Tenure (Freehold / Leasehold) */}
      <View style={{ marginBottom: SPACING.md }}>
        <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>
          {t("tenure")}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(["Freehold", "Leasehold"] as PeganganType[]).map((ten) => (
            <TouchableOpacity
              key={ten}
              onPress={() => setPegangan(ten)}
              style={[
                styles.gridChip,
                {
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  height: 46,
                  backgroundColor: themeColors.cardBackground,
                  borderColor: themeColors.borderColor,
                },
                pegangan === ten && {
                  borderColor: themeColors.maroonPrimary,
                  backgroundColor: themeColors.maroonPrimary,
                },
              ]}
            >
              <Text
                style={{
                  color: pegangan === ten ? "#FFFFFF" : themeColors.textPrimary,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                {ten}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Lot Status (Bumi / Non-Bumi) */}
      <View style={{ marginBottom: SPACING.md }}>
        <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>
          {t("lotStatus")}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(["Bumi", "Non-Bumi"] as const).map((l) => {
            const label: LotStatusType = l === "Bumi" ? "Bumi Lot" : "Non-Bumi Lot";
            return (
              <TouchableOpacity
                key={l}
                onPress={() => setLot(label)}
                style={[
                  styles.gridChip,
                  {
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    height: 46,
                    backgroundColor: themeColors.cardBackground,
                    borderColor: themeColors.borderColor,
                  },
                  lot === label && {
                    borderColor: themeColors.maroonPrimary,
                    backgroundColor: themeColors.maroonPrimary,
                  },
                ]}
              >
                <Text
                  style={{
                    color: lot === label ? "#FFFFFF" : themeColors.textPrimary,
                    fontWeight: "700",
                    fontSize: 14,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Bedrooms & Bathrooms Steppers */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: SPACING.md }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>
            {t("bedrooms")}
          </Text>
          <View
            style={[
              styles.stepperContainer,
              { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground },
            ]}
          >
            <TouchableOpacity onPress={decrementBilikTidur} style={styles.stepperBtn}>
              <MaterialCommunityIcons name="minus" size={24} color={themeColors.textPrimary} />
            </TouchableOpacity>
            <Animated.Text
              style={[
                styles.stepperValue,
                { color: themeColors.textPrimary },
                bedAnimatedStyle,
              ]}
            >
              {bilikTidur}
            </Animated.Text>
            <TouchableOpacity onPress={incrementBilikTidur} style={styles.stepperBtn}>
              <MaterialCommunityIcons name="plus" size={24} color={themeColors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>
            {t("bathrooms")}
          </Text>
          <View
            style={[
              styles.stepperContainer,
              { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground },
            ]}
          >
            <TouchableOpacity onPress={decrementBilikAir} style={styles.stepperBtn}>
              <MaterialCommunityIcons name="minus" size={24} color={themeColors.textPrimary} />
            </TouchableOpacity>
            <Animated.Text
              style={[
                styles.stepperValue,
                { color: themeColors.textPrimary },
                bathAnimatedStyle,
              ]}
            >
              {bilikAir}
            </Animated.Text>
            <TouchableOpacity onPress={incrementBilikAir} style={styles.stepperBtn}>
              <MaterialCommunityIcons name="plus" size={24} color={themeColors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TextInput
        placeholder={language === "BM" ? "Keluasan (sqft)" : "Size (sqft)"}
        placeholderTextColor={themeColors.textMuted}
        value={keluasan}
        onChangeText={setKeluasan}
        keyboardType="default"
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

      {/* Description / Keterangan (Pilihan) */}
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary, marginTop: SPACING.md }]}>
        {language === "BM" ? "Keterangan / Penerangan (Pilihan)" : "Description / Details (Optional)"}
      </Text>
      <TextInput
        placeholder={
          language === "BM"
            ? "Salin/tampal maklumat penuh hartanah, kemudahan berdekatan, atau nota tambahan di sini..."
            : "Paste full property copywriting, nearby amenities, or additional notes here..."
        }
        placeholderTextColor={themeColors.textMuted}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        onFocus={handleInputFocus}
        style={[
          styles.input,
          {
            color: themeColors.textPrimary,
            backgroundColor: themeColors.cardBackground,
            borderColor: themeColors.borderColor,
            minHeight: 90,
            paddingTop: 12,
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
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: SPACING.md,
  },
  pricePrefix: {
    fontSize: 16,
    fontWeight: "700",
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
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
  gridChip: {
    borderRadius: 10,
    borderWidth: 1,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 6,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: "700",
  },
});
