import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Share,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
  StatusBar,
  Animated,
  Modal,
  Linking,
  AppState,
  AppStateStatus,
  useWindowDimensions,
  ToastAndroid,
  NativeModules,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import * as IntentLauncher from "expo-intent-launcher";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { firestore, auth } from "@/services/firebase";
import { useRouter } from "expo-router";
import type { PropertyListing } from "@/types/listing";
import { useDebounce } from "@/hooks/useDebounce";
import { useAppSettings } from "@/context/AppSettingsContext";
import { ListingSkeleton } from "@/components/ListingSkeleton";

const STATE_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  "kuala lumpur": { latitude: 3.139, longitude: 101.6869 },
  "selangor": { latitude: 3.0738, longitude: 101.5183 },
  "putrajaya": { latitude: 2.9264, longitude: 101.6964 },
  "perak": { latitude: 4.5921, longitude: 101.0901 },
  "penang": { latitude: 5.4164, longitude: 100.3327 },
  "pulau pinang": { latitude: 5.4164, longitude: 100.3327 },
  "johor": { latitude: 1.4927, longitude: 103.7414 },
  "kedah": { latitude: 6.1184, longitude: 100.3685 },
  "kelantan": { latitude: 6.1254, longitude: 102.2381 },
  "melaka": { latitude: 2.1896, longitude: 102.2501 },
  "malacca": { latitude: 2.1896, longitude: 102.2501 },
  "negeri sembilan": { latitude: 2.7258, longitude: 101.9424 },
  "pahang": { latitude: 3.8126, longitude: 103.3256 },
  "perlis": { latitude: 6.4449, longitude: 100.1986 },
  "sabah": { latitude: 5.9804, longitude: 116.0735 },
  "sarawak": { latitude: 1.5533, longitude: 110.3592 },
  "terengganu": { latitude: 5.3117, longitude: 103.1324 },
  "labuan": { latitude: 5.2831, longitude: 115.2308 },
};

function getListingCoordinates(item: PropertyListing, index: number): { latitude: number; longitude: number } {
  if (item.location && typeof item.location.latitude === "number" && typeof item.location.longitude === "number" && item.location.latitude !== 0) {
    return { latitude: item.location.latitude, longitude: item.location.longitude };
  }
  const negeri = (item.negeri || "").toLowerCase().trim();
  const base = STATE_COORDINATES[negeri] || { latitude: 3.139, longitude: 101.6869 };
  const offsetLat = ((index % 7) - 3) * 0.015 + ((item.id.charCodeAt(0) || 0) % 5) * 0.002;
  const offsetLng = (((index * 3) % 7) - 3) * 0.015 + ((item.id.charCodeAt(item.id.length - 1) || 0) % 5) * 0.002;
  return {
    latitude: base.latitude + offsetLat,
    longitude: base.longitude + offsetLng,
  };
}

function formatCompactPrice(value: string | number | undefined): string {
  const parsed = parsePriceNumber(value);
  if (parsed === null) return "RM --";
  if (parsed >= 1000000) {
    const val = (parsed / 1000000).toFixed(1).replace(/\.0$/, "");
    return `RM ${val}M`;
  }
  if (parsed >= 1000) {
    const val = (parsed / 1000).toFixed(0);
    return `RM ${val}k`;
  }
  return `RM ${parsed}`;
}

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

