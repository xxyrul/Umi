import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  StatusBar,
  Modal,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING } from "@/constants/theme";
import { useAppSettings } from "@/context/AppSettingsContext";
import { FilterChip, CaseCard } from "@/components";
import { deleteCase, updateCase } from "@/services/storage";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
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

export default function CasesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { themeColors, language, t } = useAppSettings();
  const contentMaxWidth = Math.min(width, 760);
  const fabRight = Math.max(20, (width - contentMaxWidth) / 2 + 20);
  const [cases, setCases] = useState<PropertyCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<PropertyCase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus | "All" | "Active">("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ScrollView Auto-Scroll Ref & Layout state
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollViewWidth, setScrollViewWidth] = useState(300);
  const chipLayouts = useRef<{ [key: string]: { x: number; width: number } }>({});

  // Status Change Modal State
  const [selectedCase, setSelectedCase] = useState<PropertyCase | null>(null);
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Reminder Scheduling Modal State
  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const [reminderNote, setReminderNote] = useState("");
  const [reminderDays, setReminderDays] = useState<number>(3); // Default to 3 days

  const { status } = useLocalSearchParams<{ status?: string }>();

  const applyFilters = (
    allCases: PropertyCase[],
    queryText: string,
    status: CaseStatus | "All" | "Active"
  ) => {
    let result = [...allCases];

    // Apply Search Query
    if (queryText.trim()) {
      const lowerQuery = queryText.toLowerCase();
      result = result.filter(
        (c) =>
          c.namaCase.toLowerCase().includes(lowerQuery) ||
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

    setFilteredCases(result);
  };

  // Realtime Firestore Listener
  useEffect(() => {
    const currentUser = auth().currentUser;
    const userId = currentUser?.uid;

    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = firestore()
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

    return () => unsubscribe();
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

      // Scroll to the selected chip in horizontal Carousel
      const timer = setTimeout(() => {
        const layout = chipLayouts.current[targetStatus];
        if (layout && scrollViewRef.current && scrollViewWidth > 0) {
          const targetX = layout.x - (scrollViewWidth / 2) + (layout.width / 2);
          scrollViewRef.current.scrollTo({
            x: Math.max(0, targetX),
            animated: true,
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [status, scrollViewWidth]);

  useEffect(() => {
    applyFilters(cases, searchQuery, selectedStatus);
  }, [searchQuery, selectedStatus, cases]);

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

  const handleFilterPress = (status: CaseStatus | "All" | "Active") => {
    setSelectedStatus(status);

    const layout = chipLayouts.current[status];
    if (layout && scrollViewRef.current) {
      const targetX = layout.x - (scrollViewWidth / 2) + (layout.width / 2);
      scrollViewRef.current.scrollTo({
        x: Math.max(0, targetX),
        animated: true,
      });
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
      <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
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

      {/* Horizontal Status Chips Carousel */}
      <View style={{ marginBottom: SPACING.md }}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg }}
          onLayout={(e) => setScrollViewWidth(e.nativeEvent.layout.width)}
        >
          {FILTER_STATUSES.map((status) => (
            <View
              key={status}
              onLayout={(e) => {
                chipLayouts.current[status] = {
                  x: e.nativeEvent.layout.x,
                  width: e.nativeEvent.layout.width,
                };
              }}
            >
              <FilterChip
                label={status === "All" ? t("all") : status}
                isActive={selectedStatus === status}
                onPress={() => handleFilterPress(status)}
              />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Cases List */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
        </View>
      ) : (
        <FlatList
          data={filteredCases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: SPACING.lg,
            paddingBottom: 130,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={themeColors.maroonPrimary}
            />
          }
          renderItem={({ item }) => (
            <CaseCard
              case={item}
              onPress={() => router.push(`/case/${item.id}` as any)}
              onDelete={handleDeleteCase}
              onStatusPress={handleOpenStatusModal}
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

      <TouchableOpacity
        onPress={() => router.push("/case/form" as any)}
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
                paddingBottom: insets.bottom + 12,
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
