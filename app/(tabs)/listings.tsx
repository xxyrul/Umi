import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Share,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
  StatusBar,
  Animated,
  Modal,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { firestore, auth } from "@/services/firebase";
import { useRouter } from "expo-router";
import type { PropertyListing } from "@/types/listing";
import { useAppSettings } from "@/context/AppSettingsContext";

const SEGMENTS = ["mine", "all"] as const;
type ListingSegment = typeof SEGMENTS[number];
type ListingSortOption = "newest" | "oldest" | "title-asc" | "title-desc" | "id";

const LISTING_SORT_OPTIONS: Array<{ id: ListingSortOption; label: string }> = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "title-asc", label: "A–Z" },
  { id: "title-desc", label: "Z–A" },
  { id: "id", label: "ID" },
];

function isListingOwnedByUser(item: Partial<PropertyListing>, userId: string): boolean {
  if (!userId) return false;
  return [item.userId, item.agentId].some(
    (ownerId) => typeof ownerId === "string" && ownerId.trim() === userId
  );
}

function parsePriceNumber(value: string | number | undefined): number | null {
  if (typeof value === "number" && !isNaN(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function uniqueOptions(values: Array<string | undefined | null>): string[] {
  const set = new Set<string>();
  values.forEach((v) => {
    const cleaned = (v || "").toString().trim();
    if (cleaned) set.add(cleaned);
  });
  return Array.from(set);
}

function getDateSortValue(value?: string): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function compareListings(a: PropertyListing, b: PropertyListing, sortOption: ListingSortOption): number {
  if (sortOption === "title-asc" || sortOption === "title-desc") {
    const comparison = (a.tajuk || "").localeCompare(b.tajuk || "", undefined, {
      sensitivity: "base",
      numeric: true,
    });
    return sortOption === "title-desc" ? -comparison : comparison;
  }

  if (sortOption === "id") {
    return (a.id || "").localeCompare(b.id || "", undefined, {
      sensitivity: "base",
      numeric: true,
    });
  }

  const aDate = getDateSortValue(a.createdAt || a.updatedAt);
  const bDate = getDateSortValue(b.createdAt || b.updatedAt);
  return sortOption === "oldest" ? aDate - bDate : bDate - aDate;
}

function formatPriceLabel(value: string | number | undefined): string {
  const parsed = parsePriceNumber(value);
  if (parsed === null) return `RM ${value ?? "0"}`;
  return `RM ${parsed.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

function formatSizeLabel(value: string | number | undefined): string {
  const raw = (value ?? "").toString().trim();
  if (!raw) return "";
  return raw.toLowerCase().includes("sq") ? raw : `${raw} sqft`;
}

function getListingImageUri(item: any): string | null {
  if (!item) return null;
  if (item.imageUrl) return item.imageUrl;
  if (item.images && item.images.length > 0 && item.images[0]) return item.images[0];
  if (item.gambar && item.gambar.length > 0 && item.gambar[0]) return item.gambar[0];
  if (typeof item.gambar === "string") return item.gambar;
  return null;
}

export default function MasterListingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { themeColors, t } = useAppSettings();
  const contentMaxWidth = Math.min(width, 760);
  const fabRight = Math.max(20, (width - contentMaxWidth) / 2 + 20);

  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Semua");
  const [activeSegment, setActiveSegment] = useState<ListingSegment>("mine");
  const [sortOption, setSortOption] = useState<ListingSortOption>("newest");
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);

  // Buyer criteria filters
  const [showCriteria, setShowCriteria] = useState(false);
  const [criteriaLocation, setCriteriaLocation] = useState("");
  const [criteriaPropertyType, setCriteriaPropertyType] = useState("Any");
  const [criteriaTenure, setCriteriaTenure] = useState("Any");
  const [criteriaLotStatus, setCriteriaLotStatus] = useState("Any");
  const [criteriaMinPrice, setCriteriaMinPrice] = useState("");
  const [criteriaMaxPrice, setCriteriaMaxPrice] = useState("");

  const propertyTypeRef = useRef<ScrollView>(null);
  const tenureRef = useRef<ScrollView>(null);
  const lotStatusRef = useRef<ScrollView>(null);
  const propertyTypeLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const tenureLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const lotStatusLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const [propertyTypeRowWidth, setPropertyTypeRowWidth] = useState(0);
  const [tenureRowWidth, setTenureRowWidth] = useState(0);
  const [lotStatusRowWidth, setLotStatusRowWidth] = useState(0);

  const segmentAnim = useRef(new Animated.Value(0)).current;
  const [segmentBarWidth, setSegmentBarWidth] = useState(0);

  // ScrollView Auto-Scroll Ref & Layout state
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollViewWidth, setScrollViewWidth] = useState(300);
  const chipLayouts = useRef<{ [key: string]: { x: number; width: number } }>({});

  const propertyTypeOptions = ["Any", ...uniqueOptions(listings.map((l) => l.jenis))];
  const tenureOptions = ["Any", ...uniqueOptions(listings.map((l) => (l.pegangan as string) || ""))];
  const lotStatusOptions = ["Any", ...uniqueOptions(listings.map((l) => (l.lot as string) || ""))];

  const switchSegment = (segment: ListingSegment) => {
    setActiveSegment(segment);
    Animated.timing(segmentAnim, {
      toValue: segment === "mine" ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const resetCriteria = () => {
    setCriteriaLocation("");
    setCriteriaPropertyType("Any");
    setCriteriaTenure("Any");
    setCriteriaLotStatus("Any");
    setCriteriaMinPrice("");
    setCriteriaMaxPrice("");
  };

  const scrollToFocusedOption = (
    ref: React.RefObject<ScrollView | null>,
    layouts: Record<string, { x: number; width: number }>,
    containerWidth: number,
    option: string
  ) => {
    const layout = layouts[option];
    if (!layout || !ref.current || containerWidth <= 0) return;
    const targetX = layout.x - (containerWidth / 2) + (layout.width / 2);
    ref.current.scrollTo({ x: Math.max(0, targetX), animated: true });
  };

  const handlePropertyTypeSelect = (option: string) => {
    setCriteriaPropertyType(option);
    scrollToFocusedOption(propertyTypeRef, propertyTypeLayouts.current, propertyTypeRowWidth, option);
  };

  const handleTenureSelect = (option: string) => {
    setCriteriaTenure(option);
    scrollToFocusedOption(tenureRef, tenureLayouts.current, tenureRowWidth, option);
  };

  const handleLotStatusSelect = (option: string) => {
    setCriteriaLotStatus(option);
    scrollToFocusedOption(lotStatusRef, lotStatusLayouts.current, lotStatusRowWidth, option);
  };

  const handleFilterPress = (filterId: string) => {
    setActiveFilter(filterId);

    const layout = chipLayouts.current[filterId];
    if (layout && scrollViewRef.current) {
      const targetX = layout.x - (scrollViewWidth / 2) + (layout.width / 2);
      scrollViewRef.current.scrollTo({
        x: Math.max(0, targetX),
        animated: true,
      });
    }
  };

  // Realtime Firestore Listener
  useEffect(() => {
    const currentUser = auth().currentUser;
    const userId = currentUser?.uid;

    if (!userId) {
      setCurrentUserId("");
      setIsLoading(false);
      return;
    }
    setCurrentUserId(userId);

    const unsubscribe = firestore()
      .collection("listings")
      .onSnapshot(
        (snapshot) => {
          if (snapshot) {
            const data = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as PropertyListing[];

            data.sort((a, b) =>
              (b.createdAt || "").localeCompare(a.createdAt || "")
            );

            setListings(data);
          }
          setIsLoading(false);
          setIsRefreshing(false);
        },
        (error) => {
          console.error("Realtime listings error:", error);
          setIsLoading(false);
          setIsRefreshing(false);
        }
      );

    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const currentUser = auth().currentUser;
      setCurrentUserId(currentUser?.uid || "");
      const snapshot = await firestore().collection("listings").get();
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PropertyListing[];
      data.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setListings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const myListingsCount = listings.filter((item) => isListingOwnedByUser(item, currentUserId)).length;
  const allListingsCount = listings.length;

  const activeCriteriaSummary: string[] = [];
  if (criteriaLocation.trim()) activeCriteriaSummary.push(criteriaLocation.trim());
  const criteriaPriceParts = [criteriaMinPrice.trim(), criteriaMaxPrice.trim()].filter(Boolean);
  if (criteriaPriceParts.length) activeCriteriaSummary.push(`RM ${criteriaPriceParts.join(" - ")}`);
  if (criteriaPropertyType !== "Any") activeCriteriaSummary.push(criteriaPropertyType);
  if (criteriaTenure !== "Any") activeCriteriaSummary.push(criteriaTenure);
  if (criteriaLotStatus !== "Any") activeCriteriaSummary.push(criteriaLotStatus);

  const buyerCriteriaCount = activeCriteriaSummary.length;
  const hasBuyerCriteriaActive = buyerCriteriaCount > 0;
  const hasAnyFilterActive =
    hasBuyerCriteriaActive || searchQuery.trim().length > 0 || activeFilter !== "Semua";

  const clearAllFilters = () => {
    resetCriteria();
    setSearchQuery("");
    handleFilterPress("Semua");
  };

  // Segment + Filter + Search Logic
  const filteredListings = listings.filter((item: PropertyListing) => {
    if (activeSegment === "mine" && !isListingOwnedByUser(item, currentUserId)) return false;

    if (activeFilter !== "Semua") {
      const status = (item.status || "").toString().toLowerCase().trim();
      if (activeFilter === "Sold" && status !== "terjual" && status !== "sold") return false;
      if (activeFilter === "Booking" && status !== "draft" && status !== "booking") return false;
      if (activeFilter === "Aktif" && status !== "aktif" && status !== "active") return false;
      if (activeFilter === "Draft" && status !== "draft") return false;
    }

    if (criteriaLocation.trim()) {
      const locationQuery = criteriaLocation.toLowerCase().trim();
      const alamat = (item.alamat || "").toLowerCase();
      const negeri = (item.negeri || "").toLowerCase();
      if (!alamat.includes(locationQuery) && !negeri.includes(locationQuery)) {
        return false;
      }
    }

    if (criteriaPropertyType !== "Any" && item.jenis !== criteriaPropertyType) {
      return false;
    }

    if (criteriaTenure !== "Any" && (item.pegangan || "") !== criteriaTenure) {
      return false;
    }

    if (criteriaLotStatus !== "Any" && (item.lot || "") !== criteriaLotStatus) {
      return false;
    }

    const minPrice = parsePriceNumber(criteriaMinPrice);
    const maxPrice = parsePriceNumber(criteriaMaxPrice);
    if (minPrice !== null || maxPrice !== null) {
      const itemPrice = parsePriceNumber(item.harga);
      if (itemPrice === null) return false;
      if (minPrice !== null && itemPrice < minPrice) return false;
      if (maxPrice !== null && itemPrice > maxPrice) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTajuk = (item.tajuk || "").toLowerCase().includes(q);
      const matchAlamat = (item.alamat || "").toLowerCase().includes(q);
      const matchNegeri = (item.negeri || "").toLowerCase().includes(q);
      return matchTajuk || matchAlamat || matchNegeri;
    }
    return true;
  });
  const sortedListings = [...filteredListings].sort((a, b) => compareListings(a, b, sortOption));

  // 1-Click Share (Kongsi) Handler
  const handleShare = async (item: PropertyListing) => {
    try {
      const formattedPrice =
        typeof item.harga === "number"
          ? item.harga.toLocaleString()
          : item.harga;

      const sizeStr = item.keluasan
        ? (String(item.keluasan).toLowerCase().includes("sq") ? item.keluasan : `${item.keluasan} sqft`)
        : "N/A";

      const message =
        `WTS: ${item.tajuk}\n` +
        `Harga: RM ${formattedPrice}\n` +
        `Lokasi: ${item.alamat ? `${item.alamat}, ` : ""}${item.negeri}\n` +
        `Spesifikasi: ${item.bilikTidur} Bilik, ${item.bilikAir} Bilik Air | ${sizeStr}\n` +
        `Status: ${item.pegangan || "Freehold"} / ${item.lot || "Bumi Lot"}\n\n` +
        `Berminat? Hubungi saya segera untuk viewing!`;

      await Share.share({
        message,
        title: `Listing: ${item.tajuk}`,
      });
    } catch (error) {
      console.error("Error sharing listing:", error);
    }
  };

  const renderStatusBadge = (status: string) => {
    let bg = themeColors.statusAktifBg;
    let text = themeColors.statusAktifText;
    let label = status;
    const normalizedStatus = status.toLowerCase().trim();

    if (normalizedStatus === "draft") {
      bg = themeColors.statusDraftBg;
      text = themeColors.statusDraftText;
      label = "Booking";
    } else if (normalizedStatus === "terjual" || normalizedStatus === "sold") {
      bg = themeColors.statusSoldBg;
      text = themeColors.statusSoldText;
      label = "Sold";
    } else if (normalizedStatus === "aktif" || normalizedStatus === "active") {
      bg = themeColors.statusAktifBg;
      text = themeColors.statusAktifText;
      label = t("statusAktif");
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <Text style={[styles.statusText, { color: text }]}>{label}</Text>
      </View>
    );
  };

  const renderListingCard = ({ item }: { item: PropertyListing }) => {
    const imageUri = getListingImageUri(item);
    const locationLabel =
      [item.alamat, item.negeri].map((part) => (part || "").trim()).filter(Boolean).join(", ") ||
      "Lokasi tiada";
    const sizeLabel = formatSizeLabel(item.keluasan);

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          if (!item?.id) return;
          router.push(`/listing/${item.id}` as any);
        }}
        style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
      >
        <View style={styles.cardMainRow}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnailPlaceholder, { backgroundColor: themeColors.maroonLight, borderColor: themeColors.maroonBorder }]}>
              <MaterialCommunityIcons
                name="home-city-outline"
                size={34}
                color={themeColors.maroonPrimary}
              />
            </View>
          )}

          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
              {item.tajuk}
            </Text>

            <Text style={[styles.cardPrice, { color: themeColors.maroonPrimary }]} numberOfLines={1}>
              {formatPriceLabel(item.harga)}
            </Text>

            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={14} color={themeColors.textMuted} />
              <Text style={[styles.cardLocation, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {locationLabel}
              </Text>
            </View>

            <View style={styles.specsRow}>
              <View style={styles.specItem}>
                <MaterialCommunityIcons name="bed" size={15} color={themeColors.textMuted} />
                <Text style={[styles.specText, { color: themeColors.textMuted }]}>{item.bilikTidur || 0}</Text>
              </View>

              <View style={styles.specItem}>
                <MaterialCommunityIcons name="shower" size={15} color={themeColors.textMuted} />
                <Text style={[styles.specText, { color: themeColors.textMuted }]}>{item.bilikAir || 0}</Text>
              </View>

              {sizeLabel ? (
                <View style={styles.specItem}>
                  <MaterialCommunityIcons name="vector-square" size={14} color={themeColors.textMuted} />
                  <Text style={[styles.specText, { color: themeColors.textMuted }]} numberOfLines={1}>
                    {sizeLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.cardActionRow, { borderTopColor: themeColors.borderColor }]}>
          {renderStatusBadge(item.status || "Aktif")}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleShare(item)}
            accessibilityLabel={`${t("shareBtn")}: ${item.tajuk}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.shareButton, { backgroundColor: themeColors.maroonLight, borderColor: themeColors.maroonBorder }]}
          >
            <MaterialCommunityIcons name="share-variant" size={15} color={themeColors.maroonPrimary} />
            <Text style={[styles.shareButtonText, { color: themeColors.maroonPrimary }]}>{t("shareBtn")}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const filterChips = [
    { id: "Semua", label: t("filterSemua") },
    { id: "Aktif", label: t("filterAktif") },
    { id: "Booking", label: t("filterBooking") },
    { id: "Sold", label: t("filterSold") },
    { id: "Draft", label: t("filterDraft") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground, alignItems: "center" }}>
      <View style={{ width: "100%", maxWidth: contentMaxWidth, flex: 1 }}>
        {/* TopAppBar */}
        <View
          style={[
            styles.stickyHeader,
            {
              backgroundColor: themeColors.cardBackground,
              borderBottomColor: themeColors.borderColor,
              paddingTop: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6,
            },
          ]}
        >
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, { color: themeColors.maroonPrimary, flex: 1 }]}>
            {t("masterListing")}
          </Text>

          <TouchableOpacity style={[styles.iconButton, { backgroundColor: themeColors.surfaceContainer }]}>
            <MaterialCommunityIcons name="magnify" size={24} color={themeColors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search Input Below TopAppBar */}
        <View style={styles.searchBarContainer}>
          <View style={[styles.searchBar, { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.textPrimary }]}
              placeholder={t("searchPlaceholder")}
              placeholderTextColor={themeColors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <MaterialCommunityIcons name="close-circle" size={18} color={themeColors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.criteriaActionRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowCriteria((prev) => !prev)}
              accessibilityLabel={
                hasBuyerCriteriaActive
                  ? `Buyer criteria, ${buyerCriteriaCount} applied`
                  : "Buyer criteria filters"
              }
              style={[
                styles.criteriaToggleBtn,
                {
                  borderColor: hasBuyerCriteriaActive ? themeColors.maroonPrimary : themeColors.borderColor,
                  backgroundColor:
                    showCriteria || hasBuyerCriteriaActive ? themeColors.maroonLight : themeColors.surfaceContainer,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={hasBuyerCriteriaActive ? "filter-check-outline" : "tune-variant"}
                size={16}
                color={themeColors.maroonPrimary}
              />
              <Text style={[styles.criteriaToggleText, { color: themeColors.maroonPrimary }]}>Buyer Criteria</Text>
              {hasBuyerCriteriaActive ? (
                <View style={[styles.criteriaCountBadge, { backgroundColor: themeColors.maroonPrimary }]}>
                  <Text style={[styles.criteriaCountText, { color: themeColors.cardBackground }]}>
                    {buyerCriteriaCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>

            {hasBuyerCriteriaActive ? (
              <TouchableOpacity onPress={resetCriteria} style={styles.criteriaClearBtn}>
                <Text style={[styles.criteriaClearText, { color: themeColors.textSecondary }]}>Reset</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {hasBuyerCriteriaActive && !showCriteria ? (
            <Text style={[styles.criteriaSummaryText, { color: themeColors.textMuted }]} numberOfLines={1}>
              {activeCriteriaSummary.join(" · ")}
            </Text>
          ) : null}

          {showCriteria ? (
            <View style={[styles.criteriaPanel, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}> 
              <TextInput
                style={[styles.criteriaInput, { borderColor: themeColors.borderColor, color: themeColors.textPrimary, backgroundColor: themeColors.surfaceContainer }]}
                placeholder="Location"
                placeholderTextColor={themeColors.textMuted}
                value={criteriaLocation}
                onChangeText={setCriteriaLocation}
              />

              <View style={styles.criteriaPriceRow}>
                <TextInput
                  style={[styles.criteriaInput, styles.criteriaHalfInput, { borderColor: themeColors.borderColor, color: themeColors.textPrimary, backgroundColor: themeColors.surfaceContainer }]}
                  placeholder="Min RM"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={criteriaMinPrice}
                  onChangeText={setCriteriaMinPrice}
                />
                <TextInput
                  style={[styles.criteriaInput, styles.criteriaHalfInput, { borderColor: themeColors.borderColor, color: themeColors.textPrimary, backgroundColor: themeColors.surfaceContainer }]}
                  placeholder="Max RM"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={criteriaMaxPrice}
                  onChangeText={setCriteriaMaxPrice}
                />
              </View>

              <View style={styles.criteriaCategoryBlock}>
                <Text style={[styles.criteriaCategoryLabel, { color: themeColors.textPrimary }]}>Property Type</Text>
                <ScrollView
                  ref={propertyTypeRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.criteriaRowContent}
                  onLayout={(e) => setPropertyTypeRowWidth(e.nativeEvent.layout.width)}
                >
                  {propertyTypeOptions.map((option) => {
                    const active = criteriaPropertyType === option;
                    return (
                      <View
                        key={`ptype-${option}`}
                        onLayout={(e) => {
                          propertyTypeLayouts.current[option] = {
                            x: e.nativeEvent.layout.x,
                            width: e.nativeEvent.layout.width,
                          };
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => handlePropertyTypeSelect(option)}
                          style={[
                            styles.criteriaPill,
                            {
                              borderColor: active ? "#FF5F87" : themeColors.borderColor,
                              backgroundColor: active ? "#FF5F87" : themeColors.surfaceContainer,
                            },
                          ]}
                        >
                          <Text style={[styles.criteriaPillText, { color: active ? "#FFFFFF" : themeColors.textMuted }]}>{option}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.criteriaCategoryBlock}>
                <Text style={[styles.criteriaCategoryLabel, { color: themeColors.textPrimary }]}>Tenure Type</Text>
                <ScrollView
                  ref={tenureRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.criteriaRowContent}
                  onLayout={(e) => setTenureRowWidth(e.nativeEvent.layout.width)}
                >
                  {tenureOptions.map((option) => {
                    const active = criteriaTenure === option;
                    return (
                      <View
                        key={`tenure-${option}`}
                        onLayout={(e) => {
                          tenureLayouts.current[option] = {
                            x: e.nativeEvent.layout.x,
                            width: e.nativeEvent.layout.width,
                          };
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => handleTenureSelect(option)}
                          style={[
                            styles.criteriaPill,
                            {
                              borderColor: active ? "#FF5F87" : themeColors.borderColor,
                              backgroundColor: active ? "#FF5F87" : themeColors.surfaceContainer,
                            },
                          ]}
                        >
                          <Text style={[styles.criteriaPillText, { color: active ? "#FFFFFF" : themeColors.textMuted }]}>{option}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.criteriaCategoryBlock}>
                <Text style={[styles.criteriaCategoryLabel, { color: themeColors.textPrimary }]}>Lot Status</Text>
                <ScrollView
                  ref={lotStatusRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.criteriaRowContent}
                  onLayout={(e) => setLotStatusRowWidth(e.nativeEvent.layout.width)}
                >
                  {lotStatusOptions.map((option) => {
                    const active = criteriaLotStatus === option;
                    return (
                      <View
                        key={`lot-${option}`}
                        onLayout={(e) => {
                          lotStatusLayouts.current[option] = {
                            x: e.nativeEvent.layout.x,
                            width: e.nativeEvent.layout.width,
                          };
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => handleLotStatusSelect(option)}
                          style={[
                            styles.criteriaPill,
                            {
                              borderColor: active ? "#FF5F87" : themeColors.borderColor,
                              backgroundColor: active ? "#FF5F87" : themeColors.surfaceContainer,
                            },
                          ]}
                        >
                          <Text style={[styles.criteriaPillText, { color: active ? "#FFFFFF" : themeColors.textMuted }]}>{option}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          ) : null}
        </View>

        <View
          style={[styles.segmentWrap, { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor }]}
          onLayout={(e) => setSegmentBarWidth(e.nativeEvent.layout.width)}
        >
          {segmentBarWidth > 0 ? (
            <Animated.View
              style={[
                styles.segmentIndicator,
                {
                  width: segmentBarWidth / 2,
                  backgroundColor: themeColors.maroonPrimary,
                  transform: [
                    {
                      translateX: segmentAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, segmentBarWidth / 2],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}

          <TouchableOpacity style={styles.segmentBtn} onPress={() => switchSegment("mine")}> 
            <Text style={[styles.segmentText, { color: activeSegment === "mine" ? "#FFFFFF" : themeColors.textSecondary }]}>{t("myListings")} ({myListingsCount})</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.segmentBtn} onPress={() => switchSegment("all")}>
            <Text style={[styles.segmentText, { color: activeSegment === "all" ? "#FFFFFF" : themeColors.textSecondary }]}>{t("allListings")} ({allListingsCount})</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Chips ScrollView */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
          onLayout={(e) => setScrollViewWidth(e.nativeEvent.layout.width)}
        >
          {filterChips.map((chip) => {
            const active = activeFilter === chip.id;
            return (
              <View
                key={chip.id}
                style={{ marginRight: 8 }}
                onLayout={(e) => {
                  chipLayouts.current[chip.id] = {
                    x: e.nativeEvent.layout.x,
                    width: e.nativeEvent.layout.width,
                  };
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleFilterPress(chip.id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                      borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? "#FFFFFF" : themeColors.textSecondary },
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.toolbarRow}>
          <Text style={[styles.resultCountText, { color: themeColors.textPrimary }]}>
            {filteredListings.length} {filteredListings.length === 1 ? "listing" : "listings"}
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsSortModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`Sort listings by ${LISTING_SORT_OPTIONS.find((option) => option.id === sortOption)?.label}`}
            style={[styles.sortButton, { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor }]}
          >
            <MaterialCommunityIcons name="sort-calendar-ascending" size={16} color={themeColors.textMuted} />
            <Text style={[styles.sortButtonText, { color: themeColors.textSecondary }]}>
              {LISTING_SORT_OPTIONS.find((option) => option.id === sortOption)?.label}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={themeColors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Property FlatList */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
          <Text style={[styles.loadingText, { color: themeColors.textMuted }]}>{t("masterListing")}...</Text>
        </View>
      ) : (
        <FlatList
          data={sortedListings}
          keyExtractor={(item) => item.id}
          renderItem={renderListingCard}
          style={{ flex: 1, width: "100%" }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 24) + 132,
          }}
          scrollIndicatorInsets={{ bottom: Math.max(insets.bottom, 24) + 132 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[themeColors.maroonPrimary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name={hasAnyFilterActive ? "home-search-outline" : activeSegment === "mine" ? "home-plus-outline" : "home-city-outline"}
                size={56}
                color={themeColors.maroonPrimary}
              />
              <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                {hasAnyFilterActive
                  ? "No matching listings"
                  : activeSegment === "mine"
                    ? "No listings in My Listings"
                    : "No Listings found"}
              </Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textMuted }]}>
                {activeSegment === "mine"
                  ? (hasAnyFilterActive
                    ? "No results match your filters in My Listings."
                    : "You haven't added any listings yet.")
                   : (hasAnyFilterActive
                     ? "No listings found matching your criteria."
                     : "No listings available right now.")}
              </Text>

              {hasAnyFilterActive ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={clearAllFilters}
                  style={[styles.emptyResetBtn, { backgroundColor: themeColors.maroonPrimary }]}
                >
                  <Text style={[styles.emptyResetText, { color: themeColors.cardBackground }]}>
                    {t("tryResettingFilters")}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      </View>

      <Modal
        visible={isSortModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSortModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsSortModalVisible(false)}
          style={styles.sortModalOverlay}
        >
          <View style={[styles.sortModalSheet, { backgroundColor: themeColors.cardBackground }]}>
            <View style={[styles.sortModalHandle, { backgroundColor: themeColors.borderColor }]} />
            <Text style={[styles.sortModalTitle, { color: themeColors.textPrimary }]}>Sort listings</Text>
            {LISTING_SORT_OPTIONS.map((option) => {
              const active = sortOption === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSortOption(option.id);
                    setIsSortModalVisible(false);
                  }}
                  style={[
                    styles.sortOptionRow,
                    {
                      backgroundColor: active ? themeColors.maroonLight : "transparent",
                      borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.sortOptionText, { color: active ? themeColors.maroonPrimary : themeColors.textSecondary }]}>
                    {option.label}
                  </Text>
                  {active ? <MaterialCommunityIcons name="check" size={18} color={themeColors.maroonPrimary} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/tambah" as any)}
        activeOpacity={0.9}
        style={{
          position: "absolute",
          right: fabRight,
          bottom: Math.max(insets.bottom, 8) + 16,
          height: 52,
          paddingHorizontal: 18,
          borderRadius: 26,
          backgroundColor: themeColors.maroonPrimary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          elevation: 5,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          zIndex: 999,
        }}
      >
        <MaterialCommunityIcons name="plus" size={22} color="#FFF" />
        <Text style={styles.fabLabel}>{t("addListing")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyHeader: {
    borderBottomWidth: 1,
    elevation: 3,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  iconButton: {
    padding: 6,
    borderRadius: 20,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  criteriaActionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 6,
  },
  criteriaToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  criteriaToggleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  criteriaClearBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  criteriaClearText: {
    fontSize: 11,
    fontWeight: "600",
  },
  criteriaCountBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  criteriaCountText: {
    fontSize: 10,
    fontWeight: "800",
  },
  criteriaSummaryText: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resultCountText: {
    fontSize: 13,
    fontWeight: "800",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sortModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sortModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
  },
  sortModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sortModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  sortOptionRow: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  fabLabel: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 6,
  },
  criteriaPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  criteriaInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  criteriaPriceRow: {
    flexDirection: "row",
    gap: 8,
  },
  criteriaHalfInput: {
    flex: 1,
  },
  criteriaCategoryBlock: {
    width: "100%",
    marginTop: 2,
    marginBottom: 4,
  },
  criteriaCategoryLabel: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  criteriaRowContent: {
    gap: 8,
    paddingRight: 8,
  },
  criteriaPill: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  criteriaPillText: {
    fontSize: 13,
    fontWeight: "800",
  },
  segmentWrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    position: "relative",
    overflow: "hidden",
  },
  segmentIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 14,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "700",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  filterScrollView: {
    flexDirection: "row",
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipActive: {},
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    fontWeight: "700",
  },
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardMainRow: {
    flexDirection: "row",
    gap: 12,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  cardLocation: {
    flex: 1,
    fontSize: 12,
  },
  specsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 7,
  },
  specItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  specText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  shareButtonText: {
    fontSize: 11,
    fontWeight: "800",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  emptyResetBtn: {
    marginTop: 16,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyResetText: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
});
