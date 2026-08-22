import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Image as ExpoImage } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { PropertyListing } from "@/types/listing";
import { useAppSettings } from "@/context/AppSettingsContext";

interface ListingMapViewProps {
  masterMapRef: React.RefObject<MapView | null>;
  sortedListings: PropertyListing[];
  selectedMapListing: PropertyListing | null;
  setSelectedMapListing: (item: PropertyListing | null) => void;
  getSmartListingCoordinates: (item: PropertyListing, idx: number) => { latitude: number; longitude: number };
  formatCompactPrice: (price: any) => string;
  formatPriceLabel: (price: any) => string;
  cleanListingTitle: (title?: string) => string;
  getListingImageUri: (item: PropertyListing) => string | null;
  resolveListingLocation: (item: PropertyListing) => { displayLocation: string };
  handleLocateMeOnMasterMap: () => void;
  isLocatingUser: boolean;
  onNavigateToDetail: (id: string) => void;
}

export function ListingMapView({
  masterMapRef,
  sortedListings,
  selectedMapListing,
  setSelectedMapListing,
  getSmartListingCoordinates,
  formatCompactPrice,
  formatPriceLabel,
  cleanListingTitle,
  getListingImageUri,
  resolveListingLocation,
  handleLocateMeOnMasterMap,
  isLocatingUser,
  onNavigateToDetail,
}: ListingMapViewProps) {
  const insets = useSafeAreaInsets();
  const { themeColors } = useAppSettings();

  return (
    <View style={{ flex: 1, width: "100%", position: "relative" }}>
      <MapView
        ref={masterMapRef as any}
        style={{ flex: 1, width: "100%" }}
        provider={PROVIDER_GOOGLE}
        toolbarEnabled={false}
        showsUserLocation={true}
        showsMyLocationButton={false}
        mapPadding={{ bottom: Math.max(insets.bottom, 24) + 140, top: 0, right: 0, left: 0 }}
        initialRegion={{
          latitude: 3.8,
          longitude: 101.9,
          latitudeDelta: 4.5,
          longitudeDelta: 4.5,
        }}
      >
        {sortedListings.map((item, idx) => {
          const coords = getSmartListingCoordinates(item, idx);
          const isSelected = selectedMapListing?.id === item.id;
          return (
            <Marker
              key={`map-pin-${item.id}`}
              coordinate={coords}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setSelectedMapListing(item);
              }}
              tracksViewChanges={false}
            >
              <View
                style={[
                  styles.mapPriceMarker,
                  {
                    backgroundColor: isSelected ? "#FF3B5C" : themeColors.maroonPrimary,
                    borderColor: "#FFF",
                    transform: [{ scale: isSelected ? 1.15 : 1 }],
                  },
                ]}
              >
                <Text style={styles.mapPriceMarkerText}>
                  {formatCompactPrice(item.harga)}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating Locate Me GPS Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleLocateMeOnMasterMap}
        disabled={isLocatingUser}
        style={[
          styles.locateMeFab,
          {
            backgroundColor: themeColors.cardBackground,
            borderColor: themeColors.borderColor,
            top: 14,
            right: 16,
          },
        ]}
      >
        {isLocatingUser ? (
          <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
        ) : (
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={themeColors.maroonPrimary} />
        )}
      </TouchableOpacity>

      {/* Floating Selected Listing Bottom Preview Card */}
      {selectedMapListing && (
        <View
          style={[
            styles.mapBottomCardWrap,
            {
              bottom: Math.max(insets.bottom, 28) + 88,
              zIndex: 999,
              elevation: 10,
              backgroundColor: themeColors.cardBackground,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => {
              if (!selectedMapListing?.id) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onNavigateToDetail(selectedMapListing.id);
            }}
            style={styles.mapCardInner}
          >
            {/* Thumbnail */}
            {getListingImageUri(selectedMapListing) ? (
              <ExpoImage
                source={{ uri: getListingImageUri(selectedMapListing)! }}
                style={styles.mapCardThumb}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={[styles.mapCardThumbPlaceholder, { backgroundColor: themeColors.maroonLight }]}>
                <MaterialCommunityIcons name="home-city" size={24} color={themeColors.maroonPrimary} />
              </View>
            )}

            <View style={styles.mapCardDetails}>
              <Text style={[styles.mapCardPrice, { color: themeColors.maroonPrimary }]} numberOfLines={1}>
                {formatPriceLabel(selectedMapListing.harga)}
              </Text>
              <Text style={[styles.mapCardTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                {cleanListingTitle(selectedMapListing.tajuk)}
              </Text>
              <Text style={[styles.mapCardLocation, { color: themeColors.textMuted }]} numberOfLines={1}>
                📍 {resolveListingLocation(selectedMapListing).displayLocation}
              </Text>
              {(selectedMapListing.bilikTidur || selectedMapListing.bilikAir) ? (
                <Text style={[styles.mapCardSpecs, { color: themeColors.textSecondary }]}>
                  🛏️ {selectedMapListing.bilikTidur || 0}  🚿 {selectedMapListing.bilikAir || 0}
                </Text>
              ) : null}
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setSelectedMapListing(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.mapCardCloseBtn}
            >
              <MaterialCommunityIcons name="close-circle" size={20} color={themeColors.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapPriceMarker: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  mapPriceMarkerText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  locateMeFab: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  mapBottomCardWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  mapCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mapCardThumb: {
    width: 68,
    height: 68,
    borderRadius: 10,
  },
  mapCardThumbPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  mapCardDetails: {
    flex: 1,
    gap: 2,
  },
  mapCardPrice: {
    fontSize: 15,
    fontWeight: "800",
  },
  mapCardTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  mapCardLocation: {
    fontSize: 11,
  },
  mapCardSpecs: {
    fontSize: 11,
    marginTop: 2,
  },
  mapCardCloseBtn: {
    alignSelf: "flex-start",
    padding: 2,
  },
});
