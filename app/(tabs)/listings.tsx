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
import { firestore, auth } from "@/services/firebase";
import { useRouter } from "expo-router";
import type { PropertyListing } from "@/types/listing";
import { useDebounce } from "@/hooks/useDebounce";
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
  const [activeFilter, setActiveFilter] = useState("Semua");
  const [activeSegment, setActiveSegment] = useState<ListingSegment>("all");
  const [sortOption, setSortOption] = useState<ListingSortOption>("newest");
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [statusModalListing, setStatusModalListing] = useState<{ id: string; currentStatus: string; tajuk: string } | null>(null);
  const [shareModalListing, setShareModalListing] = useState<PropertyListing | null>(null);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [categoryFilter, setCategoryFilter] = useState("Semua");

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
  }, []);

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
                  <Text style={[styles.specText, { color: themeColors.textMuted }]} numberOfLines={1}>
                    {sizeLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.cardActionRow, { borderTopColor: themeColors.borderColor }]}>
          {renderStatusBadge(item, isListingOwnedByUser(item, currentUserId))}

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

        {/* Category Filter Chips Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 6 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
        >
          {[
            { id: "Semua", label: language === "BM" ? "Semua Jenis" : "All Types", icon: "view-grid" },
            { id: "Landed", label: "Landed / Teres", icon: "home" },
            { id: "High-Rise", label: "High-Rise / Kondo", icon: "office-building" },
            { id: "Commercial", label: "Komersial / Kedai", icon: "store" },
            { id: "Tanah", label: "Tanah / Land", icon: "terrain" },
            { id: "Industri", label: "Industri / Kilang", icon: "factory" },
            { id: "Sewa", label: "Sewa / Rental", icon: "key-variant" },
          ].map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setCategoryFilter(cat.id);
                }}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: active ? `${themeColors.maroonPrimary}18` : themeColors.surfaceContainer,
                    borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={cat.icon as any}
                  size={13}
                  color={active ? themeColors.maroonPrimary : themeColors.textMuted}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    {
                      color: active ? themeColors.maroonPrimary : themeColors.textSecondary,
                      fontWeight: active ? "700" : "500",
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.toolbarRow}>
          <Text style={[styles.resultCountText, { color: themeColors.textPrimary }]}>
            {filteredListings.length} {filteredListings.length === 1 ? "listing" : "listings"}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* View Mode Switcher (1-Col vs 2-Col Grid) */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setViewMode((prev) => (prev === "list" ? "grid" : "list"));
              }}
              style={[
                styles.viewModeToggleBtn,
                {
                  backgroundColor: themeColors.surfaceContainer,
                  borderColor: themeColors.borderColor,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={viewMode === "list" ? "view-grid-outline" : "view-agenda-outline"}
                size={18}
                color={themeColors.maroonPrimary}
              />
            </TouchableOpacity>

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

      {/* Main Property FlashList */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
          <Text style={[styles.loadingText, { color: themeColors.textMuted }]}>{t("masterListing")}...</Text>
        </View>
      ) : (
        <FlashList
          key={viewMode}
          data={sortedListings}
          numColumns={viewMode === "grid" ? 2 : 1}
          keyExtractor={(item) => item.id}
          renderItem={viewMode === "grid" ? renderGridCard : renderListingCard}
          style={{ flex: 1, width: "100%" }}
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
              paddingBottom: Math.max(insets.bottom, 24) + 16,
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
                  icon: "home-check",
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
              paddingBottom: Math.max(insets.bottom, 16) + 12,
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

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/tambah" as any)}
        activeOpacity={0.9}
        style={{
          position: "absolute",
          right: 20,
          bottom: (insets.bottom > 0 ? insets.bottom + 12 : 16) + 68,
          height: 52,
          paddingHorizontal: 18,
          borderRadius: 26,
          backgroundColor: themeColors.maroonPrimary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          elevation: 6,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 4.5,
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
});
