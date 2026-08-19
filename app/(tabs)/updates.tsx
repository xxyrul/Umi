import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppSettings } from "@/context/AppSettingsContext";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getUpdateCacheSize, fetchReleaseHistory, NativeAppRelease } from "@/services/apkUpdater";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import { UPDATE_CACHE_DIR } from "@/services/apkUpdater";

export default function UpdatesScreen() {
  const insets = useSafeAreaInsets();
  const { themeColors, t, language } = useAppSettings();
  const currentVersion = Constants.expoConfig?.version || "1.0.0";
  
  const [cacheSizeMb, setCacheSizeMb] = useState<string>("0.00");
  const [history, setHistory] = useState<NativeAppRelease[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const loadData = async () => {
    try {
      setIsLoadingHistory(true);
      const sizeBytes = await getUpdateCacheSize();
      setCacheSizeMb((sizeBytes / (1024 * 1024)).toFixed(2));
      
      const relHistory = await fetchReleaseHistory();
      setHistory(relHistory);
    } catch (e) {
      console.warn("Failed to load updates screen data", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const clearCache = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(UPDATE_CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(UPDATE_CACHE_DIR, { idempotent: true });
        setCacheSizeMb("0.00");
      }
    } catch (error) {
      console.warn("Failed to clear cache", error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      <View style={[styles.header, { paddingTop: insets.top + 20, borderBottomColor: themeColors.borderColor }]}>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>
          {language === "BM" ? "Kemas Kini" : "Updates"}
        </Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(100)} style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="cellphone-arrow-down" size={28} color={themeColors.maroonPrimary} />
            <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>Current Version</Text>
          </View>
          <Text style={[styles.versionText, { color: themeColors.textSecondary }]}>v{currentVersion}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="database-outline" size={28} color={themeColors.maroonPrimary} />
            <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>Storage Cache</Text>
          </View>
          <View style={styles.cacheRow}>
            <Text style={[styles.cacheSize, { color: themeColors.textSecondary }]}>{cacheSizeMb} MB</Text>
            <TouchableOpacity onPress={clearCache} style={[styles.clearBtn, { backgroundColor: themeColors.maroonLight, borderColor: themeColors.maroonBorder }]}>
              <Text style={{ color: themeColors.maroonPrimary, fontWeight: "600" }}>Clear Cache</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(300)} style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
          Release History
        </Animated.Text>

        {isLoadingHistory ? (
          <ActivityIndicator color={themeColors.maroonPrimary} style={{ marginTop: 20 }} />
        ) : (
          history.map((rel, idx) => (
            <Animated.View key={idx} entering={FadeInDown.delay(400 + idx * 100)} style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
              <View style={styles.historyHeader}>
                <Text style={[styles.historyVersion, { color: themeColors.maroonPrimary }]}>v{rel.versionName}</Text>
                <Text style={[styles.historyDate, { color: themeColors.textMuted }]}>{rel.releaseDate}</Text>
              </View>
              {rel.releaseNotes?.map((note, nIdx) => (
                <View key={nIdx} style={styles.noteRow}>
                  <Text style={[styles.bullet, { color: themeColors.textMuted }]}>•</Text>
                  <Text style={[styles.noteText, { color: themeColors.textSecondary }]}>{note}</Text>
                </View>
              ))}
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 28, fontWeight: "700" },
  content: { padding: 20, gap: 16, paddingBottom: 100 },
  card: { padding: 20, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: "700" },
  versionText: { fontSize: 24, fontWeight: "700", marginLeft: 40 },
  cacheRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginLeft: 40 },
  cacheSize: { fontSize: 18, fontWeight: "600" },
  clearBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  sectionTitle: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  historyVersion: { fontSize: 18, fontWeight: "700" },
  historyDate: { fontSize: 14, fontWeight: "600" },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  bullet: { fontSize: 18, lineHeight: 20, fontWeight: "700" },
  noteText: { fontSize: 15, flex: 1, lineHeight: 22 },
});
