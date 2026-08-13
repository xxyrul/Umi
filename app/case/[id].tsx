import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { firestore, auth } from "@/services/firebase";
import type { PropertyCase } from "@/types/case";
import { useAppSettings } from "@/context/AppSettingsContext";
import { SPACING } from "@/constants/theme";

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeColors, t, language } = useAppSettings();

  const [propertyCase, setPropertyCase] = useState<PropertyCase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const handleBackToCases = () => {
    router.replace("/(tabs)/cases");
  };

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const currentUser = auth().currentUser;
    if (!currentUser) {
      setIsLoading(false);
      setPermissionDenied(true);
      return;
    }

    const unsubscribe = firestore()
      .collection("cases")
      .doc(id)
      .onSnapshot(
        (docSnapshot) => {
          if (docSnapshot && docSnapshot.exists) {
            const data = docSnapshot.data() as PropertyCase;
            // Enforce privacy: Only the creator of the case can view it
            if (data.userId !== currentUser.uid) {
              setPermissionDenied(true);
              setPropertyCase(null);
            } else {
              setPermissionDenied(false);
              setPropertyCase({
                ...data,
                id: docSnapshot.id,
              });
            }
          } else {
            setPropertyCase(null);
          }
          setIsLoading(false);
        },
        (error) => {
          console.error("Error fetching case details:", error);
          setIsLoading(false);
        }
      );

    return () => unsubscribe();
  }, [id]);

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert(t("noInfoTitle") || "Info", t("noPhoneMsg") || "No phone number available");
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert("Error", "Failed to place call");
    });
  };

  const handleWhatsApp = (phone?: string, name?: string) => {
    if (!phone) {
      Alert.alert(t("noInfoTitle") || "Info", t("noPhoneMsg") || "No phone number available");
      return;
    }
    let cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "60" + cleanPhone.slice(1);
    }
    const message = encodeURIComponent(
      `Salam / Hai ${name || "Client"}, saya berkenaan kes hartanah anda: "${propertyCase?.namaCase}".`
    );
    const url = `https://wa.me/${cleanPhone}?text=${message}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Failed to open WhatsApp");
    });
  };

  const handleDeleteCase = () => {
    Alert.alert(
      t("confirmDeleteTitle") || "Delete Case",
      language === "BM"
        ? "Adakah anda pasti mahu memadam rekod kes ini secara kekal?"
        : "Are you sure you want to delete this case record permanently?",
      [
        { text: t("cancelBtnText") || "Cancel", style: "cancel" },
        {
          text: t("deleteBtnText") || "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await firestore().collection("cases").doc(id).delete();
              router.replace("/(tabs)/cases");
            } catch (err: any) {
              console.error("Failed to delete case:", err);
              Alert.alert("Error", err?.message || "Failed to delete case.");
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.canvasBackground }]}>
        <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
        <Text style={[styles.loadingText, { color: themeColors.textMuted }]}>
          {language === "BM" ? "Memuatkan butiran kes..." : "Loading case details..."}
        </Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.canvasBackground }]}>
        <MaterialCommunityIcons name="shield-lock-outline" size={60} color="#EA4335" />
        <Text style={[styles.notFoundTitle, { color: themeColors.textPrimary, textAlign: "center" }]}>
          {language === "BM" ? "Akses Dihalang" : "Access Denied"}
        </Text>
        <Text style={[styles.notFoundSub, { color: themeColors.textMuted, textAlign: "center", marginTop: 8 }]}>
          {language === "BM"
            ? "Anda tidak mempunyai kebenaran untuk melihat kes ini."
            : "You do not have permission to view this case record."}
        </Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: themeColors.maroonPrimary }]}
          onPress={() => router.replace("/(tabs)/cases")}
        >
          <MaterialCommunityIcons name="arrow-left" size={18} color="#FFF" />
          <Text style={styles.backBtnText}>{t("goBack")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!propertyCase) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.canvasBackground }]}>
        <MaterialCommunityIcons name="briefcase-remove-outline" size={60} color={themeColors.maroonPrimary} />
        <Text style={[styles.notFoundTitle, { color: themeColors.textPrimary }]}>
          {language === "BM" ? "Kes Tidak Dijumpai" : "Case Not Found"}
        </Text>
        <Text style={[styles.notFoundSub, { color: themeColors.textMuted }]}>{t("recordDeleted")}</Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: themeColors.maroonPrimary }]}
          onPress={() => router.replace("/(tabs)/cases")}
        >
          <MaterialCommunityIcons name="arrow-left" size={18} color="#FFF" />
          <Text style={styles.backBtnText}>{t("goBack")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const headerPaddingTop =
    Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6;

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop, borderBottomColor: themeColors.borderColor }]}>
        <TouchableOpacity onPress={handleBackToCases} style={styles.headerButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
          {propertyCase.namaCase}
        </Text>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push(`/case/edit/${propertyCase.id}` as any)}
            style={styles.headerButton}
          >
            <MaterialCommunityIcons name="pencil-outline" size={22} color={themeColors.maroonPrimary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDeleteCase} style={styles.headerButton}>
            <MaterialCommunityIcons name="delete-outline" size={22} color="#EA4335" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 40 }}>
        {/* Status Badge */}
        <View style={styles.statusSection}>
          <View style={[styles.statusBadge, { backgroundColor: themeColors.maroonLight, borderColor: themeColors.maroonBorder }]}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={themeColors.maroonPrimary} />
            <Text style={[styles.statusText, { color: themeColors.maroonPrimary }]}>
              {propertyCase.status}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: themeColors.statusAktifBg, borderColor: themeColors.statusAktifText }]}>
            <MaterialCommunityIcons name="cash" size={18} color={themeColors.statusAktifText} />
            <Text style={[styles.statusText, { color: themeColors.statusAktifText }]}>
              {propertyCase.finance}
            </Text>
          </View>
        </View>

        {/* Horizontal Status Progress Tracker */}
        <View style={[styles.progressCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
          <Text style={[styles.progressTitle, { color: themeColors.textPrimary }]}>
            {language === "BM" ? "Kemajuan Kes" : "Case Progress Tracker"}
          </Text>

          {propertyCase.status === "Cancelled" ? (
            <View style={styles.cancelledProgressRow}>
              <MaterialCommunityIcons name="close-circle" size={24} color="#EA4335" />
              <Text style={[styles.cancelledProgressText, { color: "#EA4335" }]}>
                {language === "BM" ? "Kes Terbatal / Gagal" : "Transaction Cancelled / Closed"}
              </Text>
            </View>
          ) : (
            <View style={styles.horizontalStepper}>
              {/* Track Container (spans exactly between Node 1 and Node 5 centers) */}
              <View style={styles.trackContainer}>
                <View style={[styles.stepperTrack, { backgroundColor: themeColors.borderColor }]} />
                {(() => {
                  const stepNames = ["Viewing", "Booking Paid", "Loan Approved", "SPA Signed", "Completed"];
                  const currentIdx = stepNames.indexOf(propertyCase.status);
                  const percent = currentIdx >= 0 ? (currentIdx / 4) * 100 : 0;
                  return (
                    <View
                      style={[
                        styles.stepperTrackFill,
                        {
                          width: `${percent}%`,
                          backgroundColor: themeColors.statusAktifText,
                        },
                      ]}
                    />
                  );
                })()}
              </View>

              {/* Nodes Row */}
              <View style={styles.nodesRow}>
                {["Viewing", "Booking Paid", "Loan Approved", "SPA Signed", "Completed"].map((sName, idx) => {
                  const stepNames = ["Viewing", "Booking Paid", "Loan Approved", "SPA Signed", "Completed"];
                  const currentIdx = stepNames.indexOf(propertyCase.status);
                  const isCompleted = idx < currentIdx;
                  const isActive = idx === currentIdx;

                  let nodeBg = themeColors.cardBackground;
                  let nodeBorder = themeColors.borderColor;
                  let nodeIcon = "circle-outline";
                  let iconColor = themeColors.textMuted;

                  if (isCompleted) {
                    nodeBg = themeColors.statusAktifBg;
                    nodeBorder = themeColors.statusAktifText;
                    nodeIcon = "check";
                    iconColor = themeColors.statusAktifText;
                  } else if (isActive) {
                    nodeBg = themeColors.maroonPrimary;
                    nodeBorder = themeColors.maroonPrimary;
                    nodeIcon = "circle-slice-8";
                    iconColor = themeColors.canvasBackground;
                  }

                  // Node Labels
                  const labelsBM = ["Viewing", "Booking", "Loan", "SPA", "Selesai"];
                  const labelsEN = ["Viewing", "Booking", "Loan", "SPA", "Completed"];
                  const label = language === "BM" ? labelsBM[idx] : labelsEN[idx];

                  return (
                    <View key={sName} style={styles.stepNodeContainer}>
                      <View
                        style={[
                          styles.stepNodeCircle,
                          {
                            backgroundColor: nodeBg,
                            borderColor: nodeBorder,
                            borderWidth: isActive ? 2 : 1,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons name={nodeIcon as any} size={10} color={iconColor} />
                      </View>
                      <Text
                        style={[
                          styles.stepNodeLabel,
                          {
                            color: isActive ? themeColors.maroonPrimary : themeColors.textMuted,
                            fontWeight: isActive ? "700" : "500",
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Vendor Details */}
        <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
          <Text style={[styles.cardTitle, { color: themeColors.maroonPrimary }]}>
            {language === "BM" ? "Maklumat Penjual (Vendor)" : "Vendor Information"}
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: themeColors.textMuted }]}>{language === "BM" ? "Nama" : "Name"}</Text>
            <Text style={[styles.value, { color: themeColors.textPrimary }]}>{propertyCase.vendorName}</Text>
          </View>

          {propertyCase.vendorIC ? (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: themeColors.textMuted }]}>No. IC</Text>
              <Text style={[styles.value, { color: themeColors.textPrimary }]}>{propertyCase.vendorIC}</Text>
            </View>
          ) : null}

          {propertyCase.vendorPhone ? (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: themeColors.textMuted }]}>{language === "BM" ? "No. Tel" : "Phone"}</Text>
              <Text style={[styles.value, { color: themeColors.textPrimary }]}>{propertyCase.vendorPhone}</Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => handleCall(propertyCase.vendorPhone)}
              style={[styles.actionButton, { backgroundColor: themeColors.maroonLight, borderColor: themeColors.maroonBorder }]}
            >
              <MaterialCommunityIcons name="phone" size={18} color={themeColors.maroonPrimary} />
              <Text style={[styles.actionButtonText, { color: themeColors.maroonPrimary }]}>
                {language === "BM" ? "Hubungi" : "Call"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleWhatsApp(propertyCase.vendorPhone, propertyCase.vendorName)}
              style={[styles.actionButton, { backgroundColor: themeColors.statusAktifBg, borderColor: themeColors.statusAktifText }]}
            >
              <MaterialCommunityIcons name="whatsapp" size={18} color={themeColors.statusAktifText} />
              <Text style={[styles.actionButtonText, { color: themeColors.statusAktifText }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Buyer Details */}
        <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
          <Text style={[styles.cardTitle, { color: themeColors.maroonPrimary }]}>
            {language === "BM" ? "Maklumat Pembeli (Buyer)" : "Buyer Information"}
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: themeColors.textMuted }]}>{language === "BM" ? "Nama" : "Name"}</Text>
            <Text style={[styles.value, { color: themeColors.textPrimary }]}>{propertyCase.buyerName}</Text>
          </View>

          {propertyCase.buyerIC ? (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: themeColors.textMuted }]}>No. IC</Text>
              <Text style={[styles.value, { color: themeColors.textPrimary }]}>{propertyCase.buyerIC}</Text>
            </View>
          ) : null}

          {propertyCase.buyerPhone ? (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: themeColors.textMuted }]}>{language === "BM" ? "No. Tel" : "Phone"}</Text>
              <Text style={[styles.value, { color: themeColors.textPrimary }]}>{propertyCase.buyerPhone}</Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => handleCall(propertyCase.buyerPhone)}
              style={[styles.actionButton, { backgroundColor: themeColors.maroonLight, borderColor: themeColors.maroonBorder }]}
            >
              <MaterialCommunityIcons name="phone" size={18} color={themeColors.maroonPrimary} />
              <Text style={[styles.actionButtonText, { color: themeColors.maroonPrimary }]}>
                {language === "BM" ? "Hubungi" : "Call"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleWhatsApp(propertyCase.buyerPhone, propertyCase.buyerName)}
              style={[styles.actionButton, { backgroundColor: themeColors.statusAktifBg, borderColor: themeColors.statusAktifText }]}
            >
              <MaterialCommunityIcons name="whatsapp" size={18} color={themeColors.statusAktifText} />
              <Text style={[styles.actionButtonText, { color: themeColors.statusAktifText }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Catatan / Notes */}
        <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
          <Text style={[styles.cardTitle, { color: themeColors.maroonPrimary }]}>
            {language === "BM" ? "Catatan / Tindakan" : "Notes / Actions"}
          </Text>
          <Text style={[styles.notesText, { color: themeColors.textSecondary }]}>
            {propertyCase.catatan || (language === "BM" ? "Tiada catatan tambahan." : "No additional notes.")}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  notFoundTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
  },
  notFoundSub: {
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  backBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginHorizontal: 8,
  },
  statusSection: {
    flexDirection: "row",
    gap: 12,
    marginBottom: SPACING.lg,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2C2C2C",
  },
  label: {
    fontSize: 15,
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
  },
  progressCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: SPACING.md,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cancelledProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  cancelledProgressText: {
    fontSize: 15,
    fontWeight: "700",
  },
  horizontalStepper: {
    height: 60,
    position: "relative",
    justifyContent: "center",
    marginBottom: 8,
  },
  trackContainer: {
    position: "absolute",
    left: 30, // Center of first node (width: 60 / 2 = 30)
    right: 30, // Center of last node
    height: 4,
    justifyContent: "center",
  },
  stepperTrack: {
    height: 4,
    borderRadius: 2,
    width: "100%",
  },
  stepperTrackFill: {
    height: 4,
    borderRadius: 2,
    position: "absolute",
    left: 0,
  },
  nodesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  stepNodeContainer: {
    alignItems: "center",
    width: 60,
  },
  stepNodeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    zIndex: 2,
  },
  stepNodeLabel: {
    fontSize: 10,
    marginTop: 6,
    textAlign: "center",
  },
});
