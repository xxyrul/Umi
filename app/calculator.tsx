import React, { useState, useMemo, useEffect } from "react";
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
  Alert,
  Linking,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useAppSettings } from "@/context/AppSettingsContext";
import { calculateMortgage } from "@/utils/loanCalculator";

export default function CalculatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ price?: string; tab?: string }>();
  const { themeColors, t, language } = useAppSettings();
  const isBM = language === "BM";

  // Top level tab: "mortgage" (Home Loan) vs "dsr" (DSR Eligibility)
  const [primaryTab, setPrimaryTab] = useState<"mortgage" | "dsr">(
    params.tab === "dsr" ? "dsr" : "mortgage"
  );

  // Mortgage Calculator State
  const [propertyPrice, setPropertyPrice] = useState<string>(
    params.price ? String(params.price) : "500000"
  );
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(10);
  const [loanTenure, setLoanTenure] = useState<number>(30);
  const [interestRate, setInterestRate] = useState<number>(4.2);
  const [isFirstHomeBuyer, setIsFirstHomeBuyer] = useState<boolean>(true);
  const [copiedToast, setCopiedToast] = useState(false);

  useEffect(() => {
    if (params.price) {
      setPropertyPrice(String(params.price));
      setPrimaryTab("mortgage");
    } else if (params.tab === "dsr") {
      setPrimaryTab("dsr");
    }
  }, [params.price, params.tab]);

  // Mortgage Calculation Result
  const parsedPrice = useMemo(() => {
    const clean = propertyPrice.replace(/[^0-9]/g, "");
    return parseInt(clean, 10) || 0;
  }, [propertyPrice]);

  const mortgageEstimate = useMemo(() => {
    return calculateMortgage(parsedPrice, downPaymentPercent, interestRate, loanTenure, isFirstHomeBuyer);
  }, [parsedPrice, downPaymentPercent, interestRate, loanTenure, isFirstHomeBuyer]);

  // DSR Calculator State
  const [showSixMonthHelper, setShowSixMonthHelper] = useState(false);
  const [quickIncome, setQuickIncome] = useState("6000");
  const [detailedIncomes, setDetailedIncomes] = useState<string[]>([
    "6000", "6000", "6000", "6000", "6000", "6000"
  ]);
  const [dsrLimit, setDsrLimit] = useState("70");

  // Commitments
  const [carLoan, setCarLoan] = useState("600");
  const [housingLoan, setHousingLoan] = useState("1200");
  const [creditCard, setCreditCard] = useState("150");
  const [personalLoan, setPersonalLoan] = useState("0");
  const [ptptnOther, setPtptnOther] = useState("150");

  const parseNum = (val: string): number => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const averageIncome = useMemo(() => {
    if (!showSixMonthHelper) {
      return parseNum(quickIncome);
    } else {
      const sum = detailedIncomes.reduce((acc, curr) => acc + parseNum(curr), 0);
      return sum / 6;
    }
  }, [showSixMonthHelper, quickIncome, detailedIncomes]);

  const totalCommitments = useMemo(() => {
    return (
      parseNum(carLoan) +
      parseNum(housingLoan) +
      parseNum(personalLoan) +
      parseNum(creditCard) +
      parseNum(ptptnOther)
    );
  }, [carLoan, housingLoan, personalLoan, creditCard, ptptnOther]);

  const currentDsr = useMemo(() => {
    if (averageIncome <= 0) return 0;
    return (totalCommitments / averageIncome) * 100;
  }, [totalCommitments, averageIncome]);

  const dsrLimitNum = parseNum(dsrLimit) || 70;

  const dsrStatus = useMemo(() => {
    if (currentDsr <= 60) {
      return {
        label: isBM ? "SIHAT: DSR bawah 60%. Peluang kelulusan bank sangat tinggi." : "HEALTHY: DSR below 60%. High approval probability.",
        color: "#10B981",
        bg: "rgba(16, 185, 129, 0.1)",
        icon: "checkbox-marked-circle",
      };
    } else if (currentDsr <= dsrLimitNum) {
      return {
        label: isBM ? `SEDERHANA: DSR ${currentDsr.toFixed(1)}% masih dalam had bank (${dsrLimitNum}%).` : `MODERATE: DSR ${currentDsr.toFixed(1)}% is within bank threshold (${dsrLimitNum}%).`,
        color: "#F59E0B",
        bg: "rgba(245, 158, 11, 0.1)",
        icon: "alert-circle",
      };
    } else {
      return {
        label: isBM ? `TINGGI: Melebihi had DSR bank (${dsrLimitNum}%). Risiko permohonan ditolak.` : `CRITICAL: Exceeds bank DSR limit (${dsrLimitNum}%). High risk of rejection.`,
        color: "#EF4444",
        bg: "rgba(239, 68, 68, 0.1)",
        icon: "close-circle",
      };
    }
  }, [currentDsr, dsrLimitNum, isBM]);

  const loanEligibility = useMemo(() => {
    const dsrFraction = dsrLimitNum / 100;
    const maxCommitment = averageIncome * dsrFraction;
    const netDisposable = maxCommitment - totalCommitments;
    const maxPrice = Math.max(0, netDisposable * 200);
    const maxInstallment = Math.max(0, netDisposable);

    return {
      maxPrice,
      maxInstallment,
    };
  }, [averageIncome, totalCommitments, dsrLimitNum]);

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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/index");
    }
  };

  const handleCopyMortgage = async () => {
    const text =
      `🏡 *Anggaran Pinjaman Hartanah*\n` +
      `Harga Rumah: RM ${parsedPrice.toLocaleString()}\n` +
      `Deposit (${downPaymentPercent}%): RM ${mortgageEstimate.downPaymentAmount.toLocaleString()}\n` +
      `Pinjaman: RM ${mortgageEstimate.loanAmount.toLocaleString()} (${loanTenure} Tahun @ ${interestRate}%)\n` +
      `---------------------------------\n` +
      `💰 *Ansuran Bulanan: RM ${mortgageEstimate.monthlyInstallment.toLocaleString()} /bulan*\n` +
      `---------------------------------\n` +
      `📋 *Kos Permulaan (Entry Costs):*\n` +
      `- Duti Setem MOT: RM ${mortgageEstimate.stampDuty.toLocaleString()}${isFirstHomeBuyer && parsedPrice <= 500000 ? " (Pengecualian 100%)" : ""}\n` +
      `- Yuran Guaman: RM ${mortgageEstimate.legalFees.toLocaleString()}\n` +
      `- Yuran Penilaian: RM ${mortgageEstimate.valuationFee.toLocaleString()}\n` +
      `💵 *Jumlah Tunai Diperlukan: RM ${mortgageEstimate.totalUpfront.toLocaleString()}*\n\n` +
      `🎯 *Gaji Bersih Minima Diperlukan:* RM ${mortgageEstimate.recommendedIncome.toLocaleString()} /bulan`;

    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const handleShareMortgageWhatsApp = () => {
    const text =
      `*Anggaran Pinjaman Hartanah*\n\n` +
      `Harga Rumah: RM ${parsedPrice.toLocaleString()}\n` +
      `Deposit (${downPaymentPercent}%): RM ${mortgageEstimate.downPaymentAmount.toLocaleString()}\n` +
      `Jumlah Pinjaman: RM ${mortgageEstimate.loanAmount.toLocaleString()}\n` +
      `Tempoh: ${loanTenure} Tahun | Kadar: ${interestRate}%\n\n` +
      `*Ansuran Bulanan:* RM ${mortgageEstimate.monthlyInstallment.toLocaleString()} /bulan\n\n` +
      `*Kos Permulaan (Entry Cost):*\n` +
      `- Duti Setem MOT: RM ${mortgageEstimate.stampDuty.toLocaleString()}${isFirstHomeBuyer && parsedPrice <= 500000 ? " (Pengecualian 100%)" : ""}\n` +
      `- Yuran Guaman: RM ${mortgageEstimate.legalFees.toLocaleString()}\n` +
      `- Yuran Penilaian: RM ${mortgageEstimate.valuationFee.toLocaleString()}\n` +
      `*Jumlah Tunai Diperlukan:* RM ${mortgageEstimate.totalUpfront.toLocaleString()}\n\n` +
      `*Kelayakan Gaji Bersih Minima (DSR 60%):* RM ${mortgageEstimate.recommendedIncome.toLocaleString()} /bulan`;

    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "WhatsApp is not installed on your device.");
    });
  };

  const handleCopyDsr = async () => {
    const text =
      `📊 *Penilaian Kelayakan Pinjaman (DSR)*\n` +
      `Pendapatan Bersih: ${formatCurrency(averageIncome)}\n` +
      `Jumlah Komitmen: ${formatCurrency(totalCommitments)}\n` +
      `Kadar DSR Semasa: ${currentDsr.toFixed(1)}%\n` +
      `Had DSR Bank: ${dsrLimitNum}%\n` +
      `---------------------------------\n` +
      `🏠 *Kelayakan Maksimum:*\n` +
      `- Harga Rumah Maksimum: ${formatCurrency(loanEligibility.maxPrice)}\n` +
      `- Ansuran Bulanan Maksimum: ${formatCurrency(loanEligibility.maxInstallment)} /bulan\n` +
      `- Status: ${dsrStatus.label}`;

    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const handleShareDsrWhatsApp = () => {
    const text =
      `*Kelayakan Pinjaman (DSR)*\n\n` +
      `Pendapatan: ${formatCurrency(averageIncome)}\n` +
      `Komitmen: ${formatCurrency(totalCommitments)}\n` +
      `DSR Semasa: ${currentDsr.toFixed(1)}%\n` +
      `Had DSR Bank: ${dsrLimitNum}%\n\n` +
      `*Baki Pinjaman Dibenarkan*\n` +
      `Ansuran Bulanan: ${formatCurrency(loanEligibility.maxInstallment)} /bulan\n` +
      `Harga Rumah: ${formatCurrency(loanEligibility.maxPrice)}`;

    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "WhatsApp is not installed on your device.");
    });
  };

  const handleBridgeToHomeLoan = () => {
    Haptics.selectionAsync().catch(() => {});
    setPropertyPrice(String(Math.round(loanEligibility.maxPrice)));
    setPrimaryTab("mortgage");
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
            paddingTop: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 8,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
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
          {isBM ? "Kalkulator Hartanah" : "Property Calculator"}
        </Text>
      </View>

      {/* Primary Tab Switcher */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: themeColors.cardBackground,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.borderColor,
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 10,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            setPrimaryTab("mortgage");
            Haptics.selectionAsync().catch(() => {});
          }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            borderRadius: 12,
            gap: 6,
            backgroundColor: primaryTab === "mortgage" ? themeColors.maroonPrimary : themeColors.surfaceContainer,
          }}
        >
          <MaterialCommunityIcons
            name="calculator-variant"
            size={18}
            color={primaryTab === "mortgage" ? "#FFFFFF" : themeColors.textSecondary}
          />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: primaryTab === "mortgage" ? "#FFFFFF" : themeColors.textSecondary,
            }}
          >
            {isBM ? "Ansuran Rumah" : "Home Loan"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            setPrimaryTab("dsr");
            Haptics.selectionAsync().catch(() => {});
          }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            borderRadius: 12,
            gap: 6,
            backgroundColor: primaryTab === "dsr" ? themeColors.maroonPrimary : themeColors.surfaceContainer,
          }}
        >
          <MaterialCommunityIcons
            name="percent"
            size={18}
            color={primaryTab === "dsr" ? "#FFFFFF" : themeColors.textSecondary}
          />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: primaryTab === "dsr" ? "#FFFFFF" : themeColors.textSecondary,
            }}
          >
            {isBM ? "Kelayakan DSR" : "DSR Eligibility"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 24) + 64,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {primaryTab === "mortgage" ? (
          <View style={{ gap: 14 }}>
            {/* Monthly Installment Result Card */}
            <View
              style={{
                backgroundColor: `${themeColors.maroonPrimary}12`,
                borderColor: `${themeColors.maroonPrimary}35`,
                borderWidth: 1.5,
                borderRadius: 16,
                padding: 16,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: themeColors.maroonPrimary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                {isBM ? "ANGGARAN BAYARAN BULANAN" : "ESTIMATED MONTHLY PAYMENT"}
              </Text>
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: "900",
                  color: themeColors.maroonPrimary,
                  letterSpacing: -0.5,
                }}
              >
                RM {mortgageEstimate.monthlyInstallment.toLocaleString()}
                <Text style={{ fontSize: 14, fontWeight: "600", color: themeColors.textSecondary }}>
                  {" "}
                  / {isBM ? "bulan" : "month"}
                </Text>
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: themeColors.textMuted,
                  marginTop: 4,
                }}
              >
                {isBM
                  ? `Pinjaman: RM ${mortgageEstimate.loanAmount.toLocaleString()} (${100 - downPaymentPercent}% Pembiayaan)`
                  : `Loan: RM ${mortgageEstimate.loanAmount.toLocaleString()} (${100 - downPaymentPercent}% Financing)`}
              </Text>
            </View>

            {/* Property Price Input Card */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                {isBM ? "Harga Hartanah (RM)" : "Property Price (RM)"}
              </Text>
              <TextInput
                style={{
                  height: 48,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  backgroundColor: themeColors.canvasBackground,
                  paddingHorizontal: 14,
                  fontSize: 18,
                  fontWeight: "700",
                  color: themeColors.textPrimary,
                }}
                keyboardType="numeric"
                value={propertyPrice}
                onChangeText={(text) => setPropertyPrice(text.replace(/[^0-9]/g, ""))}
                placeholder="500000"
                placeholderTextColor={themeColors.textMuted}
              />

              {/* Quick Price Presets with Full Labels */}
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                {[300000, 500000, 750000, 1000000].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => setPropertyPrice(String(preset))}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: parsedPrice === preset ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: parsedPrice === preset ? "#FFFFFF" : themeColors.textSecondary,
                      }}
                    >
                      RM {preset.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Down Payment Selector */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                  {isBM ? "Wang Pendahuluan (Deposit)" : "Down Payment"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.maroonPrimary }}>
                  {downPaymentPercent}% (RM {mortgageEstimate.downPaymentAmount.toLocaleString()})
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { pct: 0, label: isBM ? "0%\nPinjaman Penuh" : "0%\nFull Loan" },
                  { pct: 10, label: isBM ? "10%\nStandard" : "10%\nStandard" },
                  { pct: 15, label: "15%" },
                  { pct: 20, label: "20%" },
                ].map((item) => {
                  const isSelected = downPaymentPercent === item.pct;
                  return (
                    <TouchableOpacity
                      key={item.pct}
                      activeOpacity={0.75}
                      onPress={() => setDownPaymentPercent(item.pct)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 4,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        backgroundColor: isSelected ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                        borderColor: isSelected ? themeColors.maroonPrimary : themeColors.borderColor,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          textAlign: "center",
                          color: isSelected ? "#FFFFFF" : themeColors.textPrimary,
                        }}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Loan Tenure Selector with Full Words */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                  {isBM ? "Tempoh Pinjaman" : "Loan Tenure"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.maroonPrimary }}>
                  {loanTenure} {isBM ? "Tahun" : "Years"}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                {[20, 25, 30, 35].map((years) => {
                  const isSelected = loanTenure === years;
                  return (
                    <TouchableOpacity
                      key={years}
                      activeOpacity={0.75}
                      onPress={() => setLoanTenure(years)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        backgroundColor: isSelected ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                        borderColor: isSelected ? themeColors.maroonPrimary : themeColors.borderColor,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: isSelected ? "#FFFFFF" : themeColors.textPrimary,
                        }}
                      >
                        {years} {isBM ? "Tahun" : "Years"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Interest Rate Stepper */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                  {isBM ? "Kadar Faedah" : "Interest Rate"}
                </Text>
                <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 2 }}>
                  {isBM ? "Purata pasaran semasa" : "Current market average"}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setInterestRate((prev) => Math.max(1.0, parseFloat((prev - 0.1).toFixed(1))))}
                  style={{ padding: 6 }}
                >
                  <MaterialCommunityIcons name="minus" size={18} color={themeColors.textPrimary} />
                </TouchableOpacity>

                <Text style={{ fontSize: 15, fontWeight: "800", color: themeColors.textPrimary, minWidth: 44, textAlign: "center" }}>
                  {interestRate.toFixed(1)}%
                </Text>

                <TouchableOpacity
                  onPress={() => setInterestRate((prev) => Math.min(12.0, parseFloat((prev + 0.1).toFixed(1))))}
                  style={{ padding: 6 }}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={themeColors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Estimated Entry Cost Breakdown Card with First-Home Exemption */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                {isBM ? "Anggaran Pecahan Kos Permulaan" : "Estimated Entry Cost Breakdown"}
              </Text>

              {/* First-Home Buyer Exemption Toggle */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: isFirstHomeBuyer ? "rgba(16, 185, 129, 0.1)" : themeColors.surfaceContainer,
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isFirstHomeBuyer ? "rgba(16, 185, 129, 0.3)" : themeColors.borderColor,
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: isFirstHomeBuyer ? "#10B981" : themeColors.textPrimary }}>
                    {isBM ? "Pembeli Rumah Pertama" : "First-Time Home Buyer"}
                  </Text>
                  <Text style={{ fontSize: 11, color: isFirstHomeBuyer ? "#10B981" : themeColors.textMuted }}>
                    {parsedPrice <= 500000
                      ? (isBM ? "Pengecualian 100% Duti Setem MOT" : "100% MOT Stamp Duty Exemption")
                      : (isBM ? "Diskaun 75% Duti Setem MOT" : "75% MOT Stamp Duty Remission")}
                  </Text>
                </View>
                <Switch
                  value={isFirstHomeBuyer}
                  onValueChange={(val) => {
                    setIsFirstHomeBuyer(val);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  trackColor={{ false: themeColors.surfaceContainer, true: "#10B981" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                  {isBM ? "Duti Setem MOT (SPA)" : "Stamp Duty (SPA)"}
                </Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: isFirstHomeBuyer && mortgageEstimate.stampDuty === 0 ? "#10B981" : themeColors.textPrimary }}>
                    RM {mortgageEstimate.stampDuty.toLocaleString()}
                  </Text>
                  {isFirstHomeBuyer && mortgageEstimate.stampDuty < mortgageEstimate.originalStampDuty && (
                    <Text style={{ fontSize: 11, color: "#10B981", fontWeight: "600" }}>
                      {isBM ? `(Jimat RM ${(mortgageEstimate.originalStampDuty - mortgageEstimate.stampDuty).toLocaleString()}!)` : `(Saved RM ${(mortgageEstimate.originalStampDuty - mortgageEstimate.stampDuty).toLocaleString()}!)`}
                    </Text>
                  )}
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                  {isBM ? "Yuran Guaman SPA & Loan" : "Legal Fees (SPA & Loan)"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: themeColors.textPrimary }}>
                  RM {mortgageEstimate.legalFees.toLocaleString()}
                </Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                  {isBM ? "Yuran Penilaian (Valuation)" : "Valuation Fee"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: themeColors.textPrimary }}>
                  RM {mortgageEstimate.valuationFee.toLocaleString()}
                </Text>
              </View>

              {/* Total Upfront Needed */}
              <View
                style={{
                  backgroundColor: `${themeColors.maroonPrimary}15`,
                  borderColor: `${themeColors.maroonPrimary}35`,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 4,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.maroonPrimary }}>
                  {isBM ? "Jumlah Tunai Diperlukan:" : "Total Upfront Cash Needed:"}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: themeColors.maroonPrimary }}>
                  RM {mortgageEstimate.totalUpfront.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Income Qualifying Guide */}
            <View
              style={{
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                {isBM ? "Kelayakan Gaji Minimum (DSR 60%)" : "Minimum Income Requirement (60% DSR)"}
              </Text>
              <Text style={{ fontSize: 12, color: themeColors.textMuted, lineHeight: 17 }}>
                {isBM
                  ? `Anggaran gaji bersih minima (individu/gabungan) diperlukan tanpa komitmen luar:`
                  : `Estimated minimum net salary (single/joint) required without other commitments:`}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: themeColors.textPrimary, marginTop: 4 }}>
                RM {mortgageEstimate.recommendedIncome.toLocaleString()}
                <Text style={{ fontSize: 13, fontWeight: "500", color: themeColors.textMuted }}>
                  {" "}
                  / {isBM ? "bulan" : "month"}
                </Text>
              </Text>
            </View>

            {/* Action Buttons: WhatsApp (Primary) & Copy Summary (Secondary) */}
            <View style={{ gap: 8, marginTop: 6 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleShareMortgageWhatsApp}
                style={{
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: "#25D366",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialCommunityIcons name="whatsapp" size={20} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>
                  {isBM ? "Kongsi Pengiraan ke WhatsApp" : "Share Calculation to WhatsApp"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleCopyMortgage}
                style={{
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: themeColors.surfaceContainer,
                  borderColor: themeColors.borderColor,
                  borderWidth: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <MaterialCommunityIcons name={copiedToast ? "check" : "content-copy"} size={18} color={themeColors.textPrimary} />
                <Text style={{ color: themeColors.textPrimary, fontSize: 13, fontWeight: "700" }}>
                  {copiedToast ? (isBM ? "Disalin ke Papan Keratan!" : "Copied to Clipboard!") : (isBM ? "Salin Ringkasan Pengiraan" : "Copy Calculation Summary")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {/* DSR Result Card with Visual Progress Gauge */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 12,
              }}
            >
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: themeColors.textSecondary,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 4,
                  }}
                >
                  {isBM ? "HARGA HARTANAH MAKSIMUM LAYAK" : "MAX ELIGIBLE PROPERTY PRICE"}
                </Text>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "900",
                    color: themeColors.maroonPrimary,
                    letterSpacing: -0.5,
                  }}
                >
                  {formatCurrency(loanEligibility.maxPrice)}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: themeColors.borderColor }} />

              {/* Installment vs Current DSR */}
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: themeColors.textMuted, textTransform: "uppercase" }}>
                    {isBM ? "Ansuran Maksimum" : "Max Monthly Payment"}
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: themeColors.textPrimary, marginTop: 2 }}>
                    {formatCurrency(loanEligibility.maxInstallment)}
                    <Text style={{ fontSize: 12, fontWeight: "500", color: themeColors.textMuted }}> /mo</Text>
                  </Text>
                </View>

                <View style={{ width: 1, backgroundColor: themeColors.borderColor, marginHorizontal: 12 }} />

                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: themeColors.textMuted, textTransform: "uppercase" }}>
                    {isBM ? "Kadar DSR Semasa" : "Current DSR Rate"}
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: dsrStatus.color, marginTop: 2 }}>
                    {currentDsr.toFixed(1)}%
                    <Text style={{ fontSize: 12, fontWeight: "500", color: themeColors.textMuted }}> / {dsrLimitNum}%</Text>
                  </Text>
                </View>
              </View>

              {/* Visual DSR Progress Gauge */}
              <View style={{ gap: 4 }}>
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: themeColors.surfaceContainer,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, currentDsr))}%`,
                      backgroundColor: dsrStatus.color,
                      borderRadius: 4,
                    }}
                  />
                </View>
              </View>

              {/* Status Alert Badge */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: dsrStatus.bg,
                  borderWidth: 1,
                  borderColor: `${dsrStatus.color}25`,
                }}
              >
                <MaterialCommunityIcons name={dsrStatus.icon as any} size={18} color={dsrStatus.color} />
                <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: dsrStatus.color }}>
                  {dsrStatus.label}
                </Text>
              </View>

              {/* Cross-Tab Bridge Button */}
              {loanEligibility.maxPrice > 0 && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleBridgeToHomeLoan}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: `${themeColors.maroonPrimary}12`,
                    borderWidth: 1,
                    borderColor: `${themeColors.maroonPrimary}30`,
                  }}
                >
                  <MaterialCommunityIcons name="arrow-right-circle" size={18} color={themeColors.maroonPrimary} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.maroonPrimary }}>
                    {isBM
                      ? `Kira Ansuran untuk ${formatCurrency(loanEligibility.maxPrice)}`
                      : `Calculate Loan for ${formatCurrency(loanEligibility.maxPrice)}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Net Monthly Income Card */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                  {isBM ? "Pendapatan Bersih Bulanan (RM)" : "Net Monthly Income (RM)"}
                </Text>
                {showSixMonthHelper && (
                  <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.maroonPrimary }}>
                    {isBM ? `Purata: ${formatCurrency(averageIncome)}` : `Avg: ${formatCurrency(averageIncome)}`}
                  </Text>
                )}
              </View>

              {!showSixMonthHelper ? (
                <>
                  <TextInput
                    style={{
                      height: 48,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      backgroundColor: themeColors.canvasBackground,
                      paddingHorizontal: 14,
                      fontSize: 18,
                      fontWeight: "700",
                      color: themeColors.textPrimary,
                    }}
                    keyboardType="numeric"
                    value={quickIncome}
                    onChangeText={setQuickIncome}
                    placeholder="6000"
                    placeholderTextColor={themeColors.textMuted}
                  />

                  {/* Quick Income Presets */}
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    {[3500, 5000, 8000, 12000].map((preset) => (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => setQuickIncome(String(preset))}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          backgroundColor: parseNum(quickIncome) === preset ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: parseNum(quickIncome) === preset ? "#FFFFFF" : themeColors.textSecondary,
                          }}
                        >
                          RM {preset.toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                  {detailedIncomes.map((inc, index) => (
                    <View key={index} style={{ width: "48%" }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: themeColors.textMuted, marginBottom: 4 }}>
                        {isBM ? `Bulan ${index + 1}` : `Month ${index + 1}`}
                      </Text>
                      <TextInput
                        style={{
                          height: 42,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: themeColors.borderColor,
                          backgroundColor: themeColors.canvasBackground,
                          paddingHorizontal: 10,
                          fontSize: 14,
                          fontWeight: "700",
                          color: themeColors.textPrimary,
                        }}
                        keyboardType="numeric"
                        value={inc}
                        onChangeText={(text) => handleDetailedIncomeChange(text, index)}
                        placeholder="6000"
                        placeholderTextColor={themeColors.textMuted}
                      />
                    </View>
                  ))}
                </View>
              )}

              {/* Expandable 6-Month Helper Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setShowSixMonthHelper(!showSixMonthHelper);
                  Haptics.selectionAsync().catch(() => {});
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: `${themeColors.maroonPrimary}12`,
                  borderColor: `${themeColors.maroonPrimary}35`,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  marginTop: 6,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, paddingRight: 4 }}>
                  <MaterialCommunityIcons
                    name="calculator-variant-outline"
                    size={18}
                    color={themeColors.maroonPrimary}
                  />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.maroonPrimary }}>
                    {showSixMonthHelper
                      ? (isBM ? "Tukar ke Gaji Tetap (1 Bulan)" : "Switch to Fixed Monthly Salary")
                      : (isBM ? "Kira Purata Gaji 6 Bulan (Komisen / OT)" : "Calculate 6-Month Average (Variable / OT)")}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={showSixMonthHelper ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={themeColors.maroonPrimary}
                />
              </TouchableOpacity>
            </View>

            {/* Bank DSR Limit Preset Chips */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                  {isBM ? "Had DSR Bank (%)" : "Bank DSR Threshold (%)"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.maroonPrimary }}>
                  {dsrLimitNum}%
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                {[
                  { limit: "60", label: isBM ? "60% (Gaji < RM 3k)" : "60% (< RM 3k)" },
                  { limit: "70", label: isBM ? "70% (Standard Bank)" : "70% (Standard Bank)" },
                  { limit: "80", label: isBM ? "80% (LPPSA Kerajaan)" : "80% (LPPSA)" },
                  { limit: "85", label: isBM ? "85% (Gaji Tinggi)" : "85% (High Income)" },
                ].map((item) => {
                  const isSelected = dsrLimit === item.limit;
                  return (
                    <TouchableOpacity
                      key={item.limit}
                      activeOpacity={0.75}
                      onPress={() => setDsrLimit(item.limit)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: isSelected ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                        borderWidth: 1,
                        borderColor: isSelected ? themeColors.maroonPrimary : themeColors.borderColor,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: isSelected ? "#FFFFFF" : themeColors.textPrimary,
                        }}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Monthly Commitments (Compact 2-Column Grid) */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                  {isBM ? "Komitmen Bulanan" : "Monthly Commitments"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.maroonPrimary }}>
                  Total: {formatCurrency(totalCommitments)}
                </Text>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
                {/* Car Loan */}
                <View style={{ width: "48%" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary, marginBottom: 4 }}>
                    🚗 {isBM ? "Pinjaman Kereta" : "Car Loan"}
                  </Text>
                  <TextInput
                    style={{
                      height: 44,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      backgroundColor: themeColors.canvasBackground,
                      paddingHorizontal: 10,
                      fontSize: 15,
                      fontWeight: "700",
                      color: themeColors.textPrimary,
                    }}
                    keyboardType="numeric"
                    value={carLoan}
                    onChangeText={setCarLoan}
                    placeholder="600"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* Housing Loan */}
                <View style={{ width: "48%" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary, marginBottom: 4 }}>
                    🏠 {isBM ? "Pinjaman Rumah" : "Housing Loan"}
                  </Text>
                  <TextInput
                    style={{
                      height: 44,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      backgroundColor: themeColors.canvasBackground,
                      paddingHorizontal: 10,
                      fontSize: 15,
                      fontWeight: "700",
                      color: themeColors.textPrimary,
                    }}
                    keyboardType="numeric"
                    value={housingLoan}
                    onChangeText={setHousingLoan}
                    placeholder="1200"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* Credit Card */}
                <View style={{ width: "48%" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary, marginBottom: 4 }}>
                    💳 {isBM ? "Kad Kredit (5%)" : "Credit Card (5%)"}
                  </Text>
                  <TextInput
                    style={{
                      height: 44,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      backgroundColor: themeColors.canvasBackground,
                      paddingHorizontal: 10,
                      fontSize: 15,
                      fontWeight: "700",
                      color: themeColors.textPrimary,
                    }}
                    keyboardType="numeric"
                    value={creditCard}
                    onChangeText={setCreditCard}
                    placeholder="150"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* Personal Loan */}
                <View style={{ width: "48%" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary, marginBottom: 4 }}>
                    💼 {isBM ? "Pinjaman Peribadi" : "Personal Loan"}
                  </Text>
                  <TextInput
                    style={{
                      height: 44,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      backgroundColor: themeColors.canvasBackground,
                      paddingHorizontal: 10,
                      fontSize: 15,
                      fontWeight: "700",
                      color: themeColors.textPrimary,
                    }}
                    keyboardType="numeric"
                    value={personalLoan}
                    onChangeText={setPersonalLoan}
                    placeholder="0"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>

                {/* PTPTN / Other */}
                <View style={{ width: "100%" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary, marginBottom: 4 }}>
                    🎓 {isBM ? "PTPTN / Pinjaman Lain" : "PTPTN / Other Commitments"}
                  </Text>
                  <TextInput
                    style={{
                      height: 44,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      backgroundColor: themeColors.canvasBackground,
                      paddingHorizontal: 10,
                      fontSize: 15,
                      fontWeight: "700",
                      color: themeColors.textPrimary,
                    }}
                    keyboardType="numeric"
                    value={ptptnOther}
                    onChangeText={setPtptnOther}
                    placeholder="150"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
              </View>
            </View>

            {/* Action Buttons: WhatsApp (Primary) & Copy (Secondary) */}
            <View style={{ gap: 8, marginTop: 6 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleShareDsrWhatsApp}
                style={{
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: "#25D366",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialCommunityIcons name="whatsapp" size={20} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>
                  {isBM ? "Kongsi Penilaian ke WhatsApp" : "Share Assessment to WhatsApp"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleCopyDsr}
                style={{
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: themeColors.surfaceContainer,
                  borderColor: themeColors.borderColor,
                  borderWidth: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <MaterialCommunityIcons name={copiedToast ? "check" : "content-copy"} size={18} color={themeColors.textPrimary} />
                <Text style={{ color: themeColors.textPrimary, fontSize: 13, fontWeight: "700" }}>
                  {copiedToast ? (isBM ? "Disalin ke Papan Keratan!" : "Copied to Clipboard!") : (isBM ? "Salin Ringkasan Kelayakan DSR" : "Copy DSR Eligibility Summary")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
});
