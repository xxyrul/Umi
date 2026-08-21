import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useAppSettings } from "@/context/AppSettingsContext";
import { firestore, auth } from "@/services/firebase";
import {
  syncNotificationStateWithCloud,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/services/notificationStorage";

export interface AnnouncementItem {
  id: string;
  docId?: string;
  title?: string;
  titleEN?: string;
  titleBM?: string;
  message?: string;
  messageEN?: string;
  messageBM?: string;
  type?: "GENERAL" | "URGENT" | "LISTING_ALERT" | "COMMISSION" | string;
  sentBy?: string;
  createdAt?: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeColors, t, language, isDark } = useAppSettings();
  const isMalay = language === "BM";

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load & sync read IDs with Firestore cloud storage
  const loadReadState = async () => {
    try {
      const state = await syncNotificationStateWithCloud();
      setReadIds(state.readIds);
    } catch (e) {
      console.warn("Failed to sync read notification ids", e);
    }
  };

  // Realtime Firestore Listener for Announcements
  useEffect(() => {
    loadReadState();

    const unsubscribe = firestore()
      .collection("announcements")
      .orderBy("createdAt", "desc")
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          if (snapshot && !snapshot.empty) {
            const items: AnnouncementItem[] = snapshot.docs.map((doc) => ({
              id: doc.id,
              docId: doc.id,
              ...doc.data(),
            })) as AnnouncementItem[];
            setAnnouncements(items);
          } else {
            setAnnouncements([]);
          }
          setIsLoading(false);
          setIsRefreshing(false);
        },
        (error) => {
          console.error("Realtime announcement inbox error:", error);
          setIsLoading(false);
          setIsRefreshing(false);
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadReadState();
    setIsRefreshing(false);
  };

  const handleToggleExpand = async (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));

    // Mark as read if not already read (syncs locally and to Firestore)
    if (!readIds.includes(id)) {
      const updated = await markNotificationAsRead(id);
      setReadIds(updated);
    }
  };

  const handleMarkAllRead = async () => {
    const allIds = announcements.map((a) => a.id);
    const merged = await markAllNotificationsAsRead(allIds);
    setReadIds(merged);
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";

    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return isMalay ? "Sebentar tadi" : "Just now";
    if (diffMin < 60) return `${diffMin}m ${isMalay ? "lepas" : "ago"}`;
    if (diffHour < 24) return `${diffHour}h ${isMalay ? "lepas" : "ago"}`;
    if (diffDay === 1) return isMalay ? "Semalam" : "Yesterday";
    if (diffDay < 7) return `${diffDay}d ${isMalay ? "lepas" : "ago"}`;

    return date.toLocaleDateString(isMalay ? "ms-MY" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getCategoryMeta = (type?: string) => {
    const upper = (type || "").toUpperCase();
    switch (upper) {
      case "URGENT":
        return {
          label: t("noticeUrgent"),
          icon: "alert-decagram",
          badgeBg: isDark ? "#450A0A" : "#FEE2E2",
          badgeText: "#EF4444",
          cardBorder: "#EF444455",
        };
      case "LISTING_ALERT":
        return {
          label: t("noticeListing"),
          icon: "home-plus",
          badgeBg: isDark ? "#1E293B" : "#DBEAFE",
          badgeText: "#3B82F6",
          cardBorder: "#3B82F644",
        };
      case "COMMISSION":
        return {
          label: t("noticeCommission"),
          icon: "trophy",
          badgeBg: isDark ? "#451A03" : "#FEF3C7",
          badgeText: "#F59E0B",
          cardBorder: "#F59E0B44",
        };
      default:
        return {
          label: t("noticeGeneral"),
          icon: "bullhorn-outline",
          badgeBg: isDark ? "#2E1065" : "#F3E8FF",
          badgeText: "#8B5CF6",
          cardBorder: themeColors.borderColor,
        };
    }
  };

  const renderItem = ({ item, index }: { item: AnnouncementItem; index: number }) => {
    const isRead = readIds.includes(item.id);
    const isExpanded = !!expandedIds[item.id];
    const category = getCategoryMeta(item.type);

    const title = isMalay
      ? (item.titleBM || item.title || "Pengumuman")
      : (item.titleEN || item.title || "Announcement");

    const message = isMalay
      ? (item.messageBM || item.message || "")
      : (item.messageEN || item.message || "");

    const isUpdateRelated =
      (title + " " + message).toLowerCase().includes("update") ||
      (title + " " + message).toLowerCase().includes("versi");

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 300))}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleToggleExpand(item.id)}
          style={[
            styles.card,
            {
              backgroundColor: themeColors.cardBackground,
              borderColor: !isRead ? themeColors.maroonPrimary : themeColors.borderColor,
              borderLeftWidth: !isRead ? 4 : 1,
            },
          ]}
        >
          {/* Card Header: Category & Timestamp */}
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: category.badgeBg },
              ]}
            >
              <MaterialCommunityIcons
                name={category.icon as any}
                size={14}
                color={category.badgeText}
              />
              <Text style={[styles.categoryText, { color: category.badgeText }]}>
                {category.label}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.timeText, { color: themeColors.textMuted }]}>
                {formatRelativeTime(item.createdAt)}
              </Text>
              {!isRead && <View style={[styles.unreadDot, { backgroundColor: themeColors.maroonPrimary }]} />}
            </View>
          </View>

          {/* Title */}
          <Text
            style={[
              styles.cardTitle,
              {
                color: themeColors.textPrimary,
                fontWeight: !isRead ? "800" : "700",
              },
            ]}
          >
            {title}
          </Text>

          {/* Message Body */}
          <Text
            numberOfLines={isExpanded ? undefined : 3}
            style={[styles.cardMessage, { color: themeColors.textSecondary }]}
          >
            {message}
          </Text>

          {/* Footer Action: View Update or Expand indicator */}
          <View style={styles.cardFooter}>
            {isUpdateRelated ? (
              <TouchableOpacity
                style={[styles.updateBtn, { backgroundColor: themeColors.surfaceContainer }]}
                onPress={() => router.push("/updates" as any)}
              >
                <MaterialCommunityIcons name="rocket-launch" size={14} color={themeColors.maroonPrimary} />
                <Text style={[styles.updateBtnText, { color: themeColors.maroonPrimary }]}>
                  {isMalay ? "Buka Halaman Kemas Kini" : "View Updates Page"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            {message.length > 120 && (
              <Text style={[styles.expandText, { color: themeColors.maroonPrimary }]}>
                {isExpanded ? (isMalay ? "Ringkaskan" : "Show less") : (isMalay ? "Baca lanjut" : "Read more")}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={themeColors.cardBackground}
      />

      {/* Top App Bar */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: themeColors.cardBackground,
            borderBottomColor: themeColors.borderColor,
            paddingTop: insets.top + (Platform.OS === "android" ? 8 : 4),
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
          {t("notificationHistory")}
        </Text>

        {announcements.length > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={[styles.markAllBtn, { backgroundColor: themeColors.surfaceContainer }]}
          >
            <MaterialCommunityIcons name="check-all" size={16} color={themeColors.textPrimary} />
            <Text style={[styles.markAllText, { color: themeColors.textPrimary }]}>
              {t("markAllAsRead")}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: themeColors.surfaceContainer }]}>
            <MaterialCommunityIcons name="bell-sleep-outline" size={42} color={themeColors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
            {t("noNotifications")}
          </Text>
          <Text style={[styles.emptySubtitle, { color: themeColors.textMuted }]}>
            {t("noNotificationsDesc")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[themeColors.maroonPrimary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 15,
    marginBottom: 4,
    lineHeight: 20,
  },
  cardMessage: {
    fontSize: 13,
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
  },
  updateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  updateBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  expandText: {
    fontSize: 12,
    fontWeight: "600",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
