import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { COLORS, SPACING } from "@/constants/theme";
import { MetricCard, CaseCard } from "@/components";
import {
  getCaseMetrics,
  getRecentCases,
  deleteCase,
} from "@/services/storage";
import {
  getCurrentUserProfile,
  signOut,
  getUserInitials,
} from "@/services/auth";
import type { PropertyCase, CaseMetrics, UserProfile } from "@/types/case";

export default function DashboardScreen() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [metrics, setMetrics] = useState<CaseMetrics>({
    totalCases: 0,
    pending: 0,
    approved: 0,
    completed: 0,
  });
  const [recentCases, setRecentCases] = useState<PropertyCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const profile = getCurrentUserProfile();
      setUserProfile(profile);

      const [metricsData, casesData] = await Promise.all([
        getCaseMetrics(),
        getRecentCases(3),
      ]);

      setMetrics(metricsData);
      setRecentCases(casesData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      Alert.alert("Error", "Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", onPress: () => {}, style: "cancel" },
      {
        text: "Sign Out",
        onPress: async () => {
          try {
            await signOut();
            router.replace("/login");
          } catch (error) {
            Alert.alert("Error", "Failed to sign out");
          }
        },
        style: "destructive",
      },
    ]);
  };

  const handleDeleteCase = async (caseId: string) => {
    try {
      await deleteCase(caseId);
      setRecentCases((prev) => prev.filter((c) => c.id !== caseId));
      setMetrics((prev) => ({
        ...prev,
        totalCases: Math.max(0, prev.totalCases - 1),
      }));
      Alert.alert("Success", "Case deleted successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to delete case");
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          paddingVertical: SPACING.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header with Greeting and Profile */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: SPACING.xl,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                color: COLORS.onSurfaceVariant,
                marginBottom: SPACING.xs,
              }}
            >
              {getGreeting()},
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "700",
                color: COLORS.onSurface,
              }}
            >
              {userProfile?.displayName || "User"}
            </Text>
          </View>

          {/* Profile Avatar */}
          <TouchableOpacity onPress={handleSignOut}>
            {userProfile?.photoURL ? (
              <Image
                source={{ uri: userProfile.photoURL }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  borderWidth: 2,
                  borderColor: COLORS.primary,
                }}
              />
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: COLORS.primaryContainer,
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: COLORS.primary,
                }}
              >
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "700",
                    color: COLORS.onPrimaryContainer,
                  }}
                >
                  {getUserInitials(userProfile?.displayName || "U")}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Notification Icon */}
          <TouchableOpacity
            style={{
              width: 44,
              height: 44,
              justifyContent: "center",
              alignItems: "center",
              marginLeft: SPACING.md,
            }}
          >
            <MaterialCommunityIcons
              name="bell-outline"
              size={24}
              color={COLORS.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>

        {/* Metrics Grid */}
        <View style={{ marginBottom: SPACING.xl }}>
          <View style={{ flexDirection: "row", gap: SPACING.md }}>
            <MetricCard
              label="Total Cases"
              value={metrics.totalCases}
              icon="folder-multiple"
              iconBackgroundColor="rgba(192, 193, 255, 0.2)"
              iconColor={COLORS.primary}
            />
            <MetricCard
              label="Pending"
              value={metrics.pending}
              icon="clock"
              iconBackgroundColor="rgba(245, 158, 11, 0.2)"
              iconColor={COLORS.warning}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: SPACING.md,
              marginTop: SPACING.md,
            }}
          >
            <MetricCard
              label="Approved"
              value={metrics.approved}
              icon="check-circle"
              iconBackgroundColor="rgba(167, 139, 250, 0.2)"
              iconColor={COLORS.tertiary}
            />
            <MetricCard
              label="Completed"
              value={metrics.completed}
              icon="check-circle-2"
              iconBackgroundColor="rgba(16, 185, 129, 0.2)"
              iconColor={COLORS.success}
            />
          </View>
        </View>

        {/* Recent Cases Section */}
        <View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: SPACING.lg,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: COLORS.onSurface,
              }}
            >
              Recent Cases
            </Text>
            {recentCases.length > 0 && (
              <TouchableOpacity onPress={() => router.push("/(tabs)/cases")}>
                <Text
                  style={{
                    color: COLORS.primary,
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  View All
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {recentCases.length === 0 ? (
            <View
              style={{
                backgroundColor: COLORS.surfaceContainer,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.outlineVariant,
                padding: SPACING.xl,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 200,
              }}
            >
              <MaterialCommunityIcons
                name="folder-open-outline"
                size={48}
                color={COLORS.onSurfaceVariant}
                style={{ marginBottom: SPACING.md }}
              />
              <Text
                style={{
                  fontSize: 16,
                  color: COLORS.onSurface,
                  fontWeight: "600",
                  marginBottom: SPACING.sm,
                }}
              >
                No Cases Yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: COLORS.onSurfaceVariant,
                  marginBottom: SPACING.lg,
                  textAlign: "center",
                }}
              >
                Create your first case to get started
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/cases")}
                style={{
                  backgroundColor: COLORS.primary,
                  paddingHorizontal: SPACING.lg,
                  paddingVertical: SPACING.md,
                  borderRadius: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACING.sm,
                }}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={20}
                  color={COLORS.onPrimary}
                />
                <Text
                  style={{
                    color: COLORS.onPrimary,
                    fontWeight: "600",
                    fontSize: 14,
                    textTransform: "uppercase",
                  }}
                >
                  Add Case
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {recentCases.map((caseItem) => (
                <CaseCard
                  key={caseItem.id}
                  case={caseItem}
                  onPress={() => {
                    // Navigate to case detail (can be implemented later)
                  }}
                  onDelete={handleDeleteCase}
                />
              ))}
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* FAB - Add Case */}
      <TouchableOpacity
        onPress={() => router.push("/case-form")}
        style={{
          position: "absolute",
          bottom: 100,
          right: SPACING.lg,
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: COLORS.primary,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <MaterialCommunityIcons
          name="plus"
          size={32}
          color={COLORS.onPrimary}
        />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
