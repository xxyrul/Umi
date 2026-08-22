import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  StatusBar,
  Modal,
  AppState,
  AppStateStatus,
  useWindowDimensions,
  Animated as RNAnimated,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useScrollAwareBar } from "@/context/ScrollAwareBarContext";

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING } from "@/constants/theme";
import { useDebounce } from "@/hooks/useDebounce";
import { useAppSettings } from "@/context/AppSettingsContext";
import { CaseCard } from "@/components";
import { deleteCase, updateCase } from "@/services/storage";
import { firestore, auth } from "@/services/firebase";
import { scheduleCaseReminder } from "@/services/notifications";
import type { PropertyCase, CaseStatus } from "@/types/case";

const FILTER_STATUSES: (CaseStatus | "All" | "Active")[] = [
  "All",
  "Active",
  "Viewing",
  "Booking Paid",
  "Loan Approved",
  "SPA Signed",
  "Completed",
  "Cancelled",
];

const PRIMARY_STATUS_LIST: CaseStatus[] = [
  "Viewing",
  "Booking Paid",
  "Loan Approved",
  "SPA Signed",
  "Completed",
];

const SECONDARY_STATUS_LIST: CaseStatus[] = [
  "Cancelled",
  "Pending",
  "Review",
];

type CaseSortOption = "newest" | "oldest" | "name-asc" | "name-desc" | "id";

const CASE_SORT_OPTIONS: Array<{ id: CaseSortOption; label: string }> = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "name-asc", label: "A–Z" },
  { id: "name-desc", label: "Z–A" },
  { id: "id", label: "ID" },
];

function getDateSortValue(value?: string): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function compareCases(a: PropertyCase, b: PropertyCase, sortOption: CaseSortOption): number {
  if (sortOption === "name-asc" || sortOption === "name-desc") {
    const comparison = (a.namaCase || "").localeCompare(b.namaCase || "", undefined, {
      sensitivity: "base",
      numeric: true,
    });
    return sortOption === "name-desc" ? -comparison : comparison;
  }

  if (sortOption === "id") {
    return (a.id || "").localeCompare(b.id || "", undefined, {
      sensitivity: "base",
      numeric: true,
    });
  }

  const aDate = getDateSortValue(a.updatedAt || a.createdAt);
  const bDate = getDateSortValue(b.updatedAt || b.createdAt);
  return sortOption === "oldest" ? aDate - bDate : bDate - aDate;
}

