import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "@/context/AppSettingsContext";

interface FilterChip {
  id: string;
  label: string;
}

interface ListingFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  renderFilterContent: boolean;
  filterChips: FilterChip[];
  activeFilter: string;
  setActiveFilter: (id: string) => void;
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  criteriaLocation: string;
  setCriteriaLocation: (loc: string) => void;
  criteriaMinPrice: string;
  setCriteriaMinPrice: (p: string) => void;
  criteriaMaxPrice: string;
  setCriteriaMaxPrice: (p: string) => void;
  criteriaPropertyType: string;
  handlePropertyTypeSelect: (opt: string) => void;
  propertyTypeOptions: string[];
  criteriaTenure: string;
  handleTenureSelect: (opt: string) => void;
  tenureOptions: string[];
  criteriaLotStatus: string;
  handleLotStatusSelect: (opt: string) => void;
  lotStatusOptions: string[];
  clearAllFilters: () => void;
  activeFilterCount: number;
}

export function ListingFilterSheet({
  visible,
  onClose,
  renderFilterContent,
  filterChips,
  activeFilter,
  setActiveFilter,
  categoryFilter,
  setCategoryFilter,
  criteriaLocation,
  setCriteriaLocation,
  criteriaMinPrice,
  setCriteriaMinPrice,
  criteriaMaxPrice,
  setCriteriaMaxPrice,
  criteriaPropertyType,
  handlePropertyTypeSelect,
  propertyTypeOptions,
  criteriaTenure,
  handleTenureSelect,
  tenureOptions,
  criteriaLotStatus,
  handleLotStatusSelect,
  lotStatusOptions,
  clearAllFilters,
  activeFilterCount,
}: ListingFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { themeColors, language } = useAppSettings();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.sheetContainer,
            {
              backgroundColor: themeColors.cardBackground,
              paddingBottom: Math.max(insets.bottom, 28) + 20,
            },
          ]}
        >
          <View style={[styles.modalHandle, { backgroundColor: themeColors.borderColor }]} />
          <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
            {language === "BM" ? "Tapis Listing" : "Filter Listings"}
          </Text>

          {renderFilterContent ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {/* Status Filter */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Status" : "Status"}
                </Text>
                <View style={styles.pillRow}>
                  {filterChips.map((chip) => {
                    const active = activeFilter === chip.id;
                    return (
                      <TouchableOpacity
                        key={chip.id}
                        activeOpacity={0.7}
                        onPress={() => setActiveFilter(chip.id)}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.pillText, { color: active ? "#FFF" : themeColors.textSecondary }]}>
                          {chip.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Category Filter */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Jenis Hartanah" : "Property Category"}
                </Text>
                <View style={styles.pillRow}>
                  {[
                    { id: "Semua", label: language === "BM" ? "Semua" : "All", icon: "view-grid" as const },
                    { id: "Landed", label: "Landed", icon: "home" as const },
                    { id: "High-Rise", label: "High-Rise", icon: "office-building" as const },
                    { id: "Commercial", label: "Komersial", icon: "store" as const },
                    { id: "Tanah", label: "Tanah", icon: "terrain" as const },
                    { id: "Industri", label: "Industri", icon: "factory" as const },
                    { id: "Sewa", label: "Sewa", icon: "key-variant" as const },
                  ].map((cat) => {
                    const active = categoryFilter === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        activeOpacity={0.7}
                        onPress={() => setCategoryFilter(cat.id)}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons name={cat.icon} size={13} color={active ? "#FFF" : themeColors.textMuted} />
                        <Text style={[styles.pillText, { color: active ? "#FFF" : themeColors.textSecondary }]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Location */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Lokasi" : "Location"}
                </Text>
                <TextInput
                  style={[
                    styles.criteriaInput,
                    {
                      borderColor: themeColors.borderColor,
                      color: themeColors.textPrimary,
                      backgroundColor: themeColors.surfaceContainer,
                    },
                  ]}
                  placeholder={language === "BM" ? "Cari lokasi..." : "Search location..."}
                  placeholderTextColor={themeColors.textMuted}
                  value={criteriaLocation}
                  onChangeText={setCriteriaLocation}
                />
              </View>

              {/* Price Range */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Julat Harga" : "Price Range"}
                </Text>
                <View style={styles.priceRow}>
                  <TextInput
                    style={[
                      styles.criteriaInput,
                      styles.halfInput,
                      {
                        borderColor: themeColors.borderColor,
                        color: themeColors.textPrimary,
                        backgroundColor: themeColors.surfaceContainer,
                      },
                    ]}
                    placeholder="Min RM"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="numeric"
                    value={criteriaMinPrice}
                    onChangeText={setCriteriaMinPrice}
                  />
                  <TextInput
                    style={[
                      styles.criteriaInput,
                      styles.halfInput,
                      {
                        borderColor: themeColors.borderColor,
                        color: themeColors.textPrimary,
                        backgroundColor: themeColors.surfaceContainer,
                      },
                    ]}
                    placeholder="Max RM"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="numeric"
                    value={criteriaMaxPrice}
                    onChangeText={setCriteriaMaxPrice}
                  />
                </View>
              </View>

              {/* Property Type */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Jenis Kediaman" : "Property Type"}
                </Text>
                <View style={styles.pillRow}>
                  {propertyTypeOptions.map((option) => {
                    const active = criteriaPropertyType === option;
                    return (
                      <TouchableOpacity
                        key={`ptype-${option}`}
                        activeOpacity={0.7}
                        onPress={() => handlePropertyTypeSelect(option)}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.pillText, { color: active ? "#FFF" : themeColors.textSecondary }]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Tenure */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Jenis Pegangan" : "Tenure Type"}
                </Text>
                <View style={styles.pillRow}>
                  {tenureOptions.map((option) => {
                    const active = criteriaTenure === option;
                    return (
                      <TouchableOpacity
                        key={`tenure-${option}`}
                        activeOpacity={0.7}
                        onPress={() => handleTenureSelect(option)}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.pillText, { color: active ? "#FFF" : themeColors.textSecondary }]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Lot Status */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Status Lot" : "Lot Status"}
                </Text>
                <View style={styles.pillRow}>
                  {lotStatusOptions.map((option) => {
                    const active = criteriaLotStatus === option;
                    return (
                      <TouchableOpacity
                        key={`lot-${option}`}
                        activeOpacity={0.7}
                        onPress={() => handleLotStatusSelect(option)}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.pillText, { color: active ? "#FFF" : themeColors.textSecondary }]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={{ height: 300, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
            </View>
          )}

          {/* Bottom Action Bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={clearAllFilters}
              style={[styles.actionBtn, { borderColor: themeColors.borderColor }]}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textSecondary }}>
                {language === "BM" ? "Reset Semua" : "Reset All"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onClose}
              style={[styles.actionBtn, { backgroundColor: themeColors.maroonPrimary }]}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
                {activeFilterCount > 0
                  ? `${language === "BM" ? "Tapis" : "Apply"} (${activeFilterCount})`
                  : language === "BM" ? "Tutup" : "Done"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  criteriaInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  priceRow: {
    flexDirection: "row",
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    borderColor: "transparent",
  },
});
