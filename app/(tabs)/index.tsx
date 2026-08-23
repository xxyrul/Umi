import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown } from "react-native-reanimated";
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
  Linking,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline, Defs, LinearGradient, Stop, Circle } from "react-native-svg";
import { firestore, auth } from "@/services/firebase";
import {
  syncNotificationStateWithCloud,
  dismissAnnouncementCloud,
} from "@/services/notificationStorage";

import { Image as ExpoImage } from "expo-image";
import { CaseCard } from "@/components";
import { deleteCase, getCaseMetrics } from "@/services/storage";
import { getCurrentUserProfile, getUserInitials } from "@/services/auth";
import type { PropertyCase, UserProfile } from "@/types/case";
import type { PropertyListing } from "@/types/listing";
import { useAppSettings } from "@/context/AppSettingsContext";

const currentYear = new Date().getFullYear();
const AVAILABLE_YEARS = [String(currentYear - 2), String(currentYear - 1), String(currentYear), String(currentYear + 1)];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { themeColors, t, language } = useAppSettings();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [metrics, setMetrics] = useState({ totalCases: 0, aktif: 0, booking: 0, underLoan: 0, underSpa: 0, sold: 0, expired: 0 });
  const [allCases, setAllCases] = useState<PropertyCase[]>([]);
  const [recentCases, setRecentCases] = useState<PropertyCase[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Year Selector State
  const [selectedYear, setSelectedYear] = useState("2026");
  const [showYearModal, setShowYearModal] = useState(false);

  // Announcement State
  const [announcement, setAnnouncement] = useState<any>(null);
  const [dismissedAnnIds, setDismissedAnnIds] = useState<string[]>([]);
  const [dismissedLoaded, setDismissedLoaded] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const recentAnnouncementsRef = useRef<any[]>([]);

  // Calculate unread announcements count
  const updateUnreadCount = useCallback(async (annList?: any[]) => {
    try {
      const list = annList || recentAnnouncementsRef.current;
      if (!list || list.length === 0) {
        setUnreadNotifCount(0);
        return;
      }

      const [storedRead, storedLastSeen] = await Promise.all([
        AsyncStorage.getItem("@read_notification_ids"),
        AsyncStorage.getItem("@last_seen_notifications_at"),
      ]);

      const readIds: string[] = storedRead ? JSON.parse(storedRead) : [];
      const lastSeenTime = storedLastSeen ? new Date(storedLastSeen).getTime() : 0;

      let unread = 0;
      for (const item of list) {
        const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
        const isRead = readIds.includes(item.id) || (lastSeenTime > 0 && itemTime <= lastSeenTime);
        if (!isRead) {
          unread++;
        }
      }
      setUnreadNotifCount(unread);
    } catch (e) {
      console.warn("Failed to calculate unread notifications count", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      updateUnreadCount();
    }, [updateUnreadCount])
  );

  // Load & sync dismissed announcement IDs and read state from Firestore / local storage
  useEffect(() => {
    const currentUser = auth().currentUser;
    syncNotificationStateWithCloud(currentUser?.uid)
      .then((state) => {
        if (state.dismissedIds) {
          setDismissedAnnIds(state.dismissedIds);
        }
        updateUnreadCount();
      })
      .catch(() => {})
      .finally(() => setDismissedLoaded(true));
  }, [updateUnreadCount]);

  const handleDismissAnnouncement = async (id: string) => {
    const currentUser = auth().currentUser;
    const updated = await dismissAnnouncementCloud(id, currentUser?.uid);
    setDismissedAnnIds(updated);
  };

  const fetchMetricsData = async () => {
    try {
      const data = await getCaseMetrics();
      setMetrics(data);
    } catch (e) {
      console.warn("Error fetching metrics", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMetricsData();
    }, [])
  );

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

    let unsubCases: (() => void) | null = null;
    let unsubAnn: (() => void) | null = null;

    const attachDashboardListeners = () => {

      if (unsubCases) {
        unsubCases();
        unsubCases = null;
      }
      if (unsubAnn) {
        unsubAnn();
        unsubAnn = null;
      }

      // Realtime Listener for Announcements
      unsubAnn = firestore()
        .collection("announcements")
        .orderBy("createdAt", "desc")
        .limit(20)
        .onSnapshot(
          (snapshot) => {
            if (snapshot && !snapshot.empty) {
              const allDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
              recentAnnouncementsRef.current = allDocs;
              setAnnouncement(allDocs[0]);
              updateUnreadCount(allDocs);
            } else {
              recentAnnouncementsRef.current = [];
              setAnnouncement(null);
              setUnreadNotifCount(0);
            }
          },
          (error) => {
            console.error("Realtime announcement listener error:", error);
          }
        );

      listingsLoaded = true;
      checkLoadingFinished();      // Realtime Listener for Cases
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

      if (unsubCases) {
        unsubCases();
        unsubCases = null;
      }
      if (unsubAnn) {
        unsubAnn();
        unsubAnn = null;
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
      await fetchMetricsData();
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

  const metricAktif = metrics.aktif;
  const metricBooking = metrics.booking;
  const metricUnderLoan = metrics.underLoan;
  const metricUnderSpa = metrics.underSpa;
  const metricSold = metrics.sold;
  const metricExpired = metrics.expired;

  // Time-based automated greeting
  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return language === "BM" ? "Selamat Pagi" : "Good Morning";
    if (hour >= 12 && hour < 15) return language === "BM" ? "Selamat Tengah Hari" : "Good Afternoon";
    if (hour >= 15 && hour < 19) return language === "BM" ? "Selamat Petang" : "Good Evening";
    return language === "BM" ? "Selamat Malam" : "Good Night";
  }, [language]);

  // Today's Follow-up Action Items
  const todayActionCases = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return allCases.filter((c) => {
      if (!c.reminderDate) return false;
      const remStr = c.reminderDate.split("T")[0];
      return remStr <= todayStr && c.status !== "Completed" && c.status !== "Cancelled";
    });
  }, [allCases]);

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
        <Text style={[styles.topBarTitle, { color: themeColors.maroonPrimary, textTransform: "none", fontSize: 20 }]}>
          artha
        </Text>

        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          {/* Notifications Inbox Bell */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: themeColors.surfaceContainer }]}
            onPress={() => router.push("/notifications" as any)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name={unreadNotifCount > 0 ? "bell-badge-outline" : "bell-outline"}
              size={22}
              color={unreadNotifCount > 0 ? themeColors.maroonPrimary : themeColors.textPrimary}
            />
            {unreadNotifCount > 0 && (
              <View style={[styles.badgePill, { backgroundColor: themeColors.maroonPrimary }]}>
                <Text style={styles.badgeText}>
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Profile / Settings Shortcut */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: themeColors.surfaceContainer }]}
            onPress={() => router.push("/(tabs)/profile" as any)}
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color={themeColors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 24) + 120,
        }}
        scrollIndicatorInsets={{ bottom: Math.max(insets.bottom, 24) + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[themeColors.maroonPrimary]}
          />
        }
      >
        {/* Announcement Banner */}
        {dismissedLoaded && announcement && !dismissedAnnIds.includes(announcement.id) && (() => {
          const isMalay = language === "BM";
          const annTitle = isMalay
            ? (announcement.titleBM || announcement.title)
            : (announcement.titleEN || announcement.title);
          const annMessage = isMalay
            ? (announcement.messageBM || announcement.message)
            : (announcement.messageEN || announcement.message);

          return (
            <Animated.View entering={FadeInDown.springify()} style={{ backgroundColor: (announcement.type || "").toUpperCase() === "URGENT" ? "#DC26261A" : (announcement.type || "").toUpperCase() === "LISTING_ALERT" ? "#2563EB1A" : themeColors.cardBackground, borderRadius: 14, borderWidth: 1, borderColor: (announcement.type || "").toUpperCase() === "URGENT" ? "#EF444440" : themeColors.borderColor, padding: 14, marginBottom: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => {
                  const text = ((announcement.title || "") + " " + (announcement.message || "")).toLowerCase();
                  if (text.includes("update") || text.includes("version")) {
                    router.push("/updates" as any);
                  }
                }}
                style={{ flex: 1 }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary, marginBottom: 4 }}>
                  {annTitle}
                </Text>
                <Text style={{ fontSize: 12, color: themeColors.textMuted, lineHeight: 17 }}>
                  {annMessage}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleDismissAnnouncement(announcement.id);
                }}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                style={{ padding: 4 }}
              >
                <MaterialCommunityIcons name="close" size={18} color={themeColors.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          );
        })()}

        {/* Welcome Section */}
        <Animated.View entering={FadeInDown.duration(180)} style={styles.welcomeSection}>
          <Text style={[styles.welcomeTitle, { color: themeColors.textPrimary }]}>
            {timeGreeting},{" "}
            {userProfile?.displayName
              ? userProfile.displayName.split(" ")[0].charAt(0).toUpperCase() +
                userProfile.displayName.split(" ")[0].slice(1)
              : "Agent"}{" "}
            ☀️
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: themeColors.textMuted }]}>
            {language === "BM"
              ? `${allCases.length} kes aktif dipantau dalam saluran transaksi anda`
              : `${allCases.length} active ${allCases.length === 1 ? "case" : "cases"} tracked in your transaction pipeline`}
          </Text>
        </Animated.View>

        {/* 📌 TODAY'S ACTION ITEMS & REMINDERS */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <MaterialCommunityIcons name="calendar-alert" size={18} color={themeColors.maroonPrimary} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                {language === "BM" ? "Tindakan Hari Ini" : "Today's Action Items"}
              </Text>
            </View>
            {todayActionCases.length > 0 && (
              <View style={{ backgroundColor: `${themeColors.maroonPrimary}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: themeColors.maroonPrimary }}>
                  {todayActionCases.length} {language === "BM" ? "Perlu Tindakan" : "Action Needed"}
                </Text>
              </View>
            )}
          </View>

          {todayActionCases.length === 0 ? (
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 14,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={22} color="#10B981" />
              <Text style={{ fontSize: 13, color: themeColors.textMuted, flex: 1 }}>
                {language === "BM"
                  ? "Semua tindakan susulan selesai untuk hari ini."
                  : "All follow-up actions and reminders are clear for today."}
              </Text>
            </View>
          ) : (
            todayActionCases.slice(0, 3).map((caseItem) => (
              <View
                key={caseItem.id}
                style={{
                  backgroundColor: themeColors.cardBackground,
                  borderColor: themeColors.borderColor,
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 8,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                      {caseItem.namaCase || "Follow-up Deal"}
                    </Text>
                    <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 2 }}>
                      {caseItem.clientName || caseItem.buyerName || caseItem.vendorName ? `${caseItem.clientName || caseItem.buyerName || caseItem.vendorName} • ` : ""}
                      {caseItem.reminderNote || (language === "BM" ? "Semak status milestone seterusnya" : "Check next milestone")}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: `${themeColors.maroonPrimary}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: themeColors.maroonPrimary }}>
                      {caseItem.status}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  {(caseItem.buyerPhone || caseItem.vendorPhone) ? (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => {
                        const rawPhone = (caseItem.buyerPhone || caseItem.vendorPhone || "").replace(/[^0-9]/g, "");
                        const formatted = rawPhone.startsWith("6") ? rawPhone : `60${rawPhone.replace(/^0/, "")}`;
                        Linking.openURL(`whatsapp://send?phone=${formatted}`).catch(() => {});
                      }}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        backgroundColor: "#25D366",
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                    >
                      <MaterialCommunityIcons name="whatsapp" size={16} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>WhatsApp</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => router.push(`/case/${caseItem.id}` as any)}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: themeColors.surfaceContainer,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <MaterialCommunityIcons name="folder-open-outline" size={16} color={themeColors.textPrimary} />
                    <Text style={{ color: themeColors.textPrimary, fontSize: 12, fontWeight: "700" }}>
                      {language === "BM" ? "Lihat Kes" : "View Case"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* 💼 6-STAGE TRANSACTION PIPELINE (Compact Full-Word Horizontal Pills) */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary, marginBottom: 8 }}>
            {language === "BM" ? "Saluran Transaksi" : "Transaction Pipeline"}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
            {/* Aktif */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "Active" } })}
              style={{
                width: "48.5%",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 9,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, paddingRight: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" }} />
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Aktif" : "Active"}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "900", color: themeColors.textPrimary }}>
                {metricAktif}
              </Text>
            </TouchableOpacity>

            {/* Booking */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "Booking Paid" } })}
              style={{
                width: "48.5%",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 9,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, paddingRight: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#3B82F6" }} />
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Bayaran Booking" : "Booking Deposit"}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "900", color: themeColors.textPrimary }}>
                {metricBooking}
              </Text>
            </TouchableOpacity>

            {/* Under Loan */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "Loan Approved" } })}
              style={{
                width: "48.5%",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 9,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, paddingRight: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#9333EA" }} />
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Pinjaman Bank" : "Under Loan"}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "900", color: themeColors.textPrimary }}>
                {metricUnderLoan}
              </Text>
            </TouchableOpacity>

            {/* Under SPA */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "SPA Signed" } })}
              style={{
                width: "48.5%",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 9,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, paddingRight: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#F97316" }} />
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Perjanjian SPA" : "Under SPA"}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "900", color: themeColors.textPrimary }}>
                {metricUnderSpa}
              </Text>
            </TouchableOpacity>

            {/* Sold */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "Completed" } })}
              style={{
                width: "48.5%",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 9,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, paddingRight: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" }} />
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Selesai (Sold)" : "Completed (Sold)"}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "900", color: themeColors.textPrimary }}>
                {metricSold}
              </Text>
            </TouchableOpacity>

            {/* Expired */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: "/(tabs)/cases" as any, params: { status: "Cancelled" } })}
              style={{
                width: "48.5%",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 9,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, paddingRight: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#64748B" }} />
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Dibatalkan" : "Cancelled"}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "900", color: themeColors.textPrimary }}>
                {metricExpired}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ⚡ AKSES PANTAS (Quick Tools Row with Full Labels) */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary, marginBottom: 8 }}>
            {language === "BM" ? "Akses Pantas" : "Quick Utilities"}
          </Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push({ pathname: "/calculator" as any, params: { tab: "mortgage" } })}
              style={{
                flex: 1,
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
                gap: 6,
              }}
            >
              <MaterialCommunityIcons name="calculator-variant" size={20} color={themeColors.maroonPrimary} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: themeColors.textPrimary, textAlign: "center" }}>
                {language === "BM" ? "Kalkulator Pinjaman" : "Loan Calculator"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push({ pathname: "/calculator" as any, params: { tab: "dsr" } })}
              style={{
                flex: 1,
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
                gap: 6,
              }}
            >
              <MaterialCommunityIcons name="percent" size={20} color="#3B82F6" />
              <Text style={{ fontSize: 11, fontWeight: "700", color: themeColors.textPrimary, textAlign: "center" }}>
                {language === "BM" ? "Kelayakan DSR" : "DSR Calculator"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push("/tambah" as any)}
              style={{
                flex: 1,
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
                gap: 6,
              }}
            >
              <MaterialCommunityIcons name="plus-circle" size={20} color="#10B981" />
              <Text style={{ fontSize: 11, fontWeight: "700", color: themeColors.textPrimary, textAlign: "center" }}>
                {language === "BM" ? "Tambah Listing" : "New Listing"}
              </Text>
            </TouchableOpacity>
          </View>
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
    position: "relative",
  },
  badgePill: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
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