export default function CasesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { themeColors, language, t } = useAppSettings();
  const contentMaxWidth = Math.min(width, 760);
  const fabRight = Math.max(20, (width - contentMaxWidth) / 2 + 20);
  const [cases, setCases] = useState<PropertyCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<PropertyCase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus | "All" | "Active">("All");
  const [sortOption, setSortOption] = useState<CaseSortOption>("newest");
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Status Change Modal State
  const [selectedCase, setSelectedCase] = useState<PropertyCase | null>(null);
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Reanimated 60FPS UI-thread auto-hide FAB synced with floating bar
  const { barTranslateY, scrollHandler } = useScrollAwareBar();
  const animatedFabStyle = useAnimatedStyle(() => {
    const translateY = barTranslateY ? barTranslateY.value : 0;
    const opacity = interpolate(translateY, [0, 60], [1, 0], Extrapolation.CLAMP);
    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  // Reminder Scheduling Modal State
  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const [reminderNote, setReminderNote] = useState("");
  const [reminderDays, setReminderDays] = useState<number>(3); // Default to 3 days

  const { status } = useLocalSearchParams<{ status?: string }>();

  const getStatusLabel = (value: CaseStatus | "All" | "Active") => {
    switch (value) {
      case "All":
        return t("all");
      case "Active":
        return t("statusAktif");
      case "Viewing":
        return t("statusViewing");
      case "Booking Paid":
        return t("statusBookingPaid");
      case "Loan Approved":
        return t("statusLoanApproved");
      case "SPA Signed":
        return t("statusSpaSigned");
      case "Completed":
        return t("statusCompleted");
      case "Cancelled":
        return t("statusCancelled");
      case "Pending":
        return t("statusPending");
      case "Review":
        return t("statusReview");
    }
  };

  const applyFilters = (
    allCases: PropertyCase[],
    queryText: string,
    status: CaseStatus | "All" | "Active",
    selectedSort: CaseSortOption
  ) => {
    let result = [...allCases];

    // Apply Search Query
    if (queryText.trim()) {
      const lowerQuery = queryText.toLowerCase();
      result = result.filter(
        (c) =>
          (c.namaCase ?? "").toLowerCase().includes(lowerQuery) ||
          (c.vendorName ?? "").toLowerCase().includes(lowerQuery) ||
          (c.buyerName ?? "").toLowerCase().includes(lowerQuery) ||
          (c.clientName ?? "").toLowerCase().includes(lowerQuery)
      );
    }

    // Apply Status Filter
    if (status === "Active") {
      result = result.filter(
        (c) =>
          c.status === "Viewing" ||
          c.status === "Booking Paid" ||
          c.status === "Loan Approved" ||
          c.status === "SPA Signed"
      );
    } else if (status !== "All") {
      result = result.filter((c) => c.status === status);
    }

    result.sort((a, b) => compareCases(a, b, selectedSort));
    setFilteredCases(result);
  };

  // Realtime Firestore Listener (Lifecycle-aware to save battery)
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const attachListener = () => {
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;

      if (!userId) {
        setIsLoading(false);
        return;
      }

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }

      unsubscribeSnapshot = firestore()
        .collection("cases")
        .where("userId", "==", userId)
        .onSnapshot(
          (snapshot) => {
            if (snapshot) {
              const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as PropertyCase[];

              data.sort((a, b) =>
                (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "")
              );

              setCases(data);
            }
            setIsLoading(false);
            setIsRefreshing(false);
          },
          (error) => {
            console.error("Realtime cases error:", error);
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

    // Pause listener when backgrounded to prevent battery drain
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

  useEffect(() => {
    if (status) {
      // Clean target status string matching FILTER_STATUSES values
      let targetStatus: CaseStatus | "All" | "Active" = "All";
      if (status === "Active") {
        targetStatus = "Active";
      } else {
        const found = FILTER_STATUSES.find(
          (s) => s.toLowerCase().trim() === status.toLowerCase().trim()
        );
        if (found) {
          targetStatus = found;
        }
      }

      setSelectedStatus(targetStatus);
    }
  }, [status]);

  useEffect(() => {
    applyFilters(cases, searchQuery, selectedStatus, sortOption);
  }, [debouncedSearch, selectedStatus, sortOption, cases]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const currentUser = auth().currentUser;
      if (currentUser?.uid) {
        const snapshot = await firestore()
          .collection("cases")
          .where("userId", "==", currentUser.uid)
          .get();
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PropertyCase[];
        data.sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
        setCases(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    try {
      await deleteCase(caseId);
      setCases((prev) => prev.filter((c) => c.id !== caseId));
      Alert.alert(t("caseDeleted"), t("caseDeletedMsg"));
    } catch (error) {
      console.error("Error deleting case:", error);
      Alert.alert(t("errorTitle"), t("caseDeleteFailed"));
    }
  };

  const handleOpenStatusModal = (caseItem: PropertyCase) => {
    setSelectedCase(caseItem);
    setShowFullHistory(false);
    setIsStatusModalVisible(true);
  };

  const handleOpenReminderModal = (caseItem: PropertyCase) => {
    setSelectedCase(caseItem);
    setReminderNote(caseItem.reminderNote || "");
    setReminderDays(3);
    setIsReminderModalVisible(true);
  };

  const handleUpdateStatus = async (newStatus: CaseStatus) => {
    if (!selectedCase) return;
    setIsStatusModalVisible(false);

    try {
      const oldStatus = selectedCase.status;
      if (oldStatus === newStatus) return;

      const formattedTimestamp = new Date().toLocaleDateString(language === "BM" ? "ms-MY" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const changeLog = `${oldStatus} ➔ ${newStatus} on ${formattedTimestamp}`;
  const prevHistory = selectedCase.statusHistory || [];
  const lastLog = prevHistory.length > 0 ? prevHistory[prevHistory.length - 1] : "";
  const updatedHistory = lastLog === changeLog ? prevHistory : [...prevHistory, changeLog];

      await updateCase(selectedCase.id, {
        status: newStatus,
        statusHistory: updatedHistory,
      });

      // Update local state instantly so we don't have to wait for refetch
      const updatedCaseObj = { ...selectedCase, status: newStatus, statusHistory: updatedHistory };
      setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? updatedCaseObj : c)));
      setSelectedCase(updatedCaseObj);

      // Smart Follow-up prompt Alert
      Alert.alert(
        t("reminderPromptTitle"),
        t("reminderPromptMsg"),
        [
          {
            text: t("noBtn"),
            onPress: () => {},
            style: "cancel",
          },
          {
            text: t("yesBtn"),
            onPress: () => {
              setReminderNote("");
              setReminderDays(3);
              setIsReminderModalVisible(true);
            },
          },
        ],
        { cancelable: true }
      );
    } catch (err) {
      console.error("Error updating status:", err);
      Alert.alert(t("errorTitle"), "Failed to update case status.");
    }
  };

  const handleConfirmReminder = async () => {
    if (!selectedCase) return;
    setIsReminderModalVisible(false);

    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + reminderDays);
      targetDate.setHours(9, 0, 0, 0); // Scheduled to fire at 9:00 AM on that day

      const finalNote = reminderNote.trim() || `Check next milestone for ${selectedCase.namaCase}`;

      const notificationId = await scheduleCaseReminder(
        selectedCase.id,
        selectedCase.namaCase,
        finalNote,
        targetDate
      );

      await updateCase(selectedCase.id, {
        reminderDate: targetDate.toISOString(),
        reminderNote: finalNote,
        notificationId: notificationId || undefined,
      });

      const successMsg = language === "BM"
        ? `Peringatan ditetapkan pada ${targetDate.toLocaleDateString("ms-MY")}`
        : `Reminder scheduled for ${targetDate.toLocaleDateString("en-US")} at 9:00 AM`;

      Alert.alert("Success", successMsg);
    } catch (err) {
      console.error("Error scheduling reminder:", err);
      Alert.alert("Error", "Failed to schedule follow-up reminder.");
    }
  };

  const getReminderSummary = () => {
    const d = new Date();
    d.setDate(d.getDate() + reminderDays);
    return d.toLocaleDateString(language === "BM" ? "ms-MY" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const headerPaddingTop =
    Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: themeColors.canvasBackground,
        alignItems: "center",
        paddingTop: headerPaddingTop,
      }}
    >
      <View style={{ width: "100%", maxWidth: contentMaxWidth, flex: 1 }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: SPACING.lg,
            paddingTop: SPACING.sm,
            paddingBottom: SPACING.sm,
          }}
        >
        {/* Title row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: SPACING.md,
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: "700",
              color: themeColors.maroonPrimary,
            }}
          >
            {t("casesManagement")}
          </Text>
        </View>

        {/* Search Bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: themeColors.cardBackground,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            paddingHorizontal: SPACING.md,
            height: 52,
            marginBottom: SPACING.md,
          }}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={themeColors.textMuted}
            style={{ marginRight: SPACING.sm }}
          />
          <TextInput
            placeholder={t("searchPlaceholder")}
            placeholderTextColor={themeColors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              color: themeColors.textPrimary,
              fontSize: 15,
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={themeColors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Compact Status Filter & Controls */}
      <Animated.View
        entering={FadeInDown.duration(180)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: SPACING.lg,
          marginBottom: SPACING.md,
          gap: SPACING.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <MaterialCommunityIcons name="filter-variant" size={18} color={themeColors.maroonPrimary} />
          <Text style={{ color: themeColors.textMuted, fontSize: 12, fontWeight: "700" }}>
            {t("filterCases")}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsFilterModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`${t("filterCases")}: ${getStatusLabel(selectedStatus)}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderRadius: 999,
            borderColor: selectedStatus !== "All" ? themeColors.maroonPrimary : themeColors.borderColor,
            backgroundColor: selectedStatus !== "All" ? themeColors.maroonLight : themeColors.surfaceContainer,
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}
        >
          <Text style={{ color: selectedStatus !== "All" ? themeColors.maroonPrimary : themeColors.textSecondary, fontSize: 12, fontWeight: "800" }}>
            {getStatusLabel(selectedStatus)}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={themeColors.textMuted} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(200)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}
      >
        <Text style={{ fontSize: 13, fontWeight: "800", color: themeColors.textPrimary }}>
          {filteredCases.length} {filteredCases.length === 1 ? "case" : "cases"}
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsSortModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sort cases by ${CASE_SORT_OPTIONS.find((option) => option.id === sortOption)?.label}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: themeColors.surfaceContainer,
            borderColor: themeColors.borderColor,
          }}
        >
          <MaterialCommunityIcons name="sort-calendar-ascending" size={16} color={themeColors.textMuted} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textSecondary }}>
            {CASE_SORT_OPTIONS.find((option) => option.id === sortOption)?.label}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={themeColors.textMuted} />
        </TouchableOpacity>
      </Animated.View>

      {/* Main Cases FlashList */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
        </View>
      ) : (
        <AnimatedFlashList
          data={filteredCases}
          keyExtractor={(item: any) => item.id}
          style={{ flex: 1, width: "100%" }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: SPACING.lg,
            paddingBottom: Math.max(insets.bottom, 24) + 160,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={themeColors.maroonPrimary}
            />
          }
          renderItem={({ item }: { item: any }) => (
            <CaseCard
              case={item as PropertyCase}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push(`/case/${item.id}` as any);
              }}
              onDelete={handleDeleteCase}
              onStatusPress={handleOpenStatusModal}
              onReminderPress={handleOpenReminderModal}
            />
          )}
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 64,
              }}
            >
              <MaterialCommunityIcons
                name="folder-open-outline"
                size={64}
                color={themeColors.textMuted}
                style={{ marginBottom: SPACING.md }}
              />
              <Text
                style={{
                  fontSize: 16,
                  color: themeColors.textPrimary,
                  fontWeight: "600",
                  marginBottom: SPACING.xs,
                }}
              >
                {t("noCasesYet")}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: themeColors.textMuted,
                  textAlign: "center",
                }}
              >
                {searchQuery || selectedStatus !== "All"
                  ? t("tryResettingFilters")
                  : t("createCaseHint")}
              </Text>
            </View>
          }
        />
      )}

      </View>

      <Animated.View
        style={[
          {
            position: "absolute",
            right: 20,
            bottom: Math.max(insets.bottom, 28) + 80,
            zIndex: 999,
          },
          animatedFabStyle,
        ]}
      >
        <TouchableOpacity
          onPress={() => router.push("/case/form" as any)}
          activeOpacity={0.9}
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
          <MaterialCommunityIcons name="plus" size={30} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={isFilterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsFilterModalVisible(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 28) + 20,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: themeColors.borderColor,
                alignSelf: "center",
                marginBottom: 12,
              }}
            />
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: themeColors.textPrimary,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              {t("filterCases")}
            </Text>
            {FILTER_STATUSES.map((option) => {
              const active = selectedStatus === option;
              return (
                <TouchableOpacity
                  key={option}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedStatus(option);
                    setIsFilterModalVisible(false);
                  }}
                  style={{
                    minHeight: 46,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    marginBottom: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: active ? themeColors.maroonLight : "transparent",
                    borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: active ? themeColors.maroonPrimary : themeColors.textSecondary,
                    }}
                  >
                    {getStatusLabel(option)}
                  </Text>
                  {active ? <MaterialCommunityIcons name="check" size={18} color={themeColors.maroonPrimary} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={isSortModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSortModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsSortModalVisible(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 28) + 20,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: themeColors.borderColor,
                alignSelf: "center",
                marginBottom: 12,
              }}
            />
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: themeColors.textPrimary,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              Sort cases
            </Text>
            {CASE_SORT_OPTIONS.map((option) => {
              const active = sortOption === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSortOption(option.id);
                    setIsSortModalVisible(false);
                  }}
                  style={{
                    minHeight: 46,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    marginBottom: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: active ? themeColors.maroonLight : "transparent",
                    borderColor: active ? themeColors.maroonPrimary : themeColors.borderColor,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: active ? themeColors.maroonPrimary : themeColors.textSecondary }}>
                    {option.label}
                  </Text>
                  {active ? <MaterialCommunityIcons name="check" size={18} color={themeColors.maroonPrimary} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 1. Status Selection Action Sheet Modal */}
      <Modal
        visible={isStatusModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsStatusModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsStatusModalVisible(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "85%",
              paddingHorizontal: 18,
              paddingTop: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: themeColors.borderColor,
                alignSelf: "center",
                marginBottom: 12,
              }}
            />

            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: themeColors.textPrimary,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              {t("statusUpdateTitle")}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
              style={{ maxHeight: 420 }}
            >
              <View style={{ marginBottom: 10 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: themeColors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  Main Progress
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {PRIMARY_STATUS_LIST.map((st) => {
                    const isActive = selectedCase?.status === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        onPress={() => handleUpdateStatus(st)}
                        style={{
                          paddingVertical: 9,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isActive ? themeColors.maroonPrimary : themeColors.borderColor,
                          backgroundColor: isActive ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                          minWidth: "45%",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: isActive ? "#FFFFFF" : themeColors.textPrimary,
                          }}
                        >
                          {st}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: themeColors.textSecondary,
                    marginTop: 12,
                    marginBottom: 8,
                  }}
                >
                  Other Statuses
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {SECONDARY_STATUS_LIST.map((st) => {
                    const isActive = selectedCase?.status === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        onPress={() => handleUpdateStatus(st)}
                        style={{
                          paddingVertical: 9,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isActive ? themeColors.maroonPrimary : themeColors.borderColor,
                          backgroundColor: isActive ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                          minWidth: "45%",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: isActive ? "#FFFFFF" : themeColors.textPrimary,
                          }}
                        >
                          {st}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {selectedCase?.statusHistory && selectedCase.statusHistory.length > 0 && (
                <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: themeColors.borderColor, paddingTop: 10 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: themeColors.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    {t("statusHistoryLog")}
                  </Text>

                  <View style={{ maxHeight: showFullHistory ? 220 : 150 }}>
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      {(() => {
                        const newestFirst = [...selectedCase.statusHistory].reverse();
                        const logsToShow = showFullHistory ? newestFirst : newestFirst.slice(0, 5);
                        return logsToShow.map((log, idx) => (
                          <View
                            key={`${idx}-${log}`}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 7,
                            }}
                          >
                            <MaterialCommunityIcons name="circle" size={6} color={themeColors.maroonPrimary} />
                            <Text style={{ fontSize: 12, color: themeColors.textMuted, flex: 1 }}>{log}</Text>
                          </View>
                        ));
                      })()}
                    </ScrollView>
                  </View>

                  {selectedCase.statusHistory.length > 5 && (
                    <View
                      style={{
                        marginTop: 6,
                        alignItems: "flex-end",
                      }}
                    >
                      <TouchableOpacity onPress={() => setShowFullHistory((prev) => !prev)}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.maroonPrimary }}>
                          {showFullHistory ? "Show less" : "Show all"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: themeColors.borderColor,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 28) + 20,
                backgroundColor: themeColors.cardBackground,
              }}
            >
              <TouchableOpacity
                onPress={() => setIsStatusModalVisible(false)}
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Tutup" : "Close"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 2. Reminder Scheduling Modal */}
      <Modal
        visible={isReminderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReminderModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: themeColors.cardBackground,
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 360,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 5,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: themeColors.textPrimary,
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              {t("scheduleReminderTitle")}
            </Text>

            <Text
              style={{
                fontSize: 13,
                color: themeColors.textMuted,
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              {language === "BM" 
                ? `Jadualkan peringatan susulan automatik untuk kes "${selectedCase?.namaCase}"`
                : `Schedule a follow-up push reminder notification for "${selectedCase?.namaCase}"`}
            </Text>

            {/* Quick Preset Days Selector */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20, gap: 6 }}>
              {[1, 3, 7, 14].map((days) => {
                const isActive = reminderDays === days;
                let label = "";
                if (days === 1) label = language === "BM" ? "Esok" : "1 Day";
                else if (days === 3) label = language === "BM" ? "3 Hari" : "3 Days";
                else if (days === 7) label = language === "BM" ? "1 Mggu" : "1 Week";
                else label = language === "BM" ? "2 Mggu" : "2 Weeks";

                return (
                  <TouchableOpacity
                    key={days}
                    onPress={() => setReminderDays(days)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isActive ? themeColors.maroonPrimary : themeColors.borderColor,
                      backgroundColor: isActive ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: isActive ? "#FFFFFF" : themeColors.textPrimary,
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Note Input */}
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: themeColors.textSecondary,
                marginBottom: 8,
              }}
            >
              {t("reminderNoteLabel")}
            </Text>
            <TextInput
              placeholder={t("reminderNotePlaceholder")}
              placeholderTextColor={themeColors.textMuted}
              value={reminderNote}
              onChangeText={setReminderNote}
              autoFocus={isReminderModalVisible}
              style={{
                backgroundColor: themeColors.surfaceContainer,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                color: themeColors.textPrimary,
                fontSize: 14,
                textAlignVertical: "top",
                height: 80,
                marginBottom: 16,
              }}
              multiline
            />

            {/* Dynamic summary sentence */}
            <Text
              style={{
                fontSize: 13,
                color: themeColors.maroonPrimary,
                fontWeight: "600",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              {language === "BM"
                ? `Fires: ${getReminderSummary()} (9:00 AM)`
                : `Fires: ${getReminderSummary()} (9:00 AM)`}
            </Text>

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setIsReminderModalVisible(false)}
                style={{
                  flex: 1,
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textSecondary }}>
                  {language === "BM" ? "Batal" : "Cancel"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmReminder}
                style={{
                  flex: 1,
                  backgroundColor: themeColors.maroonPrimary,
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
                  {t("confirmBtn")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* End of modals */}
    </View>
  );
}
