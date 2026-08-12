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
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useRouter } from "expo-router";
import type { PropertyListing } from "@/types/listing";
import { useAppSettings } from "@/context/AppSettingsContext";

const SEGMENTS = ["mine", "team"] as const;
type ListingSegment = typeof SEGMENTS[number];

function getOwnerId(item: Partial<PropertyListing>): string {
  return ((item.userId || item.agentId || "") as string).trim();
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

  const myListingsCount = listings.filter((item) => getOwnerId(item) === currentUserId).length;
  const coAgentListingsCount = listings.filter((item) => getOwnerId(item) !== currentUserId).length;

  const hasBuyerCriteriaActive =
    criteriaLocation.trim().length > 0 ||
    criteriaPropertyType !== "Any" ||
    criteriaTenure !== "Any" ||
    criteriaLotStatus !== "Any" ||
    criteriaMinPrice.trim().length > 0 ||
    criteriaMaxPrice.trim().length > 0;

  // Segment + Filter + Search Logic
  const filteredListings = listings.filter((item: PropertyListing) => {
    const ownerId = getOwnerId(item);

    if (activeSegment === "mine" && ownerId !== currentUserId) return false;
    if (activeSegment === "team" && ownerId === currentUserId) return false;

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

    if (status === "Draft") {
      bg = themeColors.statusDraftBg;
      text = themeColors.statusDraftText;
      label = "Booking";
    } else if (status === "Terjual" || status === "Sold") {
      bg = themeColors.statusSoldBg;
      text = themeColors.statusSoldText;
      label = "Sold";
    } else if (status === "Aktif") {
      bg = themeColors.statusAktifBg;
      text = themeColors.statusAktifText;
      label = "Aktif";
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <Text style={[styles.statusText, { color: text }]}>{label}</Text>
      </View>
    );
  };

  const renderListingCard = ({ item }: { item: PropertyListing }) => {
    const imageUri = getListingImageUri(item);
    const formattedPrice =
      typeof item.harga === "number"
        ? item.harga.toLocaleString()
        : item.harga;

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          if (!item?.id) return;
          router.push(`/listing/${item.id}` as any);
        }}
        style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
      >
        {renderStatusBadge(item.status || "Aktif")}

        <View style={styles.cardMainRow}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnailPlaceholder, { backgroundColor: themeColors.maroonLight }]}>
              <MaterialCommunityIcons
                name="home-city-outline"
                size={34}
                color={themeColors.maroonPrimary}
              />
            </View>
          )}

          <View style={styles.cardContent}>
            <View>
              <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                {item.tajuk}
              </Text>
              <Text style={[styles.cardPrice, { color: themeColors.maroonPrimary }]}>
                RM {formattedPrice}
              </Text>
            </View>

            <View style={styles.specsRow}>
              <View style={styles.specItem}>
                <MaterialCommunityIcons name="bed" size={16} color={themeColors.textSecondary} />
                <Text style={[styles.specText, { color: themeColors.textSecondary }]}>{item.bilikTidur || 0}</Text>
              </View>

              <View style={styles.specItem}>
                <MaterialCommunityIcons name="shower" size={16} color={themeColors.textSecondary} />
                <Text style={[styles.specText, { color: themeColors.textSecondary }]}>{item.bilikAir || 0}</Text>
              </View>

              {item.keluasan ? (
                <View style={styles.specItem}>
                  <MaterialCommunityIcons name="vector-square" size={15} color={themeColors.textSecondary} />
                  <Text style={[styles.specText, { color: themeColors.textSecondary }]}>{item.keluasan}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleShare(item)}
                style={[styles.shareButton, { backgroundColor: themeColors.maroonLight }]}
              >
                <MaterialCommunityIcons name="share-variant" size={16} color={themeColors.maroonPrimary} />
              </TouchableOpacity>
            </View>
          </View>
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
      <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
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
              style={[
                styles.criteriaToggleBtn,
                {
                  borderColor: themeColors.borderColor,
                  backgroundColor: showCriteria ? themeColors.maroonLight : themeColors.surfaceContainer,
                },
              ]}
            >
              <MaterialCommunityIcons name="tune-variant" size={16} color={themeColors.maroonPrimary} />
              <Text style={[styles.criteriaToggleText, { color: themeColors.maroonPrimary }]}>Buyer Criteria</Text>
            </TouchableOpacity>

            {hasBuyerCriteriaActive ? (
              <TouchableOpacity onPress={resetCriteria} style={styles.criteriaClearBtn}>
                <Text style={[styles.criteriaClearText, { color: themeColors.textSecondary }]}>Reset</Text>
              </TouchableOpacity>
            ) : null}
          </View>

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
            <Text style={[styles.segmentText, { color: activeSegment === "mine" ? "#FFFFFF" : themeColors.textSecondary }]}>My Listings ({myListingsCount})</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.segmentBtn} onPress={() => switchSegment("team")}> 
            <Text style={[styles.segmentText, { color: activeSegment === "team" ? "#FFFFFF" : themeColors.textSecondary }]}>Co-Agent Listings ({coAgentListingsCount})</Text>
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
      </View>

      {/* Main Property FlatList */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
          <Text style={[styles.loadingText, { color: themeColors.textMuted }]}>{t("masterListing")}...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredListings}
          keyExtractor={(item) => item.id}
          renderItem={renderListingCard}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 24) + 120,
          }}
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
                name={activeSegment === "mine" ? "home-plus-outline" : "account-group-outline"}
                size={56}
                color={themeColors.maroonPrimary}
              />
              <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                {activeSegment === "mine" ? "No listings in My Listings" : "No Co-Agent Listings found"}
              </Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textMuted }]}>
                {activeSegment === "mine"
                  ? (searchQuery || hasBuyerCriteriaActive
                    ? "No results match your filters in My Listings."
                    : "You haven't added any listings yet.")
                  : (searchQuery || hasBuyerCriteriaActive
                    ? "No co-agent listings found matching your criteria."
                    : "No co-agent listings available right now.")}
              </Text>
            </View>
          }
        />
      )}

      </View>

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/tambah" as any)}
        activeOpacity={0.9}
        style={{
          position: "absolute",
          right: fabRight,
          bottom: insets.bottom + 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: themeColors.maroonPrimary,
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
        <MaterialCommunityIcons name="plus" size={30} color="#FFF" />
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
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
    marginRight: 60,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },
  specsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 8,
  },
  specItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  specText: {
    fontSize: 13,
    fontWeight: "500",
  },
  shareButton: {
    marginLeft: "auto",
    padding: 6,
    borderRadius: 8,
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
});
