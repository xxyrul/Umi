import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppSettings } from "@/context/AppSettingsContext";
import { firebaseAuth, firebaseDB } from "@/services/firebase";

type FilterState = {
  search: string;
  status: string;
  location: string;
  minPrice: string;
  maxPrice: string;
  propertyType: string;
  tenure: string;
  lotStatus: string;
};

type ListingItem = {
  id: string;
  userId?: string;
  agentId?: string;
  status?: string;
  title?: string;
  address?: string;
  city?: string;
  location?: string;
  price?: number | string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  imageUrl?: string;
  images?: string[];
  gambar?: string[];
  propertyType?: string;
  tenure?: string;
  lotStatus?: string;
};

const STATUS_OPTIONS = ["All", "Active", "Booking", "Sold", "Draft"] as const;
const LISTING_STATUS_OPTIONS = ["Active", "Booking", "Sold", "Draft"] as const;
const propertyTypes = ["Any", "Residential / Teres", "Commercial", "Industrial", "Land"] as const;
const tenureTypes = ["Any", "Freehold", "Leasehold"] as const;
const lotStatuses = ["Any", "Bumi Lot", "Non-Bumi Lot"] as const;
const EMPTY_FILTERS: FilterState = {
  search: "",
  status: "All",
  location: "",
  minPrice: "",
  maxPrice: "",
  propertyType: "Any",
  tenure: "Any",
  lotStatus: "Any",
};

const normalizeText = (value?: string | null): string =>
  (value ?? "").toString().trim().toLowerCase();

const normalizeStatusLabel = (value?: string | null): string => {
  const normalized = normalizeText(value);

  if (!normalized) return "Active";
  if (["active", "aktif", "available", "viewing"].includes(normalized)) return "Active";
  if (["booking", "booked", "reserved", "reservation"].includes(normalized)) return "Booking";
  if (["sold", "terjual", "sold out", "sold-out"].includes(normalized)) return "Sold";
  if (["draft", "pending draft"].includes(normalized)) return "Draft";

  return value?.trim() || "Active";
};

const parseNumber = (value: number | string | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) return Number.NaN;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
};

const getStatusMatch = (status?: string, filterStatus?: string): boolean => {
  const itemStatus = normalizeText(status);
  const target = normalizeText(filterStatus);

  if (!target || target === "all") return true;

  if (target === "active") {
    return ["active", "aktif", "available", "viewing"].includes(itemStatus);
  }

  if (target === "booking") {
    return ["booking", "booked", "reserved", "reservation"].includes(itemStatus);
  }

  if (target === "sold") {
    return ["sold", "terjual", "sold out", "sold-out"].includes(itemStatus);
  }

  if (target === "draft") {
    return ["draft", "pending draft"].includes(itemStatus);
  }

  return itemStatus === target;
};

