import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StatusBar,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import firestore from "@react-native-firebase/firestore";

import type { FinanceType, CaseStatus } from "@/types/case";
import { createCase, updateCase, getCaseById } from "@/services/storage";
import { useAppSettings } from "@/context/AppSettingsContext";
import { SPACING } from "@/constants/theme";

const FINANCE_OPTIONS: FinanceType[] = ["Bank Loan", "Cash", "Developer Loan", "Other"];
const STATUS_OPTIONS: CaseStatus[] = [
  "Viewing",
  "Booking Paid",
  "Loan Approved",
  "SPA Signed",
  "Completed",
  "Cancelled",
];

const STEPS = [
  {
    status: "Viewing" as const,
    titleBM: "Rundingan Viewing",
    titleEN: "Property Viewing",
    descBM: "Klien melawat hartanah & rundingan awal.",
    descEN: "Client inspects the property.",
    icon: "eye-outline",
  },
  {
    status: "Booking Paid" as const,
    titleBM: "Deposit & Booking Dibayar",
    titleEN: "Booking Fee Paid",
    descBM: "Commitment fee dibayar kepada agensi / vendor.",
    descEN: "Commitment deposit paid to agency.",
    icon: "wallet-outline",
  },
  {
    status: "Loan Approved" as const,
    titleBM: "Kelulusan Pembiayaan",
    titleEN: "Loan Approved",
    descBM: "Pinjaman bank atau pembiayaan perumahan diluluskan.",
    descEN: "Housing loan or bank finance approved.",
    icon: "check-circle-outline",
  },
  {
    status: "SPA Signed" as const,
    titleBM: "Tandatangan Perjanjian SPA",
    titleEN: "SPA Signed",
    descBM: "Perjanjian Jual Beli rasmi ditandatangani.",
    descEN: "Official Sale & Purchase Agreement signed.",
    icon: "file-sign",
  },
  {
    status: "Completed" as const,
    titleBM: "Pindah Milik Selesai",
    titleEN: "Deal Completed",
    descBM: "Disbursement baki bayaran & serah kunci selesai.",
    descEN: "Final disbursement and keys handed over.",
    icon: "checkbox-marked-circle-outline",
  },
];

