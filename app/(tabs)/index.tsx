import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
  StatusBar,
  StyleSheet,
  Modal,
  AppState,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline, Defs, LinearGradient, Stop, Circle } from "react-native-svg";
import { firestore, auth } from "@/services/firebase";

import { CaseCard } from "@/components";
import { deleteCase } from "@/services/storage";
import { getCurrentUserProfile } from "@/services/auth";
import type { PropertyCase, UserProfile } from "@/types/case";
import type { PropertyListing } from "@/types/listing";
import { useAppSettings } from "@/context/AppSettingsContext";

const AVAILABLE_YEARS = ["2024", "2025", "2026"];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { themeColors, t } = useAppSettings();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [allCases, setAllCases] = useState<PropertyCase[]>([]);
  const [recentCases, setRecentCases] = useState<PropertyCase[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Year Selector State
  const [selectedYear, setSelectedYear] = useState("2026");
  const [showYearModal, setShowYearModal] = useState(false);

  // Fetch Firestore Listings and Cases in Realtime
  useEffect(() => {
    const profile = getCurrentUserProfile();
    if (profile) {
      setUserProfile(profile);
    }

    const currentUser = auth().currentUser;
    const userId = currentUser?.uid;

    if (!userId) {
      setIsLoading(false);
      return;
    }

    let listingsLoaded = false;
    let casesLoaded = false;

    const checkLoadingFinished = () => {
      if (listingsLoaded && casesLoaded) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    let unsubListings: (() => void) | null = null;
    let unsubCases: (() => void) | null = null;

    const attachDashboardListeners = () => {
      if (unsubListings) unsubListings();
      if (unsubCases) unsubCases();

      // Realtime Listener for Listings
      unsubListings = firestore()
        .collection("publicListings")
        .onSnapshot(
          (snapshot) => {
            if (snapshot) {
              const fetchedListings: PropertyListing[] = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }) as PropertyListing);

              setListings(fetchedListings);
            }
            listingsLoaded = true;
            checkLoadingFinished();
          },
          (error) => {
            console.error("Realtime listings listener error:", error);
            listingsLoaded = true;
            checkLoadingFinished();
          }
        );

      // Realtime Listener for Cases
      unsubCases = firestore()
        .collection("cases")
        .where("userId", "==", userId)
        .onSnapshot(
          (snapshot) => {
            if (snapshot) {
              const fetchedCases: PropertyCase[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as PropertyCase[];

              setAllCases(fetchedCases);

              // Sort & take top 3 for Recent Cases list
              const sortedCases = [...fetchedCases].sort((a, b) =>
                (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "")
              );
              setRecentCases(sortedCases.slice(0, 3));
            }
            casesLoaded = true;
            checkLoadingFinished();
          },
          (error) => {
            console.error("Realtime cases listener error:", error);
            casesLoaded = true;
            checkLoadingFinished();
          }
        );
    };

    const detachDashboardListeners = () => {
      if (unsubListings) {
        unsubListings();
        unsubListings = null;
      }
      if (unsubCases) {
        unsubCases();
        unsubCases = null;
      }
    };

    // Attach immediately
    attachDashboardListeners();

    // Pause listeners when app goes to background to save battery
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        attachDashboardListeners();
      } else {
        detachDashboardListeners();
      }
    });

    return () => {
      detachDashboardListeners();
      subscription.remove();
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const listSnap = await firestore().collection("publicListings").get();
      const fetchedListings: PropertyListing[] = listSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PropertyListing[];
      setListings(fetchedListings);

      const currentUser = auth().currentUser;
      const caseSnap = await firestore()
        .collection("cases")
        .where("userId", "==", currentUser?.uid || "")
        .get();
      const fetchedCases: PropertyCase[] = caseSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PropertyCase[];
      setAllCases(fetchedCases);
      setRecentCases(
        [...fetchedCases]
          .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""))
          .slice(0, 3)
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    try {
      await deleteCase(caseId);
      setRecentCases((prev) => prev.filter((c) => c.id !== caseId));
      setAllCases((prev) => prev.filter((c) => c.id !== caseId));
      Alert.alert(t("caseDeleted"), t("caseDeletedMsg"));
    } catch (error) {
      Alert.alert(t("errorTitle"), t("caseDeleteFailed"));
    }
  };

  // Unified status & record calculation strictly from active Cases
  const metricAktif = allCases.filter((c) => {
    const s = (c.status || "").toLowerCase().trim();
    return s === "viewing" || s === "booking paid" || s === "spa signed" || s === "loan approved";
  }).length;

  const metricBooking = allCases.filter((c) => {
    const s = (c.status || "").toLowerCase().trim();
    return s === "booking paid";
  }).length;

  const metricUnderLoan = allCases.filter((c) => {
    const s = (c.status || "").toLowerCase().trim();
    const f = (c.finance || "").toLowerCase().trim();
    return f === "bank loan" || s === "loan approved";
  }).length;

  const metricUnderSpa = allCases.filter((c) => {
    const s = (c.status || "").toLowerCase().trim();
    return s === "spa signed";
  }).length;

  const metricSold = allCases.filter((c) => {
    const s = (c.status || "").toLowerCase().trim();
    return s === "completed";
  }).length;

  const metricExpired = allCases.filter((c) => {
    const s = (c.status || "").toLowerCase().trim();
    return s === "cancelled";
  }).length;

  // Monthly Performance Chart Calculation for selectedYear strictly using Cases
  const yearRecords = allCases.filter((c) => {
    const dateStr = c.createdAt || c.tarikh || "";
    if (!dateStr) return false;
    const createdDate = new Date(dateStr);
    return !isNaN(createdDate.getTime()) && createdDate.getFullYear().toString() === selectedYear;
  });

  const monthlyCounts = Array(12).fill(0);
  yearRecords.forEach((r) => {
    const createdDate = new Date(r.createdAt);
    if (!isNaN(createdDate.getTime())) {
      const month = createdDate.getMonth();
      if (month >= 0 && month <= 11) {
        monthlyCounts[month] += 1;
      }
    }
  });

  const totalYearRecords = yearRecords.length;
  const maxVal = Math.max(...monthlyCounts, 1);

  // Generate SVG Points for Line Chart
  const chartPoints = monthlyCounts
    .map((val, idx) => {
      const x = (idx / 11) * 300;
      const y = 110 - (val / maxVal) * 85;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const fillPoints = `0,120 ${chartPoints} 300,120`;

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      {/* TopAppBar */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: themeColors.cardBackground,
            borderBottomColor: themeColors.borderColor,
            paddingTop: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6,
          },
        ]}
      >
        <Text style={[styles.topBarTitle, { color: themeColors.maroonPrimary }]}>
          Master Listing
        </Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: themeColors.surfaceContainer }]}
            onPress={() => router.push("/(tabs)/calculator" as any)}
          >
            <MaterialCommunityIcons name="calculator" size={22} color={themeColors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: themeColors.surfaceContainer }]}
            onPress={() => router.push("/(tabs)/listings")}
          >
            <MaterialCommunityIcons name="magnify" size={22} color={themeColors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 24) + 104,
        }}
        scrollIndicatorInsets={{ bottom: Math.max(insets.bottom, 24) + 104 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[themeColors.maroonPrimary]}
          />
        }
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={[styles.welcomeTitle, { color: themeColors.textPrimary }]}>
            {t("greeting")}, {userProfile?.displayName ? userProfile.displayName.split(" ")[0] : "Agent"} 👋
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: themeColors.textMuted }]}>
            {t("performanceSummary")}
          </Text>
        </View>

        {/* Real Live Metrics Grid */}
        <View style={styles.metricsGrid}>
          {/* Aktif */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "Active" } })}
            style={[styles.metricCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
          >
            <View style={styles.metricTopRow}>
              <MaterialCommunityIcons name="check-circle" size={22} color="#DC2626" />
              <Text style={[styles.metricNumber, { color: themeColors.textPrimary }]}>
                {metricAktif}
              </Text>
            </View>
            <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
              {t("statusAktif")}
            </Text>
          </TouchableOpacity>

          {/* Booking */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "Booking Paid" } })}
            style={[styles.metricCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
          >
            <View style={styles.metricTopRow}>
              <MaterialCommunityIcons name="calendar-check" size={22} color="#2563EB" />
              <Text style={[styles.metricNumber, { color: themeColors.textPrimary }]}>
                {metricBooking}
              </Text>
            </View>
            <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
              {t("statusBooking")}
            </Text>
          </TouchableOpacity>

          {/* Under Loan */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "Loan Approved" } })}
            style={[styles.metricCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
          >
            <View style={styles.metricTopRow}>
              <MaterialCommunityIcons name="bank" size={22} color="#9333EA" />
              <Text style={[styles.metricNumber, { color: themeColors.textPrimary }]}>
                {metricUnderLoan}
              </Text>
            </View>
            <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
              {t("statusUnderLoan")}
            </Text>
          </TouchableOpacity>

          {/* Under SPA */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "SPA Signed" } })}
            style={[styles.metricCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
          >
            <View style={styles.metricTopRow}>
              <MaterialCommunityIcons name="file-document-outline" size={22} color="#F97316" />
              <Text style={[styles.metricNumber, { color: themeColors.textPrimary }]}>
                {metricUnderSpa}
              </Text>
            </View>
            <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
              {t("statusUnderSpa")}
            </Text>
          </TouchableOpacity>

          {/* Sold */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "Completed" } })}
            style={[styles.metricCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
          >
            <View style={styles.metricTopRow}>
              <MaterialCommunityIcons name="tag-outline" size={22} color="#16A34A" />
              <Text style={[styles.metricNumber, { color: themeColors.textPrimary }]}>
                {metricSold}
              </Text>
            </View>
            <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
              {t("statusSold")}
            </Text>
          </TouchableOpacity>

          {/* Expired */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "Cancelled" } })}
            style={[styles.metricCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
          >
            <View style={styles.metricTopRow}>
              <MaterialCommunityIcons name="clock-outline" size={22} color="#64748B" />
              <Text style={[styles.metricNumber, { color: themeColors.textPrimary }]}>
                {metricExpired}
              </Text>
            </View>
            <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
              {t("statusExpired")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Monthly Performance Section */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
          ]}
        >
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.chartTitle, { color: themeColors.maroonPrimary }]}>
              {t("monthlyPerformance")}
            </Text>
            <TouchableOpacity
              onPress={() => setShowYearModal(true)}
              style={[
                styles.yearDropdownBadge,
                { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor },
              ]}
            >
              <Text style={[styles.yearDropdownText, { color: themeColors.textPrimary }]}>
                {selectedYear}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color={themeColors.textPrimary} />
            </TouchableOpacity>
          </View>

          {totalYearRecords === 0 ? (
            <View style={styles.chartEmptyContainer}>
              <MaterialCommunityIcons name="chart-line-variant" size={36} color={themeColors.textMuted} />
              <Text style={[styles.chartEmptyText, { color: themeColors.textPrimary }]}>
                {t("noCasesYet")}
              </Text>
              <Text style={[styles.chartEmptySubtext, { color: themeColors.textMuted }]}>
                {selectedYear}
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              <Svg height="130" width="100%" viewBox="0 0 300 130">
                <Defs>
                  <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={themeColors.maroonPrimary} stopOpacity="0.3" />
                    <Stop offset="1" stopColor={themeColors.maroonPrimary} stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>
                <Polyline points={fillPoints} fill="url(#chartGrad)" />
                <Polyline
                  points={chartPoints}
                  fill="none"
                  stroke={themeColors.maroonPrimary}
                  strokeWidth="3"
                />
                {monthlyCounts.map((val, idx) => {
                  if (val === 0) return null;
                  const x = (idx / 11) * 300;
                  const y = 110 - (val / maxVal) * 85;
                  return (
                    <Circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r="4"
                      fill={themeColors.maroonPrimary}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                  );
                })}
              </Svg>

              <View style={styles.chartMonthLabels}>
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
                  (m) => (
                    <Text key={m} style={[styles.chartMonthText, { color: themeColors.textMuted }]}>
                      {m}
                    </Text>
                  )
                )}
              </View>
            </View>
          )}
        </View>

        {/* Recent Cases Section */}
        <View style={styles.recentSectionHeader}>
          <Text style={[styles.recentTitle, { color: themeColors.textPrimary }]}>
            {t("recentCases")}
          </Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/cases")}>
            <Text style={[styles.viewAllText, { color: themeColors.maroonPrimary }]}>
              {t("viewAll")}
            </Text>
          </TouchableOpacity>
        </View>

        {recentCases.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
            ]}
          >
            <MaterialCommunityIcons
              name="briefcase-outline"
              size={42}
              color={themeColors.textMuted}
            />
            <Text style={[styles.emptyCardTitle, { color: themeColors.textPrimary }]}>
              {t("noCasesYet")}
            </Text>
            <Text style={[styles.emptyCardSub, { color: themeColors.textMuted }]}>
              {t("addFirstCaseSub")}
            </Text>
          </View>
        ) : (
          recentCases.map((item) => (
            <CaseCard
              key={item.id}
              case={item}
              onPress={() => router.push(`/case/${item.id}` as any)}
              onDelete={handleDeleteCase}
            />
          ))
        )}
      </ScrollView>

      {/* Year Selection Modal */}
      <Modal
        visible={showYearModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowYearModal(false)}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
            ]}
          >
            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
              {t("selectYearTitle")}
            </Text>

            {AVAILABLE_YEARS.map((yr) => {
              const isSelected = selectedYear === yr;
              return (
                <TouchableOpacity
                  key={yr}
                  onPress={() => {
                    setSelectedYear(yr);
                    setShowYearModal(false);
                  }}
                  style={[
                    styles.yearOptionRow,
                    isSelected && { backgroundColor: themeColors.maroonPrimary },
                  ]}
                >
                  <Text
                    style={[
                      styles.yearOptionText,
                      { color: isSelected ? "#FFFFFF" : themeColors.textPrimary },
                    ]}
                  >
                    {yr}
                  </Text>
                  {isSelected && (
                    <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  iconButton: {
    padding: 6,
    borderRadius: 20,
  },
  welcomeSection: {
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  welcomeSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    width: "48%",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  metricTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: "800",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  chartCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  chartHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  yearDropdownBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  yearDropdownText: {
    fontSize: 14,
    fontWeight: "700",
  },
  chartEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  chartEmptyText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  chartEmptySubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  chartMonthLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  chartMonthText: {
    fontSize: 9,
    fontWeight: "600",
  },
  recentSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
  },
  emptyCardSub: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalContent: {
    width: "100%",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  yearOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  yearOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
