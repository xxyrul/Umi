import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppSettings } from "@/context/AppSettingsContext";
import { SPACING } from "@/constants/theme";

export default function CalculatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { themeColors, t } = useAppSettings();

  // Mode: "quick" vs "detailed"
  const [entryMode, setEntryMode] = useState<"quick" | "detailed">("quick");

  // Inputs
  const [quickIncome, setQuickIncome] = useState("6000");
  const [detailedIncomes, setDetailedIncomes] = useState<string[]>([
    "6000", "6000", "6000", "6000", "6000", "6000"
  ]);

  const [dsrLimit, setDsrLimit] = useState("60");

  // Commitments
  const [carLoan, setCarLoan] = useState("600");
  const [housingLoan, setHousingLoan] = useState("1200");
  const [personalLoan, setPersonalLoan] = useState("0");
  const [creditCard, setCreditCard] = useState("150"); // 5% of outstanding balance
  const [otherLoans, setOtherLoans] = useState("150"); // PTPTN etc.

  // Parse helper
  const parseNum = (val: string): number => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Calculations
  const averageIncome = useMemo(() => {
    if (entryMode === "quick") {
      return parseNum(quickIncome);
    } else {
      const sum = detailedIncomes.reduce((acc, curr) => acc + parseNum(curr), 0);
      return sum / 6;
    }
  }, [entryMode, quickIncome, detailedIncomes]);

  const totalCommitments = useMemo(() => {
    return (
      parseNum(carLoan) +
      parseNum(housingLoan) +
      parseNum(personalLoan) +
      parseNum(creditCard) +
      parseNum(otherLoans)
    );
  }, [carLoan, housingLoan, personalLoan, creditCard, otherLoans]);

  const currentDsr = useMemo(() => {
    if (averageIncome <= 0) return 0;
    return (totalCommitments / averageIncome) * 100;
  }, [totalCommitments, averageIncome]);

  const dsrStatus = useMemo(() => {
    if (currentDsr < 60) {
      return {
        label: t("dsrHealthy"),
        color: "#10B981", // green
        bg: "rgba(16, 185, 129, 0.1)",
        icon: "checkbox-marked-circle",
      };
    } else if (currentDsr >= 60 && currentDsr <= 70) {
      return {
        label: t("dsrWarning"),
        color: "#F59E0B", // orange
        bg: "rgba(245, 158, 11, 0.1)",
        icon: "alert-circle",
      };
    } else {
      return {
        label: t("dsrCritical"),
        color: "#EF4444", // red
        bg: "rgba(239, 68, 68, 0.1)",
        icon: "close-circle",
      };
    }
  }, [currentDsr, t]);

  const loanEligibility = useMemo(() => {
    const dsrFraction = parseNum(dsrLimit) / 100;
    const maxCommitment = averageIncome * dsrFraction;
    const netDisposable = maxCommitment - totalCommitments;
    
    // Eligibility Formula: net installment capacity * 200
    const maxPrice = Math.max(0, netDisposable * 200);
    const maxInstallment = Math.max(0, netDisposable);

    return {
      maxPrice,
      maxInstallment,
    };
  }, [averageIncome, totalCommitments, dsrLimit]);

  const handleDetailedIncomeChange = (text: string, index: number) => {
    const updated = [...detailedIncomes];
    updated[index] = text;
    setDetailedIncomes(updated);
  };

  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <StatusBar
        barStyle={themeColors.cardBackground === "#FFFFFF" ? "dark-content" : "light-content"}
        backgroundColor={themeColors.cardBackground}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: themeColors.cardBackground,
            borderBottomColor: themeColors.borderColor,
            paddingTop: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 12,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            padding: 8,
            borderRadius: 20,
            backgroundColor: themeColors.surfaceContainer,
            position: "absolute",
            left: 16,
            bottom: 8,
            zIndex: 10,
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.maroonPrimary }]}>
          {t("dsrTitle")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
      >
        {/* Result Summary Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: themeColors.cardBackground,
              borderColor: themeColors.borderColor,
              borderTopWidth: 4,
              borderTopColor: themeColors.maroonPrimary,
            },
          ]}
        >
          <Text style={[styles.cardSectionTitle, { color: themeColors.textPrimary, marginBottom: 12 }]}>
            {t("results")}
          </Text>

          <View style={styles.resultGrid}>
            {/* Max Property Price */}
            <View style={styles.resultItemBig}>
              <Text style={[styles.resultLabel, { color: themeColors.textSecondary }]}>
                {t("maxPropertyPrice")}
              </Text>
              <Text style={[styles.resultValuePrice, { color: themeColors.maroonPrimary }]}>
                {formatCurrency(loanEligibility.maxPrice)}
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: themeColors.borderColor, marginVertical: 12 }} />

            {/* Max installment and overall DSR */}
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultLabel, { color: themeColors.textSecondary }]}>
                  {t("maxInstallment")}
                </Text>
                <Text style={[styles.resultValueSub, { color: themeColors.textPrimary }]}>
                  {formatCurrency(loanEligibility.maxInstallment)} /mo
                </Text>
              </View>

              <View style={{ width: 1, backgroundColor: themeColors.borderColor, height: "100%", marginHorizontal: 16 }} />

              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={[styles.resultLabel, { color: themeColors.textSecondary }]}>
                  {t("dsrCalculation")}
                </Text>
                <Text style={[styles.resultValueSub, { color: dsrStatus.color }]}>
                  {currentDsr.toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>

          {/* DSR Advice Alert */}
          <View
            style={[
              styles.adviceCard,
              {
                backgroundColor: dsrStatus.bg,
                borderColor: dsrStatus.color + "22",
              },
            ]}
          >
            <MaterialCommunityIcons name={dsrStatus.icon as any} size={20} color={dsrStatus.color} />
            <Text style={[styles.adviceText, { color: dsrStatus.color }]}>
              {dsrStatus.label}
            </Text>
          </View>
        </View>

        {/* Form Selector Tab */}
        <View
          style={[
            styles.modeSelectorContainer,
            {
              backgroundColor: themeColors.cardBackground,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.modeTab,
              entryMode === "quick" && { backgroundColor: themeColors.maroonLight },
            ]}
            onPress={() => setEntryMode("quick")}
          >
            <MaterialCommunityIcons
              name="flash"
              size={18}
              color={entryMode === "quick" ? themeColors.maroonPrimary : themeColors.textMuted}
            />
            <Text
              style={[
                styles.modeTabText,
                {
                  color: entryMode === "quick" ? themeColors.maroonPrimary : themeColors.textSecondary,
                  fontWeight: entryMode === "quick" ? "700" : "500",
                },
              ]}
            >
              {t("quickMode")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeTab,
              entryMode === "detailed" && { backgroundColor: themeColors.maroonLight },
            ]}
            onPress={() => setEntryMode("detailed")}
          >
            <MaterialCommunityIcons
              name="calendar-clock"
              size={18}
              color={entryMode === "detailed" ? themeColors.maroonPrimary : themeColors.textMuted}
            />
            <Text
              style={[
                styles.modeTabText,
                {
                  color: entryMode === "detailed" ? themeColors.maroonPrimary : themeColors.textSecondary,
                  fontWeight: entryMode === "detailed" ? "700" : "500",
                },
              ]}
            >
              {t("detailedMode")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section 1: Income Details */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: themeColors.cardBackground,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <MaterialCommunityIcons name="wallet" size={22} color={themeColors.maroonPrimary} />
            <Text style={[styles.cardSectionTitle, { color: themeColors.textPrimary }]}>
              {entryMode === "quick" ? t("netIncome") : t("sixMonthIncome")}
            </Text>
          </View>

          {entryMode === "quick" ? (
            <View>
              <Text style={[styles.label, { color: themeColors.textPrimary }]}>
                {t("avgNetIncome")} (RM)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: themeColors.textPrimary,
                    borderColor: themeColors.borderColor,
                    backgroundColor: themeColors.canvasBackground,
                  },
                ]}
                keyboardType="numeric"
                value={quickIncome}
                onChangeText={setQuickIncome}
                placeholder="6000"
                placeholderTextColor={themeColors.textMuted}
                autoFocus={entryMode === "quick"}
              />
            </View>
          ) : (
            <View style={styles.detailedGrid}>
              {detailedIncomes.map((inc, index) => (
                <View key={index} style={styles.detailedHalf}>
                  <Text style={[styles.label, { color: themeColors.textPrimary }]}>
                    {t("monthLabel")} {index + 1} (RM)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: themeColors.textPrimary,
                        borderColor: themeColors.borderColor,
                        backgroundColor: themeColors.canvasBackground,
                      },
                    ]}
                    keyboardType="numeric"
                    value={inc}
                    onChangeText={(text) => handleDetailedIncomeChange(text, index)}
                    placeholder="6000"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
              ))}

              <View style={[styles.avgBanner, { backgroundColor: themeColors.canvasBackground, borderColor: themeColors.borderColor }]}>
                <Text style={{ fontSize: 13, color: themeColors.textSecondary, fontWeight: "600" }}>
                  {t("avgNetIncome")}:
                </Text>
                <Text style={{ fontSize: 15, color: themeColors.maroonPrimary, fontWeight: "700" }}>
                  {formatCurrency(averageIncome)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Section 2: DSR Limit */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: themeColors.cardBackground,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <MaterialCommunityIcons name="percent" size={22} color={themeColors.maroonPrimary} />
            <Text style={[styles.cardSectionTitle, { color: themeColors.textPrimary }]}>
              {t("dsrLimit")}
            </Text>
          </View>
          
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>
            DSR Limit (%)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.textPrimary,
                borderColor: themeColors.borderColor,
                backgroundColor: themeColors.canvasBackground,
              },
            ]}
            keyboardType="numeric"
            value={dsrLimit}
            onChangeText={setDsrLimit}
            placeholder="60"
            placeholderTextColor={themeColors.textMuted}
          />
          <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: -4 }}>
            Standard Malaysian banking limit is 60% for middle income, up to 70-85% for high-income profiles.
          </Text>
        </View>

        {/* Section 3: Commitments */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: themeColors.cardBackground,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <MaterialCommunityIcons name="credit-card-minus" size={22} color={themeColors.maroonPrimary} />
            <Text style={[styles.cardSectionTitle, { color: themeColors.textPrimary }]}>
              {t("monthlyCommitments")}
            </Text>
          </View>

          {/* Car Loan */}
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>
            {t("carLoan")} (RM)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.textPrimary,
                borderColor: themeColors.borderColor,
                backgroundColor: themeColors.canvasBackground,
              },
            ]}
            keyboardType="numeric"
            value={carLoan}
            onChangeText={setCarLoan}
            placeholder="600"
            placeholderTextColor={themeColors.textMuted}
          />

          {/* Housing Loan */}
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>
            {t("housingLoan")} (RM)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.textPrimary,
                borderColor: themeColors.borderColor,
                backgroundColor: themeColors.canvasBackground,
              },
            ]}
            keyboardType="numeric"
            value={housingLoan}
            onChangeText={setHousingLoan}
            placeholder="1200"
            placeholderTextColor={themeColors.textMuted}
          />

          {/* Personal Loan */}
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>
            {t("personalLoan")} (RM)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.textPrimary,
                borderColor: themeColors.borderColor,
                backgroundColor: themeColors.canvasBackground,
              },
            ]}
            keyboardType="numeric"
            value={personalLoan}
            onChangeText={setPersonalLoan}
            placeholder="0"
            placeholderTextColor={themeColors.textMuted}
          />

          {/* Credit Card */}
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>
            {t("creditCard")} (RM)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.textPrimary,
                borderColor: themeColors.borderColor,
                backgroundColor: themeColors.canvasBackground,
              },
            ]}
            keyboardType="numeric"
            value={creditCard}
            onChangeText={setCreditCard}
            placeholder="150"
            placeholderTextColor={themeColors.textMuted}
          />

          {/* Other Commitments */}
          <Text style={[styles.label, { color: themeColors.textPrimary }]}>
            {t("otherCommitments")} (RM)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.textPrimary,
                borderColor: themeColors.borderColor,
                backgroundColor: themeColors.canvasBackground,
              },
            ]}
            keyboardType="numeric"
            value={otherLoans}
            onChangeText={setOtherLoans}
            placeholder="150"
            placeholderTextColor={themeColors.textMuted}
          />

          <View style={[styles.avgBanner, { backgroundColor: themeColors.canvasBackground, borderColor: themeColors.borderColor }]}>
            <Text style={{ fontSize: 13, color: themeColors.textSecondary, fontWeight: "600" }}>
              {t("totalCommitments")}:
            </Text>
            <Text style={{ fontSize: 15, color: themeColors.maroonPrimary, fontWeight: "700" }}>
              {formatCurrency(totalCommitments)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  resultGrid: {
    marginTop: 4,
  },
  resultItemBig: {
    alignItems: "center",
    marginVertical: 4,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  resultValuePrice: {
    fontSize: 26,
    fontWeight: "800",
  },
  resultValueSub: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  adviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 14,
  },
  adviceText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  modeSelectorContainer: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  modeTabText: {
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 14,
  },
  detailedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  detailedHalf: {
    width: "48.5%",
  },
  avgBanner: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
  },
});
