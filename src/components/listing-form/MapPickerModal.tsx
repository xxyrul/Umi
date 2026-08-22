import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "@/context/AppSettingsContext";

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  pickerMapRef: React.RefObject<MapView | null>;
  pickerCoords: { latitude: number; longitude: number };
  setPickerCoords: (coords: { latitude: number; longitude: number }) => void;
  updatePickerAddress: (lat: number, lng: number) => void;
  pickerSuggestions: Array<{ id: string; title: string; subtitle?: string; lat: number; lng: number }>;
  setPickerSuggestions: (s: any[]) => void;
  pickerSearchQuery: string;
  setPickerSearchQuery: (q: string) => void;
  handleSearchSubmit: () => void;
  handleSelectSuggestion: (item: any) => void;
  isSearchingMap: boolean;
  pickerAddressPreview: string;
  handleConfirmMapPicker: () => void;
}

export function MapPickerModal({
  visible,
  onClose,
  pickerMapRef,
  pickerCoords,
  setPickerCoords,
  updatePickerAddress,
  pickerSuggestions,
  setPickerSuggestions,
  pickerSearchQuery,
  setPickerSearchQuery,
  handleSearchSubmit,
  handleSelectSuggestion,
  isSearchingMap,
  pickerAddressPreview,
  handleConfirmMapPicker,
}: MapPickerModalProps) {
  const insets = useSafeAreaInsets();
  const { themeColors, language } = useAppSettings();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
        {/* Modal Header */}
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: themeColors.borderColor,
            backgroundColor: themeColors.cardBackground,
            gap: 12,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            style={{
              padding: 6,
              borderRadius: 20,
              backgroundColor: themeColors.surfaceContainer,
            }}
          >
            <MaterialCommunityIcons name="close" size={22} color={themeColors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "700", color: themeColors.textPrimary, flex: 1 }}>
            {language === "BM" ? "Pilih Lokasi Hartanah" : "Pin Property Location"}
          </Text>
        </View>

        {/* Map View Area with Overlay Search */}
        <View style={{ flex: 1, position: "relative" }}>
          <MapView
            ref={pickerMapRef as any}
            style={{ flex: 1, width: "100%" }}
            provider={PROVIDER_GOOGLE}
            toolbarEnabled={false}
            showsUserLocation={true}
            showsMyLocationButton={true}
            mapPadding={{ bottom: Math.max(insets.bottom, 28) + 120, top: 70, right: 0, left: 0 }}
            initialRegion={{
              latitude: pickerCoords.latitude,
              longitude: pickerCoords.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            onRegionChangeComplete={(region) => {
              setPickerCoords({ latitude: region.latitude, longitude: region.longitude });
              updatePickerAddress(region.latitude, region.longitude);
            }}
          />

          {/* Fixed Center Pin */}
          <View
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              marginTop: -36,
              marginLeft: -16,
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            <MaterialCommunityIcons name="map-marker" size={40} color={themeColors.maroonPrimary} />
          </View>

          {/* Instruction Tip */}
          {pickerSuggestions.length === 0 && (
            <View
              style={{
                position: "absolute",
                top: 75,
                alignSelf: "center",
                backgroundColor: "rgba(0,0,0,0.75)",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                pointerEvents: "none",
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "600" }}>
                {language === "BM"
                  ? "👉 Ketik atau seret pin ke lokasi tepat"
                  : "👉 Tap or drag pin to exact location"}
              </Text>
            </View>
          )}

          {/* Floating Search Bar & Suggestions Overlay */}
          <View
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: 12,
              zIndex: 9999,
              elevation: 9999,
            }}
          >
            {/* Search Input Box */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                backgroundColor: themeColors.cardBackground,
                gap: 8,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 6,
              }}
            >
              <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textMuted} />
              <TextInput
                placeholder={
                  language === "BM"
                    ? "Cari jalan / kawasan / bandar..."
                    : "Search road / area / city..."
                }
                placeholderTextColor={themeColors.textMuted}
                value={pickerSearchQuery}
                onChangeText={setPickerSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                style={{ flex: 1, fontSize: 14, color: themeColors.textPrimary }}
              />
              {isSearchingMap ? (
                <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
              ) : pickerSearchQuery.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setPickerSearchQuery("");
                    setPickerSuggestions([]);
                  }}
                >
                  <MaterialCommunityIcons name="close-circle" size={18} color={themeColors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Suggestions List */}
            {pickerSuggestions.length > 0 && (
              <View
                style={{
                  marginTop: 6,
                  backgroundColor: themeColors.cardBackground,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  maxHeight: 240,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 12,
                  overflow: "hidden",
                }}
              >
                <ScrollView
                  keyboardShouldPersistTaps="always"
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  style={{ maxHeight: 240 }}
                >
                  {pickerSuggestions.map((item, index) => (
                    <TouchableOpacity
                      key={item.id || `place-${index}`}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderBottomWidth: index === pickerSuggestions.length - 1 ? 0 : 1,
                        borderBottomColor: themeColors.borderColor,
                      }}
                      onPress={() => handleSelectSuggestion(item)}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <MaterialCommunityIcons
                          name="map-marker-outline"
                          size={20}
                          color={themeColors.maroonPrimary}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: themeColors.textPrimary,
                              fontWeight: "700",
                              fontSize: 14,
                            }}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          {item.subtitle ? (
                            <Text
                              style={{
                                color: themeColors.textSecondary,
                                fontSize: 12,
                                marginTop: 2,
                              }}
                              numberOfLines={2}
                            >
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Confirmation Bar */}
        <View
          style={{
            padding: 16,
            paddingBottom: Math.max(insets.bottom, 28) + 16,
            backgroundColor: themeColors.cardBackground,
            borderTopWidth: 1,
            borderTopColor: themeColors.borderColor,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="map-marker-check" size={22} color={themeColors.maroonPrimary} />
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary }}
                numberOfLines={2}
              >
                {pickerAddressPreview}
              </Text>
              <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
                {pickerCoords.latitude.toFixed(6)}, {pickerCoords.longitude.toFixed(6)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleConfirmMapPicker}
            style={{
              backgroundColor: themeColors.maroonPrimary,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>
              {language === "BM" ? "Sahkan Lokasi Ini" : "Confirm This Location"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