export default function CaseFormScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ caseId?: string }>();
  const editCaseId = params.caseId;
  const isEditMode = !!editCaseId;

  const { themeColors, t, language } = useAppSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Case Form States
  const [namaCase, setNamaCase] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorIC, setVendorIC] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerIC, setBuyerIC] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [finance, setFinance] = useState<FinanceType>("Bank Loan");
  const [status, setStatus] = useState<CaseStatus>("Viewing");
  const [catatan, setCatatan] = useState("");

  // Load existing case data if editing
  useEffect(() => {
    if (!editCaseId) return;

    const loadCase = async () => {
      try {
        setIsLoadingData(true);
        const item = await getCaseById(editCaseId);
        if (item) {
          setNamaCase(item.namaCase || "");
          setVendorName(item.vendorName || item.clientName || "");
          setVendorIC(item.vendorIC || "");
          setVendorPhone(item.vendorPhone || "");
          setBuyerName(item.buyerName || "");
          setBuyerIC(item.buyerIC || "");
          setBuyerPhone(item.buyerPhone || "");
          setFinance(item.finance || "Bank Loan");
          setStatus(item.status || "Viewing");
          setCatatan(item.catatan || "");
        }
      } catch (err) {
        console.error("Error loading case for editing:", err);
        Alert.alert("Error", "Failed to load case data.");
      } finally {
        setIsLoadingData(false);
      }
    };

    loadCase();
  }, [editCaseId]);

  // Reset form states
  const resetForm = () => {
    setNamaCase("");
    setVendorName("");
    setVendorIC("");
    setVendorPhone("");
    setBuyerName("");
    setBuyerIC("");
    setBuyerPhone("");
    setFinance("Bank Loan");
    setStatus("Viewing");
    setCatatan("");
  };

  const handleSubmit = async () => {
    if (!namaCase.trim()) {
      Alert.alert(t("incompleteInfo") || "Incomplete Information", language === "BM" ? "Sila masukkan Tajuk Hartanah / Kes" : "Please enter case title");
      return;
    }
    if (!vendorName.trim()) {
      Alert.alert(t("incompleteInfo") || "Incomplete Information", language === "BM" ? "Sila masukkan Nama Penjual / Vendor" : "Please enter vendor name");
      return;
    }
    if (!buyerName.trim()) {
      Alert.alert(t("incompleteInfo") || "Incomplete Information", language === "BM" ? "Sila masukkan Nama Pembeli / Buyer" : "Please enter buyer name");
      return;
    }

    try {
      setIsSubmitting(true);
      const caseData = {
        namaCase: namaCase.trim(),
        tarikh: new Date().toISOString(),
        clientName: vendorName.trim(),
        vendorName: vendorName.trim(),
        vendorIC: vendorIC.trim(),
        vendorPhone: vendorPhone.trim(),
        buyerName: buyerName.trim(),
        buyerIC: buyerIC.trim(),
        buyerPhone: buyerPhone.trim(),
        finance,
        status,
        catatan: catatan.trim(),
      };

      if (isEditMode && editCaseId) {
        await updateCase(editCaseId, caseData);
        Alert.alert(
          language === "BM" ? "Kes Dikemaskini!" : "Case Updated!",
          language === "BM" ? `Kes "${namaCase}" berjaya dikemaskini.` : `Case "${namaCase}" updated successfully.`,
          [
            {
              text: "OK",
              onPress: () => {
                resetForm();
                // Redirect back to Case Details or list
                router.replace({ pathname: "/case/[id]" as any, params: { id: editCaseId } });
              },
            },
          ]
        );
      } else {
        await createCase(caseData);
        Alert.alert(
          language === "BM" ? "Kes Berjaya Ditambah!" : "Case Added Successfully!",
          language === "BM" ? `Kes "${namaCase}" berjaya dibuat.` : `Case "${namaCase}" created successfully.`,
          [
            {
              text: "OK",
              onPress: () => {
                resetForm();
                router.replace("/(tabs)/cases");
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error("Case Submission Error:", error);
      Alert.alert(t("saveFailed") || "Save Failed", error?.message || t("errorTitle"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerPaddingTop =
    Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6;

  if (isLoadingData) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.canvasBackground }]}>
        <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop, borderBottomColor: themeColors.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
          {isEditMode
            ? language === "BM"
              ? "Kemaskini Kes"
              : "Edit Case"
            : language === "BM"
            ? "Tambah Kes Baru"
            : "Add New Case"}
        </Text>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 80 }}>
        {/* Case Info section */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>
          {language === "BM" ? "Maklumat Hartanah / Kes" : "Property / Case Info"}
        </Text>

        <TextInput
          placeholder={language === "BM" ? "Cth: Teres 2 Tingkat Shah Alam" : "e.g. 2 Storey Terrace Shah Alam"}
          placeholderTextColor={themeColors.textMuted}
          value={namaCase}
          onChangeText={setNamaCase}
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        {/* Vendor Details section */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>
          {language === "BM" ? "Maklumat Penjual (Vendor)" : "Vendor Details"}
        </Text>

        <TextInput
          placeholder={language === "BM" ? "Nama Penjual" : "Vendor Name"}
          placeholderTextColor={themeColors.textMuted}
          value={vendorName}
          onChangeText={setVendorName}
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        <TextInput
          placeholder="No. IC Penjual"
          placeholderTextColor={themeColors.textMuted}
          value={vendorIC}
          onChangeText={setVendorIC}
          keyboardType="numeric"
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        <TextInput
          placeholder={language === "BM" ? "No. Tel Penjual" : "Vendor Phone"}
          placeholderTextColor={themeColors.textMuted}
          value={vendorPhone}
          onChangeText={setVendorPhone}
          keyboardType="phone-pad"
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        {/* Buyer Details section */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>
          {language === "BM" ? "Maklumat Pembeli (Buyer)" : "Buyer Details"}
        </Text>

        <TextInput
          placeholder={language === "BM" ? "Nama Pembeli" : "Buyer Name"}
          placeholderTextColor={themeColors.textMuted}
          value={buyerName}
          onChangeText={setBuyerName}
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        <TextInput
          placeholder="No. IC Pembeli"
          placeholderTextColor={themeColors.textMuted}
          value={buyerIC}
          onChangeText={setBuyerIC}
          keyboardType="numeric"
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        <TextInput
          placeholder={language === "BM" ? "No. Tel Pembeli" : "Buyer Phone"}
          placeholderTextColor={themeColors.textMuted}
          value={buyerPhone}
          onChangeText={setBuyerPhone}
          keyboardType="phone-pad"
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        {/* Finance Options */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>
          {language === "BM" ? "Kaedah Pembiayaan" : "Financing Method"}
        </Text>
        <View style={styles.grid}>
          {FINANCE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setFinance(opt)}
              style={[
                styles.gridChip,
                { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
                finance === opt && { borderColor: themeColors.maroonPrimary, backgroundColor: themeColors.maroonPrimary },
              ]}
            >
              <Text style={{ color: finance === opt ? themeColors.canvasBackground : themeColors.textPrimary, fontWeight: "700" }}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Status Stepper Timeline */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>
          {language === "BM" ? "Kemajuan Transaksi & Status" : "Transaction Progress & Status"}
        </Text>

        <View style={[styles.stepperContainer, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
          {STEPS.map((step, idx) => {
            const isCancelled = status === "Cancelled";
            const currentIdx = STEPS.findIndex((s) => s.status === status);
            const isCompleted = !isCancelled && idx < currentIdx;
            const isActive = !isCancelled && idx === currentIdx;

            // Resolve step colors
            let circleBg = themeColors.cardBackground;
            let circleBorder = themeColors.borderColor;
            let iconColor = themeColors.textMuted;
            let titleColor = themeColors.textPrimary;
            let descColor = themeColors.textMuted;

            if (isCompleted) {
              circleBg = themeColors.statusAktifBg;
              circleBorder = themeColors.statusAktifText;
              iconColor = themeColors.statusAktifText;
            } else if (isActive) {
              circleBg = themeColors.maroonPrimary;
              circleBorder = themeColors.maroonPrimary;
              iconColor = themeColors.canvasBackground;
              titleColor = themeColors.maroonPrimary;
            }

            const showLine = idx < STEPS.length - 1;

            return (
              <TouchableOpacity
                key={step.status}
                activeOpacity={0.8}
                onPress={() => setStatus(step.status)}
                style={styles.stepRow}
              >
                {/* Left Column (Indicator & Line) */}
                <View style={styles.stepIndicatorCol}>
                  {showLine && (
                    <View
                      style={[
                        styles.stepConnectorLine,
                        {
                          backgroundColor: isCompleted ? themeColors.statusAktifText : themeColors.borderColor,
                        },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.stepCircle,
                      {
                        backgroundColor: circleBg,
                        borderColor: circleBorder,
                        borderWidth: isActive ? 2 : 1,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={(isCompleted ? "check" : step.icon) as any}
                      size={18}
                      color={iconColor}
                    />
                  </View>
                </View>

                {/* Right Column (Texts) */}
                <View style={styles.stepTextCol}>
                  <Text
                    style={[
                      styles.stepTitle,
                      {
                        color: titleColor,
                        fontWeight: isActive ? "700" : "600",
                      },
                    ]}
                  >
                    {language === "BM" ? step.titleBM : step.titleEN}
                  </Text>
                  <Text style={[styles.stepDesc, { color: descColor }]}>
                    {language === "BM" ? step.descBM : step.descEN}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cancelled Terminal State Toggle */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setStatus(status === "Cancelled" ? "Viewing" : "Cancelled")}
          style={[
            styles.cancelCard,
            {
              backgroundColor: themeColors.cardBackground,
              borderColor: status === "Cancelled" ? "#EA4335" : themeColors.borderColor,
              borderWidth: status === "Cancelled" ? 2 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="close-circle-outline"
            size={24}
            color={status === "Cancelled" ? "#EA4335" : themeColors.textMuted}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.cancelCardTitle,
                { color: status === "Cancelled" ? "#EA4335" : themeColors.textPrimary },
              ]}
            >
              {language === "BM" ? "Batalkan Kes Transaksi" : "Cancel Deal / Transaction"}
            </Text>
            <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 2 }}>
              {language === "BM"
                ? "Tanda kes sebagai terbatal / gagal pinjaman."
                : "Mark case as cancelled or failed loan process."}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Notes */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>
          {language === "BM" ? "Catatan / Tindakan" : "Notes / Actions"}
        </Text>
        <TextInput
          placeholder={language === "BM" ? "Masukkan catatan tindakan seterusnya..." : "Enter next action notes..."}
          placeholderTextColor={themeColors.textMuted}
          multiline
          numberOfLines={4}
          value={catatan}
          onChangeText={setCatatan}
          style={[styles.input, styles.multilineInput, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={[styles.submitBtn, { backgroundColor: themeColors.maroonPrimary }]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={[styles.submitBtnText, { color: themeColors.canvasBackground }]}>
              {isEditMode
                ? language === "BM"
                  ? "Simpan Perubahan"
                  : "Save Changes"
                : language === "BM"
                ? "Tambah Kes"
                : "Create Case"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    fontSize: 18,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    height: 52,
    fontSize: 15,
    marginBottom: SPACING.sm,
  },
  multilineInput: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: SPACING.sm,
  },
  gridChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  submitBtn: {
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  submitBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },
  stepperContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: SPACING.md,
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
  },
  stepIndicatorCol: {
    alignItems: "center",
    width: 32,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  stepConnectorLine: {
    position: "absolute",
    top: 32,
    bottom: -16,
    width: 2,
    zIndex: 1,
  },
  stepTextCol: {
    flex: 1,
    paddingBottom: 16,
  },
  stepTitle: {
    fontSize: 14,
  },
  stepDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  cancelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 14,
    marginBottom: SPACING.lg,
  },
  cancelCardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
});