export default function MasterListingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { themeColors } = useAppSettings();
  const contentMaxWidth = Math.min(width, 760);
  const fabRight = Math.max(20, (width - contentMaxWidth) / 2 + 20);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [activeTab, setActiveTab] = useState<"all" | "my">("all");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedListingForStatus, setSelectedListingForStatus] = useState<ListingItem | null>(null);
  const currentUser = firebaseAuth.currentUser;

  const mapListingDocToItem = (doc: { id: string; data: () => Record<string, any> }) => {
    const data = doc.data() ?? {};

    const titleValue =
      data.tajuk ?? data.title ?? data.namaHartanah ?? "Untitled Listing";
    const priceValue = Number(data.harga ?? data.price ?? 0) || 0;
    const addressValue =
      data.alamat ?? data.address ?? data.location ?? "Location unavailable";
    const cityValue = data.negeri ?? data.city ?? data.bandar ?? "City not specified";
    const bedroomsValue = Number(data.bilikTidur ?? data.bedrooms ?? 0) || 0;
    const bathroomsValue = Number(data.bilikAir ?? data.bathrooms ?? 0) || 0;
    const sqftValue = Number(data.keluasan ?? data.sqft ?? 0) || 0;
    const imageUrlValue =
      typeof data.imageUrl === "string" && data.imageUrl.trim()
        ? data.imageUrl.trim()
        : typeof data.coverImage === "string" && data.coverImage.trim()
          ? data.coverImage.trim()
          : Array.isArray(data.gambar) && data.gambar.length > 0 && typeof data.gambar[0] === "string"
            ? data.gambar[0].trim()
            : "";
    const imagesValue = Array.isArray(data.images)
      ? data.images.filter((img: unknown) => typeof img === "string" && img.trim())
      : Array.isArray(data.gambar)
        ? data.gambar.filter((img: unknown) => typeof img === "string" && img.trim())
        : Array.isArray(data.imageUrl)
          ? data.imageUrl.filter((img: unknown) => typeof img === "string" && img.trim())
          : [];

    return {
      id: doc.id,
      title: typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : "Untitled Listing",
      price: Number.isFinite(priceValue) ? priceValue : 0,
      status: normalizeStatusLabel(data.status),
      location: typeof addressValue === "string" && addressValue.trim() ? addressValue.trim() : "Location unavailable",
      address: typeof addressValue === "string" ? addressValue : "",
      city: typeof cityValue === "string" && cityValue.trim() ? cityValue.trim() : "City not specified",
      bedrooms: Number.isFinite(bedroomsValue) ? bedroomsValue : 0,
      bathrooms: Number.isFinite(bathroomsValue) ? bathroomsValue : 0,
      sqft: Number.isFinite(sqftValue) ? sqftValue : 0,
      imageUrl: imageUrlValue || (imagesValue[0] ?? ""),
      images: imagesValue,
      gambar: imagesValue,
      userId: typeof data.userId === "string" ? data.userId : "",
      propertyType: typeof (data.jenis ?? data.propertyType) === "string" ? (data.jenis ?? data.propertyType) : "",
      tenure: typeof (data.pegangan ?? data.tenure) === "string" ? (data.pegangan ?? data.tenure) : "",
      lotStatus: typeof (data.lot ?? data.lotStatus) === "string" ? (data.lot ?? data.lotStatus) : "",
    } as ListingItem;
  };

  useEffect(() => {
    const userId = firebaseAuth.currentUser?.uid;

    const listingsQuery =
      activeTab === "my" && userId
        ? firebaseDB.collection("listings").where("userId", "==", userId)
        : firebaseDB.collection("listings");

    const unsubscribe = listingsQuery
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snapshot) => {
          const fetchedListings: ListingItem[] = snapshot.docs.map((doc) => mapListingDocToItem(doc));

          setListings(fetchedListings);
          setIsLoading(false);
          setIsRefreshing(false);
        },
        () => {
          setIsLoading(false);
          setIsRefreshing(false);
        },
      );

    return () => unsubscribe();
  }, [activeTab, currentUser?.uid]);

  const propertyTypeOptions = propertyTypes;
  const tenureOptions = tenureTypes;
  const lotStatusOptions = lotStatuses;

  const filteredListings = useMemo(() => {
    const searchQuery = filters.search.trim().toLowerCase();
    const locationQuery = filters.location.trim().toLowerCase();
    const minPriceValue = filters.minPrice.trim() ? Number(filters.minPrice) : null;
    const maxPriceValue = filters.maxPrice.trim() ? Number(filters.maxPrice) : null;

    const getSearchableText = (item: ListingItem) =>
      [
        item.title,
        item.address,
        item.location,
        item.city,
        item.propertyType,
        item.tenure,
        item.lotStatus,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    const getLocationText = (item: ListingItem) =>
      [item.location, item.address, item.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return listings.filter((item) => {
      if (activeTab === "my" && item.userId !== currentUser?.uid && item.agentId !== currentUser?.uid) {
        return false;
      }

      if (!getStatusMatch(item.status, filters.status)) {
        return false;
      }

      if (searchQuery) {
        const haystack = getSearchableText(item);
        if (!haystack.includes(searchQuery)) {
          return false;
        }
      }

      if (locationQuery) {
        const haystack = getLocationText(item);
        if (!haystack.includes(locationQuery)) {
          return false;
        }
      }

      if (filters.propertyType !== "Any") {
        const selected = normalizeText(filters.propertyType);
        const value = normalizeText(item.propertyType || item.title);
        if (!value.includes(selected)) {
          return false;
        }
      }

      if (filters.tenure !== "Any") {
        const selected = normalizeText(filters.tenure);
        const value = normalizeText(item.tenure);
        if (!value.includes(selected)) {
          return false;
        }
      }

      if (filters.lotStatus !== "Any") {
        const selected = normalizeText(filters.lotStatus);
        const value = normalizeText(item.lotStatus);
        if (!value.includes(selected)) {
          return false;
        }
      }

      const itemPrice = parseNumber(item.price);
      if (!Number.isNaN(itemPrice)) {
        if (minPriceValue !== null && itemPrice < minPriceValue) return false;
        if (maxPriceValue !== null && itemPrice > maxPriceValue) return false;
      } else if (minPriceValue !== null || maxPriceValue !== null) {
        return false;
      }

      return true;
    });
  }, [activeTab, currentUser?.uid, filters, listings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const snapshot = await firebaseDB.collection("listings").get();
      const nextListings: ListingItem[] = snapshot.docs.map((doc) => mapListingDocToItem(doc));

      setListings(nextListings);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getImageUri = (item: ListingItem): string | null => {
    if (item.imageUrl) return item.imageUrl;
    if (item.images && item.images.length > 0 && item.images[0]) return item.images[0];
    if (item.gambar && item.gambar.length > 0 && item.gambar[0]) return item.gambar[0];
    return null;
  };

  const segmentTabs = [
    { label: "All Listings", value: "all" as const },
    { label: "My Listings", value: "my" as const },
  ];

  const handleOpenStatusModal = (item: ListingItem) => {
    const isOwner = Boolean(
      currentUser &&
        (item.userId === currentUser.uid || item.agentId === currentUser.uid || (!item.userId && !item.agentId)),
    );

    if (!isOwner) {
      return;
    }

    setSelectedListingForStatus(item);
    setIsStatusModalOpen(true);
  };

  const handleUpdateListingStatus = async (newStatus: string) => {
    if (!selectedListingForStatus) return;

    const nextStatus = normalizeStatusLabel(newStatus);
    if (!selectedListingForStatus.id) return;

    try {
      await firebaseDB.collection("listings").doc(selectedListingForStatus.id).update({
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });

      setListings((prev) =>
        prev.map((item) => (item.id === selectedListingForStatus.id ? { ...item, status: nextStatus } : item)),
      );
      setIsStatusModalOpen(false);
      setSelectedListingForStatus(null);
    } catch (error) {
      console.error("Error updating listing status:", error);
      Alert.alert("Status update failed", "Unable to update this listing status right now.");
    }
  };

  const renderListingCard = ({ item }: { item: ListingItem }) => {
    const imageUri = getImageUri(item);
    const statusLabel = normalizeStatusLabel(item.status);
    const isOwner = Boolean(
      currentUser &&
        (item.userId === currentUser.uid || item.agentId === currentUser.uid || (!item.userId && !item.agentId)),
    );

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })}
        style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
      >
        <View style={styles.topRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => isOwner && handleOpenStatusModal(item)}
            disabled={!isOwner}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.statusBadge, { backgroundColor: themeColors.statusAktifBg }]}
          >
            <Text style={[styles.statusText, { color: themeColors.statusAktifText }]}>{statusLabel}</Text>
          </TouchableOpacity>

          {isOwner && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleOpenStatusModal(item)}
              style={[styles.updateStatusButton, { backgroundColor: themeColors.maroonPrimary }]}
            >
              <MaterialCommunityIcons name="pencil-outline" size={14} color="#FFF" />
              <Text style={styles.updateStatusText}>Update Status</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.cardRow}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnailPlaceholder, { backgroundColor: themeColors.maroonLight }]}> 
              <MaterialCommunityIcons name="home-city-outline" size={28} color={themeColors.maroonPrimary} />
            </View>
          )}

          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {item.title || "Untitled Listing"}
            </Text>
            <Text style={[styles.cardPrice, { color: themeColors.maroonPrimary }]}>RM {String(item.price ?? "0")}</Text>
            <Text style={[styles.cardMeta, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {item.address || item.location || "Location unavailable"}
            </Text>
            <Text style={[styles.cardMeta, { color: themeColors.textMuted }]} numberOfLines={1}>
              {item.city || "City not specified"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" }}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: themeColors.cardBackground,
              borderBottomColor: themeColors.borderColor,
              paddingTop: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 8,
            },
          ]}
        >
          <Text style={[styles.title, { color: themeColors.maroonPrimary }]}>Master Listing</Text>

          <View style={styles.searchRow}>
            <View style={[styles.searchBar, { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor }]}> 
              <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textMuted} />
              <TextInput
                value={filters.search}
                onChangeText={(value) => setFilters((prev) => ({ ...prev, search: value }))}
                placeholder="Search listings"
                placeholderTextColor={themeColors.textMuted}
                style={[styles.searchInput, { color: themeColors.textPrimary }]}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setIsFilterModalOpen(true)}
              style={[styles.filterButton, { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor }]}
            >
              <MaterialCommunityIcons name="tune-variant" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.segmentWrap, { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor }]}> 
            {segmentTabs.map((tab, index) => {
              const isActive = activeTab === tab.value;
              return (
                <TouchableOpacity
                  key={tab.value}
                  activeOpacity={0.85}
                  onPress={() => setActiveTab(tab.value)}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: isActive ? "#FFB4B4" : themeColors.surfaceContainer,
                      borderRightWidth: index === 0 ? 1 : 0,
                      borderRightColor: themeColors.borderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: isActive ? "#121212" : "#FFFFFF",
                        fontWeight: isActive ? "700" : "600",
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {STATUS_OPTIONS.map((status) => {
              const active = filters.status === status;
              return (
                <TouchableOpacity
                  key={status}
                  activeOpacity={0.9}
                  onPress={() => setFilters((prev) => ({ ...prev, status }))}
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                      borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.statusPillText, { color: active ? themeColors.canvasBackground : themeColors.textSecondary }]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
          </View>
        ) : (
          <FlatList
            data={filteredListings}
            renderItem={renderListingCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 100, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[themeColors.maroonPrimary]} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="home-search-outline" size={48} color={themeColors.maroonPrimary} />
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No listings found</Text>
                <Text style={[styles.emptySubtitle, { color: themeColors.textMuted }]}>Try changing a filter or resetting the criteria.</Text>
              </View>
            }
          />
        )}

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push("/(tabs)/tambah" as any)}
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

      <Modal visible={isStatusModalOpen} transparent animationType="slide" onRequestClose={() => setIsStatusModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: "#FFFFFF" }]}>Update Listing Status</Text>
              <TouchableOpacity onPress={() => setIsStatusModalOpen(false)} style={[styles.closeButton, { backgroundColor: "#2C2C2C" }]}>
                <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              {LISTING_STATUS_OPTIONS.map((status) => {
                const isActive = selectedListingForStatus?.status === status || normalizeStatusLabel(selectedListingForStatus?.status) === status;
                return (
                  <TouchableOpacity
                    key={status}
                    activeOpacity={0.85}
                    onPress={() => handleUpdateListingStatus(status)}
                    style={[
                      styles.optionPill,
                      {
                        backgroundColor: isActive ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                        borderColor: isActive ? themeColors.maroonPrimary : themeColors.borderColor,
                        minWidth: "45%",
                      },
                    ]}
                  >
                    <Text style={[styles.optionText, { color: isActive ? themeColors.canvasBackground : themeColors.textSecondary }]}>
                      {status}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isFilterModalOpen} transparent animationType="slide" onRequestClose={() => setIsFilterModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: "#FFFFFF" }]}>Buyer Criteria Filters</Text>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)} style={[styles.closeButton, { backgroundColor: "#2C2C2C" }]}>
                <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputBlock}>
                <Text style={[styles.inputLabel, { color: "#FFFFFF" }]}>Location</Text>
                <TextInput
                  value={filters.location}
                  onChangeText={(value) => setFilters((prev) => ({ ...prev, location: value }))}
                  placeholder="E.g., Taiping, Selangor"
                  placeholderTextColor={themeColors.textMuted}
                  maxLength={50}
                  multiline={false}
                  style={[styles.input, { borderColor: themeColors.borderColor, backgroundColor: themeColors.surfaceContainer, color: themeColors.textPrimary }]}
                />
              </View>

              <View style={styles.inputBlock}>
                <Text style={[styles.inputLabel, { color: "#FFFFFF" }]}>Price Range (RM)</Text>
                <View style={styles.priceRow}>
                  <TextInput
                    value={filters.minPrice}
                    onChangeText={(value) => setFilters((prev) => ({ ...prev, minPrice: value }))}
                    placeholder="Min RM"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="numeric"
                    maxLength={10}
                    multiline={false}
                    style={[styles.input, { flex: 1, borderColor: themeColors.borderColor, backgroundColor: themeColors.surfaceContainer, color: themeColors.textPrimary }]}
                  />
                  <TextInput
                    value={filters.maxPrice}
                    onChangeText={(value) => setFilters((prev) => ({ ...prev, maxPrice: value }))}
                    placeholder="Max RM"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="numeric"
                    maxLength={10}
                    multiline={false}
                    style={[styles.input, { flex: 1, borderColor: themeColors.borderColor, backgroundColor: themeColors.surfaceContainer, color: themeColors.textPrimary }]}
                  />
                </View>
              </View>

              <View style={styles.inputBlock}>
                <Text style={[styles.inputLabel, { color: "#FFFFFF" }]}>Property Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                  {propertyTypeOptions.map((option) => {
                    const active = filters.propertyType === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        activeOpacity={0.8}
                        onPress={() => setFilters((prev) => ({ ...prev, propertyType: option }))}
                        style={[
                          styles.optionPill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.optionText, { color: active ? themeColors.canvasBackground : themeColors.textSecondary }]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.inputBlock}>
                <Text style={[styles.inputLabel, { color: "#FFFFFF" }]}>Tenure Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                  {tenureOptions.map((option) => {
                    const active = filters.tenure === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        activeOpacity={0.8}
                        onPress={() => setFilters((prev) => ({ ...prev, tenure: option }))}
                        style={[
                          styles.optionPill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.optionText, { color: active ? themeColors.canvasBackground : themeColors.textSecondary }]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.inputBlock}>
                <Text style={[styles.inputLabel, { color: "#FFFFFF" }]}>Lot Status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                  {lotStatusOptions.map((option) => {
                    const active = filters.lotStatus === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        activeOpacity={0.8}
                        onPress={() => setFilters((prev) => ({ ...prev, lotStatus: option }))}
                        style={[
                          styles.optionPill,
                          {
                            backgroundColor: active ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.optionText, { color: active ? themeColors.canvasBackground : themeColors.textSecondary }]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setFilters(EMPTY_FILTERS);
                  setIsFilterModalOpen(false);
                }}
                style={[styles.secondaryButton, { borderColor: themeColors.borderColor }]}
              >
                <Text style={[styles.secondaryButtonText, { color: themeColors.textSecondary }]}>Reset All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setIsFilterModalOpen(false)}
                style={[styles.primaryButton, { backgroundColor: themeColors.maroonPrimary }]}
              >
                <Text style={[styles.primaryButtonText, { color: themeColors.canvasBackground }]}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  filterButton: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentWrap: {
    marginTop: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    overflow: "hidden",
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "700",
  },
  pillRow: {
    paddingBottom: 4,
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    position: "relative",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  updateStatusButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  updateStatusText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
  },
  thumbnail: {
    width: 96,
    height: 96,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingRight: 52,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    width: "100%",
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  inputBlock: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  priceRow: {
    flexDirection: "row",
    gap: 12,
  },
  optionRow: {
    gap: 8,
    paddingRight: 8,
  },
  optionPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 2,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