function formatListingDate(dateStr?: string, lang: string = "EN"): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return lang === "BM" ? "Hari ini" : "Today";
    if (diffDays === 1) return lang === "BM" ? "Semalam" : "Yesterday";
    if (diffDays < 7) return lang === "BM" ? `${diffDays} hari lalu` : `${diffDays}d ago`;
    return d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function getListingImagesList(listing: any): string[] {
  if (!listing) return [];
  const list: string[] = [];
  const pushUnique = (value?: any) => {
    if (!value || typeof value !== "string") return;
    const cleaned = value.trim();
    if (!cleaned) return;
    if (!list.includes(cleaned)) {
      list.push(cleaned);
    }
  };

  pushUnique(listing.imageUrl);
  if (listing.images && listing.images.length > 0) {
    listing.images.forEach((img: any) => {
      pushUnique(img);
    });
  }
  if (listing.gambar) {
    if (Array.isArray(listing.gambar)) {
      listing.gambar.forEach((img: any) => {
        pushUnique(img);
      });
    } else if (typeof listing.gambar === "string") {
      pushUnique(listing.gambar);
    }
  }
  return list;
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
  const { themeColors, t, language } = useAppSettings();
  const contentMaxWidth = Math.min(width, 760);
  const fabRight = Math.max(20, (width - contentMaxWidth) / 2 + 20);

  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [activeFilter, setActiveFilter] = useState("Aktif");
  const [activeSegment, setActiveSegment] = useState<ListingSegment>("all");
  const [sortOption, setSortOption] = useState<ListingSortOption>("newest");
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [statusModalListing, setStatusModalListing] = useState<{ id: string; currentStatus: string; tajuk: string } | null>(null);
  const [shareModalListing, setShareModalListing] = useState<PropertyListing | null>(null);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "map">("list");
  const [selectedMapListing, setSelectedMapListing] = useState<PropertyListing | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("Semua");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [renderFilterContent, setRenderFilterContent] = useState(false);
  const [listingLimit, setListingLimit] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const masterMapRef = useRef<MapView>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);

  // Smart Auto-Hide FAB on Scroll
  const fabAnim = useRef(new Animated.Value(0)).current; // 0 = visible, 1 = hidden
  const lastScrollY = useRef(0);
  const isFabHidden = useRef(false);

  const showFab = () => {
    if (isFabHidden.current) {
      isFabHidden.current = false;
      Animated.spring(fabAnim, {
        toValue: 0,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }).start();
    }
  };

  const hideFab = () => {
    if (!isFabHidden.current) {
      isFabHidden.current = true;
      Animated.timing(fabAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleListScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;

    if (currentY <= 20) {
      showFab();
    } else if (diff > 10) {
      hideFab();
    } else if (diff < -10) {
      showFab();
    }
    lastScrollY.current = currentY;
  };

  const handleLocateMeOnMasterMap = async () => {
    try {
      setIsLocatingUser(true);
      Haptics.selectionAsync().catch(() => {});
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          language === "BM" ? "Kebenaran Ditolak" : "Permission Denied",
          language === "BM" ? "Sila benarkan akses lokasi dalam tetapan peranti anda." : "Please grant location access in device settings."
        );
        setIsLocatingUser(false);
        return;
      }

      let userCoords: { latitude: number; longitude: number } | null = null;
      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
      if (lastKnown) {
        userCoords = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
        if (masterMapRef.current) {
          masterMapRef.current.animateToRegion(
            {
              ...userCoords,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            },
            500
          );
        }
      }

      const freshLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (freshLoc && masterMapRef.current) {
        masterMapRef.current.animateToRegion(
          {
            latitude: freshLoc.coords.latitude,
            longitude: freshLoc.coords.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          },
          600
        );
      }
    } catch (err: any) {
      console.warn("Locate me error:", err);
      Alert.alert(
        language === "BM" ? "Ralat Lokasi" : "Location Error",
        language === "BM" ? "Gagal mengesan lokasi semasa anda." : "Could not determine your current GPS location."
      );
    } finally {
      setIsLocatingUser(false);
    }
  };

  useEffect(() => {
    if (isFilterModalVisible) {
      const timer = setTimeout(() => setRenderFilterContent(true), 200);
      return () => clearTimeout(timer);
    } else {
      setRenderFilterContent(false);
    }
  }, [isFilterModalVisible]);

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

  const segmentAnim = useRef(new Animated.Value(1)).current;
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
    if (viewMode === "map") {
      setViewMode("list");
      setSelectedMapListing(null);
    }
    Haptics.selectionAsync().catch(() => {});
    Animated.timing(segmentAnim, {
      toValue: segment === "mine" ? 0 : 1,
      duration: 140,
      useNativeDriver: true,
    }).start();
  };

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem("@umi_recent_searches");
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {}
  };

  const saveRecentSearch = async (query: string) => {
    const clean = query.trim();
    if (!clean || clean.length < 2) return;
    try {
      const updated = [clean, ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
      setRecentSearches(updated);
      await AsyncStorage.setItem("@umi_recent_searches", JSON.stringify(updated));
    } catch {}
  };

  const clearRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem("@umi_recent_searches");
    } catch {}
  };

  useEffect(() => {
    loadRecentSearches();
  }, []);

  useEffect(() => {
    if (debouncedSearch && debouncedSearch.trim().length >= 2) {
      saveRecentSearch(debouncedSearch);
    }
  }, [debouncedSearch]);

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

  // Lifecycle-aware Realtime Firestore Listener (Saves Battery when backgrounded)
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const attachListener = () => {
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;

      if (!userId) {
        setCurrentUserId("");
        setIsLoading(false);
        return;
      }
      setCurrentUserId(userId);

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }

      unsubscribeSnapshot = firestore()
        .collection("publicListings")
        .orderBy("createdAt", "desc")
        .limit(listingLimit)
        .onSnapshot(
          (snapshot) => {
            if (snapshot) {
              const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as PropertyListing[];

              setListings(data);
            }
            setIsLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
          },
          (error) => {
            console.error("Realtime listings error:", error);
            setIsLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
          }
        );
    };

    const detachListener = () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
    };

    // Attach immediately
    attachListener();

    // Listen to background/foreground transitions to preserve battery
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        attachListener();
      } else {
        detachListener();
      }
    });

    return () => {
      detachListener();
      subscription.remove();
    };
  }, [listingLimit]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const currentUser = auth().currentUser;
      setCurrentUserId(currentUser?.uid || "");
      const snapshot = await firestore().collection("publicListings").get();
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

  const myListingsCount = useMemo(
    () => listings.filter((item) => isListingOwnedByUser(item, currentUserId)).length,
    [listings, currentUserId]
  );
  const allListingsCount = listings.length;

  // Compute active filter count for badge (Aktif is the natural default, so count is 0)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilter !== "Aktif") count++;
    if (categoryFilter !== "Semua") count++;
    if (criteriaLocation.trim()) count++;
    if (criteriaMinPrice.trim() || criteriaMaxPrice.trim()) count++;
    if (criteriaPropertyType !== "Any") count++;
    if (criteriaTenure !== "Any") count++;
    if (criteriaLotStatus !== "Any") count++;
    return count;
  }, [activeFilter, categoryFilter, criteriaLocation, criteriaMinPrice, criteriaMaxPrice, criteriaPropertyType, criteriaTenure, criteriaLotStatus]);

  const hasAnyFilterActive = activeFilterCount > 0 || searchQuery.trim().length > 0;

  const clearAllFilters = () => {
    resetCriteria();
    setSearchQuery("");
    setActiveFilter("Aktif");
    setCategoryFilter("Semua");
  };

  // Segment + Filter + Search Logic (Memoized for max performance)
  const filteredListings = useMemo(() => {
    return listings.filter((item: PropertyListing) => {
      if (activeSegment === "mine" && !isListingOwnedByUser(item, currentUserId)) return false;

      // Draft listings are private — only visible to their owner
      const rawStatus = (item.status || "").toString().toLowerCase().trim();
      if (rawStatus === "draft" && !isListingOwnedByUser(item, currentUserId)) return false;

      if (activeFilter !== "Semua") {
        const status = (item.status || "").toString().toLowerCase().trim();
        if (activeFilter === "Sold" && status !== "terjual" && status !== "sold") return false;
        if (activeFilter === "Booking" && status !== "draft" && status !== "booking") return false;
        if (activeFilter === "Aktif" && status !== "aktif" && status !== "active") return false;
        if (activeFilter === "Draft" && status !== "draft") return false;
      }

      if (categoryFilter !== "Semua") {
        const jenis = (item.jenis || "").toLowerCase();
        const tajuk = (item.tajuk || "").toLowerCase();
        if (categoryFilter === "Landed" && !jenis.includes("teres") && !jenis.includes("semi") && !jenis.includes("banglo") && !jenis.includes("townhouse") && !jenis.includes("landed") && !tajuk.includes("teres")) return false;
        if (categoryFilter === "High-Rise" && !jenis.includes("kondo") && !jenis.includes("condo") && !jenis.includes("apartment") && !jenis.includes("flat") && !jenis.includes("serviced") && !tajuk.includes("kondo")) return false;
        if (categoryFilter === "Commercial" && !jenis.includes("kedai") && !jenis.includes("shop") && !jenis.includes("office") && !jenis.includes("pejabat") && !jenis.includes("commercial") && !tajuk.includes("kedai")) return false;
        if (categoryFilter === "Tanah" && !jenis.includes("tanah") && !jenis.includes("land") && !tajuk.includes("tanah") && !tajuk.includes("lot")) return false;
        if (categoryFilter === "Industri" && !jenis.includes("kilang") && !jenis.includes("factory") && !jenis.includes("warehouse") && !jenis.includes("industri") && !tajuk.includes("kilang")) return false;
        if (categoryFilter === "Sewa" && !jenis.includes("sewa") && !jenis.includes("rent") && !tajuk.includes("sewa") && !tajuk.includes("rent")) return false;
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
        const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const haystack = [
          item.tajuk || "",
          item.alamat || "",
          item.negeri || "",
          item.jenis || "",
          item.namaOwner || "",
        ].join(" ").toLowerCase();
        // ALL tokens must be present somewhere in the combined fields
        return tokens.every((token) => haystack.includes(token));
      }
      return true;
    });
  }, [
    listings,
    activeSegment,
    currentUserId,
    activeFilter,
    categoryFilter,
    criteriaLocation,
    criteriaPropertyType,
    criteriaTenure,
    criteriaLotStatus,
    criteriaMinPrice,
    criteriaMaxPrice,
    searchQuery,
  ]);

  const sortedListings = useMemo(() => {
    return [...filteredListings].sort((a, b) => compareListings(a, b, sortOption));
  }, [filteredListings, sortOption]);

  // Generate formatted listing message based on current language
  const getFormattedShareMessage = (item: PropertyListing) => {
    const formattedPrice =
      typeof item.harga === "number"
        ? item.harga.toLocaleString()
        : item.harga;

    const sizeStr = formatSizeLabel(item.keluasan) || "N/A";
    const isBM = language === "BM";

    if (isBM) {
      return (
        `WTS: ${item.tajuk}\n` +
        `Harga: RM ${formattedPrice}\n` +
        `Lokasi: ${item.alamat ? `${item.alamat}, ` : ""}${item.negeri || ""}\n` +
        `Spesifikasi: ${item.bilikTidur || 0} Bilik, ${item.bilikAir || 0} Bilik Air | ${sizeStr}\n` +
        `Status: ${item.pegangan || "Freehold"} / ${item.lot || "Bumi Lot"}\n\n` +
        `Berminat? Hubungi saya segera untuk maklumat lanjut dan viewing!`
      );
    }

    return (
      `FOR SALE: ${item.tajuk}\n` +
      `Price: RM ${formattedPrice}\n` +
      `Location: ${item.alamat ? `${item.alamat}, ` : ""}${item.negeri || ""}\n` +
      `Specs: ${item.bilikTidur || 0} Beds, ${item.bilikAir || 0} Baths | ${sizeStr}\n` +
      `Tenure: ${item.pegangan || "Freehold"} / ${item.lot || "Bumi Lot"}\n\n` +
      `Interested? Contact me now for more details and viewing appointment!`
    );
  };

  // 1-Click Share: Opens modern themed bottom sheet
  const handleShare = (item: PropertyListing) => {
    setShareModalListing(item);
  };

  const handleShareWhatsApp = async (item: PropertyListing) => {
    setShareModalListing(null);
    try {
      const message = getFormattedShareMessage(item);
      const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Share.share({ message, title: item.tajuk });
      }
    } catch (e) {
      console.error("WhatsApp share error:", e);
      const message = getFormattedShareMessage(item);
      await Share.share({ message, title: item.tajuk });
    }
  };

  // Helper to safely and quickly prepare image for sharing with caching
  const prepareListingImageForSharing = async (imgUri: string, index: number = 0): Promise<string> => {
    const cacheDir = FileSystem.cacheDirectory || "";
    
    if (imgUri.startsWith("http://") || imgUri.startsWith("https://")) {
      // Create a deterministic hash/filename so we reuse already downloaded images instantly
      let hash = 0;
      for (let i = 0; i < imgUri.length; i++) {
        hash = ((hash << 5) - hash) + imgUri.charCodeAt(i);
        hash |= 0;
      }
      const filename = `cached_img_${Math.abs(hash)}_${index}.jpg`;
      const targetPath = `${cacheDir}${filename}`;

      try {
        const info = await FileSystem.getInfoAsync(targetPath);
        if (info.exists && info.size > 0) {
          return targetPath;
        }
        const res = await FileSystem.downloadAsync(imgUri, targetPath);
        return res.uri;
      } catch (err) {
        console.warn("Fast image download failed:", err);
        return imgUri;
      }
    }

    if (imgUri.startsWith("data:image")) {
      const targetPath = `${cacheDir}share_b64_${Date.now()}_${index}.jpg`;
      const base64Data = imgUri.split(",")[1];
      if (base64Data) {
        await FileSystem.writeAsStringAsync(targetPath, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return targetPath;
      }
    }

    if (imgUri.startsWith("file://")) {
      return imgUri;
    }

    return imgUri;
  };

  const handleSharePhoto = async (item: PropertyListing) => {
    const allImages = getListingImagesList(item);
    if (allImages.length === 0) {
      Alert.alert(
        language === "BM" ? "Tiada Gambar" : "No Photo Available",
        language === "BM" ? "Listing ini tidak mempunyai gambar untuk dikongsi." : "This listing does not have any photos attached."
      );
      return;
    }

    setShareModalListing(null);
    setIsSharingImage(true);

    try {
      // 1. Auto-copy formatted listing message to clipboard and show toast
      const message = getFormattedShareMessage(item);
      try {
        await Clipboard.setStringAsync(message);
        if (Platform.OS === "android") {
          ToastAndroid.show(
            language === "BM"
              ? "📋 Maklumat listing telah disalin! Sila tampal dalam ruangan teks/kapsyen."
              : "📋 Listing details copied! Paste it in the caption/text field.",
            ToastAndroid.LONG
          );
        }
      } catch (clipErr) {
        console.warn("Clipboard copy failed:", clipErr);
      }

      // 2. Prepare all available listing photos (up to 12)
      const imagesToShare = allImages.slice(0, 12);
      const preparedUris = await Promise.all(
        imagesToShare.map((imgUri, idx) => prepareListingImageForSharing(imgUri, idx))
      );

      // 3. Multi-image Android sharing with native Parcelable Uri MultiShareModule
      if (Platform.OS === "android" && NativeModules.MultiShare) {
        try {
          await NativeModules.MultiShare.shareMultipleImages(
            preparedUris,
            item.tajuk || "Property Listing",
            message
          );
          return;
        } catch (nativeShareErr) {
          console.warn("Native MultiShare fallback:", nativeShareErr);
        }
      }

      // 4. Single photo share fallback via Sharing API
      const primaryUri = preparedUris[0];
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        await Sharing.shareAsync(primaryUri, {
          dialogTitle: item.tajuk || "Property Listing",
          mimeType: "image/jpeg",
          UTI: "public.jpeg",
        });
      } else {
        await Share.share({ message, title: item.tajuk });
      }
    } catch (e) {
      console.error("Photo share error:", e);
      Alert.alert(
        language === "BM" ? "Ralat Perkongsian" : "Share Error",
        language === "BM" ? "Gagal memproses gambar untuk dikongsi." : "Failed to prepare images for sharing."
      );
    } finally {
      setIsSharingImage(false);
    }
  };

  const handleShareGeneric = async (item: PropertyListing) => {
    setShareModalListing(null);
    try {
      const message = getFormattedShareMessage(item);
      await Share.share({
        message,
        title: item.tajuk,
      });
    } catch (e) {
      console.error("Generic share error:", e);
    }
  };

  const handleSelectStatus = async (newStatus: "Aktif" | "Booking" | "Sold" | "Draft") => {
    if (!statusModalListing) return;
    const { id } = statusModalListing;
    setStatusModalListing(null);

    // Optimistic UI update
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus as any } : l))
    );

    try {
      const now = new Date().toISOString();
      await Promise.all([
        firestore().collection("publicListings").doc(id).update({ status: newStatus, updatedAt: now }).catch(() => {}),
        firestore().collection("listings").doc(id).update({ status: newStatus, updatedAt: now }).catch(() => {}),
      ]);
    } catch (err) {
      console.error("Error updating listing status:", err);
    }
  };

  const renderStatusBadge = (item: PropertyListing, isOwner: boolean) => {
    const status = item.status || "Aktif";
    let bg = themeColors.statusAktifBg;
    let text = themeColors.statusAktifText;
    let label: string = status;
    const normalizedStatus = status.toLowerCase().trim();

    if (normalizedStatus === "draft") {
      bg = themeColors.statusDraftBg;
      text = themeColors.statusDraftText;
      label = "Draft";
    } else if (normalizedStatus === "booking") {
      bg = "rgba(245, 158, 11, 0.15)";
      text = "#F59E0B";
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

    const badge = (
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor: bg,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: isOwner ? 10 : 8,
            paddingVertical: 5,
            borderRadius: 8,
          },
        ]}
      >
        <Text style={[styles.statusText, { color: text }]}>{label}</Text>
        {isOwner ? (
          <MaterialCommunityIcons name="chevron-down" size={13} color={text} />
        ) : null}
      </View>
    );

    if (isOwner && item.id) {
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            setStatusModalListing({
              id: item.id,
              currentStatus: label,
              tajuk: item.tajuk || "",
            })
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {badge}
        </TouchableOpacity>
      );
    }

    return badge;
  };

  const renderListingCard = ({ item }: { item: PropertyListing }) => {
    const imageUri = getListingImageUri(item);
    const allImages = getListingImagesList(item);
    const locationLabel =
      [item.alamat, item.negeri].map((part) => (part || "").trim()).filter(Boolean).join(", ") ||
      "Lokasi tiada";
    const sizeLabel = formatSizeLabel(item.keluasan);

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          if (!item?.id) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push(`/listing/${item.id}` as any);
        }}
        style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
      >
        <View style={styles.cardMainRow}>
          <View style={{ position: "relative" }}>
            {imageUri ? (
              <ExpoImage
                source={{ uri: imageUri }}
                style={styles.thumbnail}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                recyclingKey={imageUri}
              />
            ) : (
              <View style={[styles.thumbnailPlaceholder, { backgroundColor: themeColors.maroonLight, borderColor: themeColors.maroonBorder }]}>
                <MaterialCommunityIcons
                  name="home-city-outline"
                  size={34}
                  color={themeColors.maroonPrimary}
                />
              </View>
            )}
            {allImages.length > 1 && (
              <View style={styles.cardPhotoCountBadge}>
                <MaterialCommunityIcons name="camera" size={10} color="#FFF" />
                <Text style={styles.cardPhotoCountText}>{allImages.length}</Text>
              </View>
            )}
          </View>

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
                  <Text style={[styles.specText, { color: themeColors.textMuted }] } numberOfLines={1}>
                    {sizeLabel}
                  </Text>
                </View>
              ) : null}

              {item.pegangan ? (
                <View style={[styles.specBadge, { backgroundColor: `${themeColors.maroonPrimary}14`, borderColor: `${themeColors.maroonPrimary}30` }]}>
                  <Text style={[styles.specBadgeText, { color: themeColors.maroonPrimary }]}>{item.pegangan}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.cardActionRow, { borderTopColor: themeColors.borderColor }]}>
          {renderStatusBadge(item, isListingOwnedByUser(item, currentUserId))}

          {formatListingDate(item.createdAt || item.updatedAt, language) ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
              <MaterialCommunityIcons name="clock-outline" size={13} color={themeColors.textMuted} />
              <Text style={{ fontSize: 11, fontWeight: "600", color: themeColors.textMuted }}>
                {formatListingDate(item.createdAt || item.updatedAt, language)}
              </Text>
            </View>
          ) : null}

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

  const renderGridCard = ({ item }: { item: PropertyListing }) => {
    const imageUri = getListingImageUri(item);
    const allImages = getListingImagesList(item);
    const isOwner = isListingOwnedByUser(item, currentUserId);
    const locationLabel = item.negeri || item.alamat || "Malaysia";
    const sizeLabel = formatSizeLabel(item.keluasan);

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          if (!item?.id) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push(`/listing/${item.id}` as any);
        }}
        style={[
          styles.gridCard,
          {
            backgroundColor: themeColors.cardBackground,
            borderColor: themeColors.borderColor,
          },
        ]}
      >
        {/* Thumbnail Hero with Floating Badges */}
        <View style={styles.gridImageWrap}>
          {imageUri ? (
            <ExpoImage
              source={{ uri: imageUri }}
              style={styles.gridThumbnail}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              recyclingKey={imageUri}
            />
          ) : (
            <View
              style={[
                styles.gridThumbnailPlaceholder,
                { backgroundColor: themeColors.maroonLight },
              ]}
            >
              <MaterialCommunityIcons
                name="home-city-outline"
                size={30}
                color={themeColors.maroonPrimary}
              />
            </View>
          )}

          {/* Floating Status Badge */}
          <View style={styles.gridFloatingStatus}>
            {renderStatusBadge(item, isOwner)}
          </View>

          {/* Photo Counter Badge */}
          {allImages.length > 1 && (
            <View style={styles.gridPhotoCountBadge}>
              <MaterialCommunityIcons name="camera" size={10} color="#FFF" />
              <Text style={styles.gridPhotoCountText}>{allImages.length}</Text>
            </View>
          )}

          {/* Date Recency Badge */}
          {formatListingDate(item.createdAt || item.updatedAt, language) ? (
            <View style={styles.gridDateBadge}>
              <Text style={styles.gridDateBadgeText}>
                {formatListingDate(item.createdAt || item.updatedAt, language)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Card Body */}
        <View style={styles.gridCardBody}>
          <Text
            style={[styles.gridCardPrice, { color: themeColors.maroonPrimary }]}
            numberOfLines={1}
          >
            {formatPriceLabel(item.harga)}
          </Text>

          <Text
            style={[styles.gridCardTitle, { color: themeColors.textPrimary }]}
            numberOfLines={2}
          >
            {item.tajuk}
          </Text>

          <View style={styles.gridLocationRow}>
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={12}
              color={themeColors.textMuted}
            />
            <Text
              style={[styles.gridCardLocation, { color: themeColors.textSecondary }]}
              numberOfLines={1}
            >
              {locationLabel}
            </Text>
          </View>

          {/* Compact Specs Row */}
          <View style={styles.gridSpecsRow}>
            {(item.bilikTidur || item.bilikAir) ? (
              <Text style={[styles.gridSpecText, { color: themeColors.textMuted }]}>
                🛏️ {item.bilikTidur || 0}  🚿 {item.bilikAir || 0}
              </Text>
            ) : null}
            {sizeLabel ? (
              <Text
                style={[styles.gridSpecText, { color: themeColors.textMuted, marginLeft: "auto" }]}
                numberOfLines={1}
              >
                {sizeLabel}
              </Text>
            ) : null}
          </View>

          {/* Quick Share Footer */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleShare(item)}
            style={[
              styles.gridShareBtn,
              {
                backgroundColor: themeColors.surfaceContainer,
                borderColor: themeColors.borderColor,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="share-variant-outline"
              size={13}
              color={themeColors.maroonPrimary}
            />
            <Text style={[styles.gridShareBtnText, { color: themeColors.maroonPrimary }]}>
              {language === "BM" ? "Kongsi" : "Share"}
            </Text>
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
        {/* Row 1: Compact Header with search toggle + filter icon */}
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, { color: themeColors.maroonPrimary, flex: 1 }]}>
            {t("masterListing")}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setIsSearchExpanded((prev) => !prev);
              }}
              style={[styles.iconButton, { backgroundColor: themeColors.surfaceContainer }]}
            >
              <MaterialCommunityIcons
                name={isSearchExpanded ? "close" : "magnify"}
                size={22}
                color={themeColors.textPrimary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setIsFilterModalVisible(true);
              }}
              style={[styles.iconButton, { backgroundColor: themeColors.surfaceContainer, position: "relative" }]}
            >
              <MaterialCommunityIcons
                name="tune-variant"
                size={22}
                color={themeColors.textPrimary}
              />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadgeDot}>
                  <Text style={styles.filterBadgeDotText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Collapsible Search Bar with Recent Searches & Discovery Tags */}
        {isSearchExpanded && (
          <View style={styles.searchBarContainer}>
            <View style={[styles.searchBar, { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor }]}>
              <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: themeColors.textPrimary }]}
                placeholder={t("searchPlaceholder")}
                placeholderTextColor={themeColors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => saveRecentSearch(searchQuery)}
                autoFocus
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={themeColors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Recent Searches Row */}
            {recentSearches.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: themeColors.textMuted }}>
                    {language === "BM" ? "Carian Terkini" : "Recent Searches"}
                  </Text>
                  <TouchableOpacity onPress={clearRecentSearches}>
                    <Text style={{ fontSize: 11, color: themeColors.maroonPrimary, fontWeight: "600" }}>
                      {language === "BM" ? "Padam" : "Clear"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {recentSearches.map((term, i) => (
                    <TouchableOpacity
                      key={`recent-${i}`}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setSearchQuery(term);
                      }}
                      style={[
                        styles.recentSearchChip,
                        {
                          backgroundColor: themeColors.surfaceContainer,
                          borderColor: themeColors.borderColor,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons name="history" size={12} color={themeColors.textMuted} />
                      <Text style={[styles.recentSearchChipText, { color: themeColors.textSecondary }]}>
                        {term}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Smart Discovery Tag Chips */}
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: themeColors.textMuted, marginBottom: 4 }}>
                {language === "BM" ? "Tag Popular" : "Popular Tags"}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {[
                  { label: "⭐ Freehold", action: () => setCriteriaTenure("Freehold") },
                  { label: "🌿 Bumi Lot", action: () => setCriteriaLotStatus("Bumi Lot") },
                  { label: "💰 < RM300k", action: () => setCriteriaMaxPrice("300000") },
                  { label: "🏡 Landed", action: () => setCategoryFilter("Landed") },
                  { label: "🏢 High-Rise", action: () => setCategoryFilter("High-Rise") },
                  { label: "🔑 Sewa", action: () => setCategoryFilter("Sewa") },
                ].map((tag, i) => (
                  <TouchableOpacity
                    key={`tag-${i}`}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      tag.action();
                    }}
                    style={[
                      styles.discoveryTagChip,
                      {
                        backgroundColor: `${themeColors.maroonPrimary}14`,
                        borderColor: `${themeColors.maroonPrimary}35`,
                      },
                    ]}
                  >
                    <Text style={[styles.discoveryTagChipText, { color: themeColors.maroonPrimary }]}>
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Row 2: Segment Toggle */}
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

        {/* Active filter summary strip (only when filters are active) */}
        {activeFilterCount > 0 && (
          <View style={[styles.activeFilterStrip, { backgroundColor: `${themeColors.maroonPrimary}12` }]}>
            <MaterialCommunityIcons name="filter-check-outline" size={14} color={themeColors.maroonPrimary} />
            <Text style={[styles.activeFilterStripText, { color: themeColors.maroonPrimary }]} numberOfLines={1}>
              {[
                activeFilter !== "Aktif" ? (activeFilter === "Semua" ? (language === "BM" ? "Semua Status" : "All Statuses") : activeFilter) : null,
                categoryFilter !== "Semua" ? categoryFilter : null,
                criteriaLocation.trim() || null,
                criteriaPropertyType !== "Any" ? criteriaPropertyType : null,
                criteriaTenure !== "Any" ? criteriaTenure : null,
                criteriaLotStatus !== "Any" ? criteriaLotStatus : null,
                (criteriaMinPrice.trim() || criteriaMaxPrice.trim()) ? `RM ${[criteriaMinPrice.trim(), criteriaMaxPrice.trim()].filter(Boolean).join(" – ")}` : null,
              ].filter(Boolean).join(" · ")}
            </Text>
            <TouchableOpacity
              onPress={clearAllFilters}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close-circle" size={16} color={themeColors.maroonPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Row 3: Toolbar */}
        <View style={styles.toolbarRow}>
          <Text style={[styles.resultCountText, { color: themeColors.textPrimary }]}>
            {filteredListings.length} {filteredListings.length === 1 ? "listing" : "listings"}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* 3-Way View Switcher (List / Grid / Map) */}
            <View
              style={[
                styles.viewSwitcherGroup,
                {
                  backgroundColor: themeColors.surfaceContainer,
                  borderColor: themeColors.borderColor,
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setViewMode("list");
                }}
                style={[
                  styles.viewSwitcherBtn,
                  viewMode === "list" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <MaterialCommunityIcons
                  name="view-agenda-outline"
                  size={15}
                  color={viewMode === "list" ? "#FFF" : themeColors.textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setViewMode("grid");
                }}
                style={[
                  styles.viewSwitcherBtn,
                  viewMode === "grid" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <MaterialCommunityIcons
                  name="view-grid-outline"
                  size={15}
                  color={viewMode === "grid" ? "#FFF" : themeColors.textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setViewMode("map");
                }}
                style={[
                  styles.viewSwitcherBtn,
                  viewMode === "map" && { backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <MaterialCommunityIcons
                  name="map-outline"
                  size={15}
                  color={viewMode === "map" ? "#FFF" : themeColors.textMuted}
                />
              </TouchableOpacity>
            </View>

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
      </View>

      {/* Main Content Area: Map View OR FlashList */}
      {viewMode === "map" ? (
        <View style={{ flex: 1, width: "100%", position: "relative" }}>
          <MapView
            ref={masterMapRef}
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
              const coords = getListingCoordinates(item, idx);
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
                  router.push(`/listing/${selectedMapListing.id}` as any);
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
                    {selectedMapListing.tajuk}
                  </Text>
                  <Text style={[styles.mapCardLocation, { color: themeColors.textMuted }]} numberOfLines={1}>
                    📍 {selectedMapListing.negeri || selectedMapListing.alamat || "Malaysia"}
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
                  <MaterialCommunityIcons name="close" size={18} color={themeColors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : isLoading ? (
        <ScrollView style={{ flex: 1, width: "100%", paddingHorizontal: viewMode === "grid" ? 8 : 16, paddingTop: 12 }}>
          <ListingSkeleton />
          <ListingSkeleton />
          <ListingSkeleton />
          <ListingSkeleton />
        </ScrollView>
      ) : (
        <FlashList
          key={viewMode}
          data={sortedListings}
          numColumns={viewMode === "grid" ? 2 : 1}
          keyExtractor={(item) => item.id}
          renderItem={viewMode === "grid" ? renderGridCard : renderListingCard}
          style={{ flex: 1, width: "100%" }}
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: viewMode === "grid" ? 8 : 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 24) + 132,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[themeColors.maroonPrimary]}
            />
          }
          onEndReached={() => {
            if (!isLoadingMore && listings.length >= listingLimit) {
              setIsLoadingMore(true);
              setListingLimit((prev) => prev + 20);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
              </View>
            ) : null
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
          <View style={[styles.sortModalSheet, { backgroundColor: themeColors.cardBackground, paddingBottom: Math.max(insets.bottom, 28) + 20 }]}>
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

      {/* ========== Unified Filter Bottom Sheet Modal ========== */}
      <Modal
        visible={isFilterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsFilterModalVisible(false)}
          style={styles.sortModalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 28) + 20,
              maxHeight: "85%",
            }}
          >
            <View style={[styles.sortModalHandle, { backgroundColor: themeColors.borderColor }]} />
            <Text style={[styles.sortModalTitle, { color: themeColors.textPrimary }]}>
              {language === "BM" ? "Tapis Listing" : "Filter Listings"}
            </Text>

            {renderFilterContent ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
              {/* Status Filter */}
              <View style={styles.filterModalSection}>
                <Text style={[styles.filterModalLabel, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Status" : "Status"}
                </Text>
                <View style={styles.filterModalPillRow}>
                  {filterChips.map((chip) => {
                    const active = activeFilter === chip.id;
                    return (
                      <TouchableOpacity
                        key={chip.id}
                        activeOpacity={0.7}
                        onPress={() => setActiveFilter(chip.id)}
                        style={[
                          styles.filterModalPill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.filterModalPillText, { color: active ? "#FFF" : themeColors.textSecondary }]}>
                          {chip.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Category Filter */}
              <View style={styles.filterModalSection}>
                <Text style={[styles.filterModalLabel, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Jenis Hartanah" : "Property Category"}
                </Text>
                <View style={styles.filterModalPillRow}>
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
                          styles.filterModalPill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons name={cat.icon} size={13} color={active ? "#FFF" : themeColors.textMuted} />
                        <Text style={[styles.filterModalPillText, { color: active ? "#FFF" : themeColors.textSecondary }]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Location */}
              <View style={styles.filterModalSection}>
                <Text style={[styles.filterModalLabel, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Lokasi" : "Location"}
                </Text>
                <TextInput
                  style={[styles.criteriaInput, { borderColor: themeColors.borderColor, color: themeColors.textPrimary, backgroundColor: themeColors.surfaceContainer }]}
                  placeholder={language === "BM" ? "Cari lokasi..." : "Search location..."}
                  placeholderTextColor={themeColors.textMuted}
                  value={criteriaLocation}
                  onChangeText={setCriteriaLocation}
                />
              </View>

              {/* Price Range */}
              <View style={styles.filterModalSection}>
                <Text style={[styles.filterModalLabel, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Julat Harga" : "Price Range"}
                </Text>
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
              </View>

              {/* Property Type */}
              <View style={styles.filterModalSection}>
                <Text style={[styles.filterModalLabel, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Jenis Kediaman" : "Property Type"}
                </Text>
                <View style={styles.filterModalPillRow}>
                  {propertyTypeOptions.map((option) => {
                    const active = criteriaPropertyType === option;
                    return (
                      <TouchableOpacity
                        key={`ptype-${option}`}
                        activeOpacity={0.7}
                        onPress={() => handlePropertyTypeSelect(option)}
                        style={[
                          styles.filterModalPill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.filterModalPillText, { color: active ? "#FFF" : themeColors.textSecondary }]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Tenure */}
              <View style={styles.filterModalSection}>
                <Text style={[styles.filterModalLabel, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Jenis Pegangan" : "Tenure Type"}
                </Text>
                <View style={styles.filterModalPillRow}>
                  {tenureOptions.map((option) => {
                    const active = criteriaTenure === option;
                    return (
                      <TouchableOpacity
                        key={`tenure-${option}`}
                        activeOpacity={0.7}
                        onPress={() => handleTenureSelect(option)}
                        style={[
                          styles.filterModalPill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.filterModalPillText, { color: active ? "#FFF" : themeColors.textSecondary }]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Lot Status */}
              <View style={styles.filterModalSection}>
                <Text style={[styles.filterModalLabel, { color: themeColors.textPrimary }]}>
                  {language === "BM" ? "Status Lot" : "Lot Status"}
                </Text>
                <View style={styles.filterModalPillRow}>
                  {lotStatusOptions.map((option) => {
                    const active = criteriaLotStatus === option;
                    return (
                      <TouchableOpacity
                        key={`lot-${option}`}
                        activeOpacity={0.7}
                        onPress={() => handleLotStatusSelect(option)}
                        style={[
                          styles.filterModalPill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.filterModalPillText, { color: active ? "#FFF" : themeColors.textSecondary }]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  </View>
                </View>
              </ScrollView>
            ) : (
              <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
              </View>
            )}

            {/* Bottom Action Bar */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, gap: 12 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  clearAllFilters();
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textSecondary }}>
                  {language === "BM" ? "Reset Semua" : "Reset All"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsFilterModalVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: themeColors.maroonPrimary,
                  alignItems: "center",
                }}
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

      {/* Quick Status Update Bottom Sheet Modal */}
      <Modal
        visible={!!statusModalListing}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalListing(null)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={() => setStatusModalListing(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: themeColors.borderColor,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 28) + 20,
            }}
          >
            {/* Drag handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: themeColors.borderColor,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: themeColors.textPrimary }}>
                {language === "BM" ? "Kemaskini Status Listing" : "Update Listing Status"}
              </Text>
              <TouchableOpacity
                onPress={() => setStatusModalListing(null)}
                style={{
                  padding: 6,
                  borderRadius: 16,
                  backgroundColor: themeColors.surfaceContainer,
                }}
              >
                <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {statusModalListing?.tajuk ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  color: themeColors.textMuted,
                  marginBottom: 16,
                }}
              >
                {statusModalListing.tajuk}
              </Text>
            ) : (
              <View style={{ marginBottom: 12 }} />
            )}

            {/* Options */}
            <View style={{ gap: 10 }}>
              {([
                {
                  value: "Aktif",
                  label: language === "BM" ? "Aktif (Active)" : "Active",
                  desc: language === "BM" ? "Listing boleh dilihat oleh semua ejen" : "Publicly visible to all agents",
                  icon: "check-circle",
                  color: "#10B981",
                },
                {
                  value: "Booking",
                  label: "Booking",
                  desc: language === "BM" ? "Hartanah sedang dalam proses tempahan" : "Property is currently under booking",
                  icon: "clock-outline",
                  color: "#F59E0B",
                },
                {
                  value: "Sold",
                  label: language === "BM" ? "Terjual (Sold)" : "Sold",
                  desc: language === "BM" ? "Urusniaga selesai atau hartanah terjual" : "Transaction completed or property sold",
                  icon: "tag-check",
                  color: "#3B82F6",
                },
                {
                  value: "Draft",
                  label: "Draft",
                  desc: language === "BM" ? "Hanya anda yang boleh melihat listing ini" : "Private — only visible to you",
                  icon: "pencil-outline",
                  color: "#6B7280",
                },
              ] as const).map((opt) => {
                const currentNorm = (statusModalListing?.currentStatus || "").toLowerCase();
                const isSelected =
                  (opt.value === "Aktif" && (currentNorm === "aktif" || currentNorm === "active")) ||
                  (opt.value === "Booking" && currentNorm === "booking") ||
                  (opt.value === "Sold" && (currentNorm === "sold" || currentNorm === "terjual")) ||
                  (opt.value === "Draft" && currentNorm === "draft");

                return (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.7}
                    onPress={() => handleSelectStatus(opt.value)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: isSelected ? 1.5 : 1,
                      borderColor: isSelected ? opt.color : themeColors.borderColor,
                      backgroundColor: isSelected ? `${opt.color}15` : themeColors.surfaceContainer,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: `${opt.color}22`,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialCommunityIcons name={opt.icon as any} size={20} color={opt.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          color: isSelected ? opt.color : themeColors.textPrimary,
                        }}
                      >
                        {opt.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: themeColors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {opt.desc}
                      </Text>
                    </View>
                    {isSelected ? (
                      <MaterialCommunityIcons name="check-circle" size={20} color={opt.color} />
                    ) : (
                      <MaterialCommunityIcons name="radiobox-blank" size={20} color={themeColors.borderColor} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Share Options Bottom Sheet Modal */}
      <Modal
        visible={!!shareModalListing}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalListing(null)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={() => setShareModalListing(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: themeColors.borderColor,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 28) + 20,
            }}
          >
            {/* Drag handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: themeColors.borderColor,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: themeColors.textPrimary }}>
                {language === "BM" ? "Kongsi Listing" : "Share Listing"}
              </Text>
              <TouchableOpacity
                onPress={() => setShareModalListing(null)}
                style={{
                  padding: 6,
                  borderRadius: 16,
                  backgroundColor: themeColors.surfaceContainer,
                }}
              >
                <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {shareModalListing?.tajuk ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  color: themeColors.textMuted,
                  marginBottom: 16,
                }}
              >
                {shareModalListing.tajuk}
              </Text>
            ) : (
              <View style={{ marginBottom: 12 }} />
            )}

            {/* Share Options */}
            <View style={{ gap: 10 }}>
              {/* WhatsApp Option */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => shareModalListing && handleShareWhatsApp(shareModalListing)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  backgroundColor: themeColors.surfaceContainer,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "#25D36622",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name="whatsapp" size={22} color="#25D366" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                    {language === "BM" ? "WhatsApp (Teks)" : "WhatsApp (Text)"}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                    {language === "BM"
                      ? "Buka WhatsApp terus dengan maklumat listing"
                      : "Open WhatsApp directly with formatted property details"}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>

              {/* Photo & Caption Option */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => shareModalListing && handleSharePhoto(shareModalListing)}
                disabled={isSharingImage}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  backgroundColor: themeColors.surfaceContainer,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: `${themeColors.maroonPrimary}22`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSharingImage ? (
                    <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
                  ) : (
                    <MaterialCommunityIcons name="image-outline" size={22} color={themeColors.maroonPrimary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                    {language === "BM" ? "Kongsi Gambar (Brochure)" : "Share Photo & Details"}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                    {language === "BM"
                      ? "Buka gambar dalam menu perkongsian (teks disalin ke papan keratan)"
                      : "Open photo in share menu (caption copied to clipboard)"}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>

              {/* More Apps Option */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => shareModalListing && handleShareGeneric(shareModalListing)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  backgroundColor: themeColors.surfaceContainer,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "#6366F122",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name="share-variant-outline" size={22} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                    {language === "BM" ? "Pilihan Lain" : "More Sharing Options"}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                    {language === "BM"
                      ? "Buka menu perkongsian sistem untuk aplikasi lain"
                      : "Open system share sheet for Telegram, Copy, and other apps"}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {!(viewMode === "map" && selectedMapListing) && (
        <Animated.View
          style={{
            position: "absolute",
            right: 20,
            bottom: (insets.bottom > 0 ? insets.bottom + 12 : 16) + 68,
            zIndex: 999,
            transform: [
              {
                translateY: fabAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 90],
                }),
              },
            ],
            opacity: fabAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          }}
        >
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push("/tambah" as any);
            }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: themeColors.maroonPrimary,
              alignItems: "center",
              justifyContent: "center",
              elevation: 6,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 4.5,
            }}
          >
            <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>
      )}
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
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
  },
  viewModeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardPhotoCountBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardPhotoCountText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  gridCard: {
    flex: 1,
    margin: 5,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gridImageWrap: {
    width: "100%",
    height: 130,
    position: "relative",
  },
  gridThumbnail: {
    width: "100%",
    height: "100%",
  },
  gridThumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  gridFloatingStatus: {
    position: "absolute",
    top: 6,
    left: 6,
  },
  gridPhotoCountBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  gridPhotoCountText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  gridCardBody: {
    padding: 10,
  },
  gridCardPrice: {
    fontSize: 15,
    fontWeight: "800",
  },
  gridCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  gridLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  gridCardLocation: {
    flex: 1,
    fontSize: 11,
  },
  gridSpecsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  gridSpecText: {
    fontSize: 11,
    fontWeight: "600",
  },
  gridShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  gridShareBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  filterBadgeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF3B5C",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterBadgeDotText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "800",
  },
  activeFilterStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  activeFilterStripText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
  },
  filterModalSection: {
    marginBottom: 16,
  },
  filterModalLabel: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  filterModalPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterModalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterModalPillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  viewSwitcherGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  viewSwitcherBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  recentSearchChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  recentSearchChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  discoveryTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  discoveryTagChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  mapPriceMarker: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
  mapBottomCardWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    overflow: "hidden",
  },
  mapCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  mapCardThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  mapCardThumbPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  mapCardDetails: {
    flex: 1,
    justifyContent: "center",
  },
  mapCardPrice: {
    fontSize: 16,
    fontWeight: "800",
  },
  mapCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  mapCardLocation: {
    fontSize: 11,
    marginTop: 3,
  },
  mapCardSpecs: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  mapCardCloseBtn: {
    alignSelf: "flex-start",
    padding: 4,
  },
  specBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 4,
  },
  specBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  locateMeFab: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  gridDateBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.68)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gridDateBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});
