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
import { calculateMortgage, calculateLPPSA } from "@/utils/loanCalculator";

export default function CalculatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ price?: string; tab?: string }>();
  const { themeColors, t, language } = useAppSettings();
  const isBM = language === "BM";

  // Top level tab: "mortgage" (Home Loan) vs "dsr" (DSR Eligibility) vs "lppsa" (Government Loan)
  const [primaryTab, setPrimaryTab] = useState<"mortgage" | "dsr" | "lppsa">(
    params.tab === "dsr" ? "dsr" : params.tab === "lppsa" ? "lppsa" : "mortgage"
  );

  // Mortgage Calculator State
  const [propertyPrice, setPropertyPrice] = useState<string>(
    params.price ? String(params.price) : "500000"
  );
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(10);
  const [loanTenure, setLoanTenure] = useState<number>(30);
  const [interestRate, setInterestRate] = useState<number>(4.2);
  const [isFirstHomeBuyer, setIsFirstHomeBuyer] = useState<boolean>(true);
  const [includeInsurance, setIncludeInsurance] = useState<boolean>(true);
  const [financeMrtt, setFinanceMrtt] = useState<boolean>(true);
  const [borrowerAge, setBorrowerAge] = useState<number>(30);
  const [copiedToast, setCopiedToast] = useState(false);

  // LPPSA (Government Loan) State
  const [lppsaBasicSalary, setLppsaBasicSalary] = useState<string>("4500");
  const [lppsaFixedAllowance, setLppsaFixedAllowance] = useState<string>("1150");
  const [lppsaPayslipDeductions, setLppsaPayslipDeductions] = useState<string>("800");
  const [lppsaPropertyPrice, setLppsaPropertyPrice] = useState<string>(
    params.price ? String(params.price) : "400000"
  );
  const [lppsaBorrowerAge, setLppsaBorrowerAge] = useState<number>(32);
  const [lppsaScheme, setLppsaScheme] = useState<"skim1" | "skim2">("skim1");

  useEffect(() => {
    if (params.price) {
      setPropertyPrice(String(params.price));
      setLppsaPropertyPrice(String(params.price));
      if (!params.tab) setPrimaryTab("mortgage");
    } else if (params.tab === "dsr") {
      setPrimaryTab("dsr");
    } else if (params.tab === "lppsa") {
      setPrimaryTab("lppsa");
    }
  }, [params.price, params.tab]);

  // Mortgage Calculation Result
  const parsedPrice = useMemo(() => {
    const clean = propertyPrice.replace(/[^0-9]/g, "");
    return parseInt(clean, 10) || 0;
  }, [propertyPrice]);

  const mortgageEstimate = useMemo(() => {
    return calculateMortgage(
      parsedPrice,
      downPaymentPercent,
      interestRate,
      loanTenure,
      isFirstHomeBuyer,
      borrowerAge,
      includeInsurance,
      financeMrtt
    );
  }, [parsedPrice, downPaymentPercent, interestRate, loanTenure, isFirstHomeBuyer, borrowerAge, includeInsurance, financeMrtt]);

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
    const installmentDisplay = mortgageEstimate.isInsuranceFinanced
      ? `${mortgageEstimate.monthlyInstallmentWithInsurance.toLocaleString()} (Termasuk MRTT)`
      : `${mortgageEstimate.monthlyInstallment.toLocaleString()}`;

    const insuranceUpfrontText = includeInsurance
      ? `- Insurans Kebakaran (1 Thn): RM ${mortgageEstimate.fireInsuranceAnnual.toLocaleString()}\n` +
        (!financeMrtt ? `- MRTT/MRTA (Tunai): RM ${mortgageEstimate.mrttEstimate.toLocaleString()}\n` : `- MRTT/MRTA: RM ${mortgageEstimate.mrttEstimate.toLocaleString()} (Dibiayai dlm Pinjaman)\n`)
      : "";

    const text =
      `🏡 *Anggaran Pinjaman Hartanah*\n` +
      `Harga Rumah: RM ${parsedPrice.toLocaleString()}\n` +
      `Deposit (${downPaymentPercent}%): RM ${mortgageEstimate.downPaymentAmount.toLocaleString()}\n` +
      `Pinjaman: RM ${mortgageEstimate.effectiveLoanAmount.toLocaleString()} (${loanTenure} Tahun @ ${interestRate}%)\n` +
      `---------------------------------\n` +
      `💰 *Ansuran Bulanan: RM ${installmentDisplay} /bulan*\n` +
      `---------------------------------\n` +
      `📋 *Kos Permulaan (Entry Costs):*\n` +
      `- Duti Setem MOT: RM ${mortgageEstimate.stampDuty.toLocaleString()}${isFirstHomeBuyer && parsedPrice <= 500000 ? " (Pengecualian 100%)" : ""}\n` +
      `- Yuran Guaman: RM ${mortgageEstimate.legalFees.toLocaleString()}\n` +
      `- Yuran Penilaian: RM ${mortgageEstimate.valuationFee.toLocaleString()}\n` +
      insuranceUpfrontText +
      `💵 *Jumlah Tunai Diperlukan: RM ${mortgageEstimate.totalUpfrontWithInsurance.toLocaleString()}*\n\n` +
      `🎯 *Gaji Bersih Minima Diperlukan:* RM ${mortgageEstimate.recommendedIncome.toLocaleString()} /bulan`;

    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const handleShareMortgageWhatsApp = () => {
    const installmentDisplay = mortgageEstimate.isInsuranceFinanced
      ? `RM ${mortgageEstimate.monthlyInstallmentWithInsurance.toLocaleString()} /bulan (Termasuk Finansial MRTT)`
      : `RM ${mortgageEstimate.monthlyInstallment.toLocaleString()} /bulan`;

    const insuranceUpfrontText = includeInsurance
      ? `- Insurans Kebakaran (1 Thn): RM ${mortgageEstimate.fireInsuranceAnnual.toLocaleString()}\n` +
        (!financeMrtt ? `- MRTT/MRTA (Tunai): RM ${mortgageEstimate.mrttEstimate.toLocaleString()}\n` : `- MRTT/MRTA: RM ${mortgageEstimate.mrttEstimate.toLocaleString()} (Dibiayai dlm Pinjaman)\n`)
      : "";

    const text =
      `*Anggaran Pinjaman Hartanah*\n\n` +
      `Harga Rumah: RM ${parsedPrice.toLocaleString()}\n` +
      `Deposit (${downPaymentPercent}%): RM ${mortgageEstimate.downPaymentAmount.toLocaleString()}\n` +
      `Jumlah Pinjaman: RM ${mortgageEstimate.effectiveLoanAmount.toLocaleString()}\n` +
      `Tempoh: ${loanTenure} Tahun | Kadar: ${interestRate}%\n\n` +
      `*Ansuran Bulanan:* ${installmentDisplay}\n\n` +
      `*Kos Permulaan (Entry Cost):*\n` +
      `- Duti Setem MOT: RM ${mortgageEstimate.stampDuty.toLocaleString()}${isFirstHomeBuyer && parsedPrice <= 500000 ? " (Pengecualian 100%)" : ""}\n` +
      `- Yuran Guaman: RM ${mortgageEstimate.legalFees.toLocaleString()}\n` +
      `- Yuran Penilaian: RM ${mortgageEstimate.valuationFee.toLocaleString()}\n` +
      insuranceUpfrontText +
      `*Jumlah Tunai Diperlukan:* RM ${mortgageEstimate.totalUpfrontWithInsurance.toLocaleString()}\n\n` +
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

  // LPPSA Calculations
  const parsedLppsaBasic = useMemo(() => parseNum(lppsaBasicSalary), [lppsaBasicSalary]);
  const parsedLppsaAllowance = useMemo(() => parseNum(lppsaFixedAllowance), [lppsaFixedAllowance]);
  const parsedLppsaDeductions = useMemo(() => parseNum(lppsaPayslipDeductions), [lppsaPayslipDeductions]);
  const parsedLppsaPrice = useMemo(() => parseNum(lppsaPropertyPrice), [lppsaPropertyPrice]);

  const lppsaEstimate = useMemo(() => {
    return calculateLPPSA({
      basicSalary: parsedLppsaBasic,
      fixedAllowances: parsedLppsaAllowance,
      currentPayslipDeductions: parsedLppsaDeductions,
      propertyPrice: parsedLppsaPrice,
      borrowerAge: lppsaBorrowerAge,
      scheme: lppsaScheme,
    });
  }, [parsedLppsaBasic, parsedLppsaAllowance, parsedLppsaDeductions, parsedLppsaPrice, lppsaBorrowerAge, lppsaScheme]);

  const handleCopyLppsa = async () => {
    const schemeLabel = lppsaScheme === "skim1" ? "Skim 1 (Pinjaman Pertama)" : "Skim 2 (Pinjaman Kedua)";
    const statusText = lppsaEstimate.isEligible ? "✅ LAYAK / ELIGIBLE" : "⚠️ MELEBIHI HAD / OVER LIMIT";

    const text =
      `🏛️ *Penilaian Kelayakan Pinjaman LPPSA (Kerajaan)*\n` +
      `Skim: ${schemeLabel}\n` +
      `Gaji Pokok: ${formatCurrency(parsedLppsaBasic)}\n` +
      `Imbuhan Tetap: ${formatCurrency(parsedLppsaAllowance)}\n` +
      `Gaji Kelayakan: ${formatCurrency(lppsaEstimate.qualifyingIncome)}\n` +
      `Potongan Slip Gaji Sedia Ada: ${formatCurrency(parsedLppsaDeductions)}\n` +
      `---------------------------------\n` +
      `🏠 *Kelayakan LPPSA (Kadar Tetap 4.0%):*\n` +
      `- Jumlah Pinjaman Layak: ${formatCurrency(lppsaEstimate.maxEligibleLoanAmount)}\n` +
      `- Tempoh Maksimum: ${lppsaEstimate.maxTenureYears} Tahun (Had Umur 70)\n` +
      `- Had Ansuran Dibenarkan: ${formatCurrency(lppsaEstimate.maxAllowableMonthlyDeduction)} /bulan\n` +
      (parsedLppsaPrice > 0
        ? `- Harga Hartanah Dimohon: ${formatCurrency(parsedLppsaPrice)}\n` +
          `- Ansuran Bulanan LPPSA: ${formatCurrency(lppsaEstimate.monthlyInstallment)} /bulan\n`
        : "") +
      `---------------------------------\n` +
      `🎯 *Status Kelayakan:* ${statusText}\n` +
      (lppsaEstimate.rejectionReason ? `Nota: ${lppsaEstimate.rejectionReason}\n` : "") +
      `💵 *Anggaran Gaji Bersih Dibawa Pulang:* ${formatCurrency(lppsaEstimate.netTakeHomeAfterLoan)} /bulan`;

    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const handleShareLppsaWhatsApp = () => {
    const schemeLabel = lppsaScheme === "skim1" ? "Skim 1 (Pinjaman Pertama)" : "Skim 2 (Pinjaman Kedua)";
    const statusText = lppsaEstimate.isEligible ? "✅ LAYAK (ELIGIBLE)" : "⚠️ MELEBIHI HAD";

    const text =
      `🏛️ *Semakan Kelayakan Pinjaman LPPSA (Kerajaan)*\n\n` +
      `Skim: ${schemeLabel} | Umur: ${lppsaBorrowerAge} Thn\n` +
      `Gaji Kelayakan (Pokok + Imbuhan): ${formatCurrency(lppsaEstimate.qualifyingIncome)}\n` +
      `Potongan Sedia Ada: ${formatCurrency(parsedLppsaDeductions)}\n\n` +
      `*Keputusan Kelayakan LPPSA (Kadar Tetap 4.0%):*\n` +
      `• Kelayakan Pinjaman Maksimum: *${formatCurrency(lppsaEstimate.maxEligibleLoanAmount)}*\n` +
      `• Tempoh Maksimum: ${lppsaEstimate.maxTenureYears} Tahun\n` +
      `• Had Ansuran Bulanan: ${formatCurrency(lppsaEstimate.maxAllowableMonthlyDeduction)} /bulan\n\n` +
      (parsedLppsaPrice > 0
        ? `*Permohonan Hartanah (${formatCurrency(parsedLppsaPrice)}):*\n` +
          `• Ansuran Bulanan: *${formatCurrency(lppsaEstimate.monthlyInstallment)} /bulan*\n` +
          `• Status: *${statusText}*\n\n`
        : "") +
      `💵 Baki Gaji Bersih Dibawa Pulang: *${formatCurrency(lppsaEstimate.netTakeHomeAfterLoan)} /bulan*`;

    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "WhatsApp is not installed on your device.");
    });
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

      {/* Primary Tab Switcher (3 Tabs) */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: themeColors.cardBackground,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.borderColor,
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 6,
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
            borderRadius: 10,
            gap: 4,
            backgroundColor: primaryTab === "mortgage" ? themeColors.maroonPrimary : themeColors.surfaceContainer,
          }}
        >
          <MaterialCommunityIcons
            name="calculator-variant"
            size={16}
            color={primaryTab === "mortgage" ? "#FFFFFF" : themeColors.textSecondary}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: primaryTab === "mortgage" ? "#FFFFFF" : themeColors.textSecondary,
            }}
          >
            {isBM ? "Ansuran" : "Mortgage"}
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
            borderRadius: 10,
            gap: 4,
            backgroundColor: primaryTab === "dsr" ? themeColors.maroonPrimary : themeColors.surfaceContainer,
          }}
        >
          <MaterialCommunityIcons
            name="percent"
            size={16}
            color={primaryTab === "dsr" ? "#FFFFFF" : themeColors.textSecondary}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: primaryTab === "dsr" ? "#FFFFFF" : themeColors.textSecondary,
            }}
          >
            {isBM ? "DSR Bank" : "Bank DSR"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            setPrimaryTab("lppsa");
            Haptics.selectionAsync().catch(() => {});
          }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            borderRadius: 10,
            gap: 4,
            backgroundColor: primaryTab === "lppsa" ? themeColors.maroonPrimary : themeColors.surfaceContainer,
          }}
        >
          <MaterialCommunityIcons
            name="bank"
            size={16}
            color={primaryTab === "lppsa" ? "#FFFFFF" : themeColors.textSecondary}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: primaryTab === "lppsa" ? "#FFFFFF" : themeColors.textSecondary,
            }}
          >
            {isBM ? "LPPSA" : "Gov LPPSA"}
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
                RM {mortgageEstimate.monthlyInstallmentWithInsurance.toLocaleString()}
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
                  ? `Pinjaman: RM ${mortgageEstimate.effectiveLoanAmount.toLocaleString()} (${100 - downPaymentPercent}% Pembiayaan${mortgageEstimate.isInsuranceFinanced && mortgageEstimate.mrttEstimate > 0 ? " + Finansial MRTT" : ""})`
                  : `Loan: RM ${mortgageEstimate.effectiveLoanAmount.toLocaleString()} (${100 - downPaymentPercent}% Financing${mortgageEstimate.isInsuranceFinanced && mortgageEstimate.mrttEstimate > 0 ? " + MRTT Financed" : ""})`}
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

            {/* Insurance & Takaful (MRTT / Fire) Card */}
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
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                    {isBM ? "Insurans & Takaful Pinjaman" : "Loan Insurance & Takaful"}
                  </Text>
                  <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 2 }}>
                    {isBM
                      ? "Anggaran MRTT (Hayat) & Insurans Kebakaran"
                      : "Estimated MRTT (Life) & Fire Insurance"}
                  </Text>
                </View>
                <Switch
                  value={includeInsurance}
                  onValueChange={(val) => {
                    setIncludeInsurance(val);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  trackColor={{ false: themeColors.surfaceContainer, true: themeColors.maroonPrimary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {includeInsurance && (
                <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: themeColors.borderColor, paddingTop: 12 }}>
                  {/* Borrower Age Selector */}
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary }}>
                        {isBM ? "Umur Peminjam Semasa" : "Borrower Age"}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.maroonPrimary }}>
                        {borrowerAge} {isBM ? "Tahun" : "Years"}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {[25, 30, 35, 40, 45, 50].map((age) => {
                        const isSelected = borrowerAge === age;
                        return (
                          <TouchableOpacity
                            key={age}
                            onPress={() => {
                              setBorrowerAge(age);
                              Haptics.selectionAsync().catch(() => {});
                            }}
                            style={{
                              flex: 1,
                              paddingVertical: 6,
                              borderRadius: 8,
                              alignItems: "center",
                              borderWidth: 1,
                              backgroundColor: isSelected ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                              borderColor: isSelected ? themeColors.maroonPrimary : themeColors.borderColor,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: isSelected ? "#FFFFFF" : themeColors.textSecondary,
                              }}
                            >
                              {age}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* MRTT Financing Choice */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary }}>
                      {isBM ? "Kaedah Pembayaran MRTT / MRTA" : "MRTT / MRTA Payment Method"}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setFinanceMrtt(true);
                          Haptics.selectionAsync().catch(() => {});
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          paddingHorizontal: 8,
                          borderRadius: 10,
                          alignItems: "center",
                          borderWidth: 1,
                          backgroundColor: financeMrtt ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                          borderColor: financeMrtt ? themeColors.maroonPrimary : themeColors.borderColor,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: financeMrtt ? "#FFFFFF" : themeColors.textPrimary,
                            textAlign: "center",
                          }}
                        >
                          {isBM ? "Biayai dlm Pinjaman" : "Financed in Loan"}
                        </Text>
                        <Text
                          style={{
                            fontSize: 9,
                            color: financeMrtt ? "rgba(255,255,255,0.8)" : themeColors.textMuted,
                            marginTop: 2,
                            textAlign: "center",
                          }}
                        >
                          {isBM ? "Disyorkan (Tunai Minima)" : "Recommended"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setFinanceMrtt(false);
                          Haptics.selectionAsync().catch(() => {});
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          paddingHorizontal: 8,
                          borderRadius: 10,
                          alignItems: "center",
                          borderWidth: 1,
                          backgroundColor: !financeMrtt ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                          borderColor: !financeMrtt ? themeColors.maroonPrimary : themeColors.borderColor,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: !financeMrtt ? "#FFFFFF" : themeColors.textPrimary,
                            textAlign: "center",
                          }}
                        >
                          {isBM ? "Bayar Tunai Sahaja" : "Pay Cash Upfront"}
                        </Text>
                        <Text
                          style={{
                            fontSize: 9,
                            color: !financeMrtt ? "rgba(255,255,255,0.8)" : themeColors.textMuted,
                            marginTop: 2,
                            textAlign: "center",
                          }}
                        >
                          {isBM ? "Tanpa Faedah Pinjaman" : "Zero Loan Interest"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Summary preview of insurance values */}
                  <View
                    style={{
                      backgroundColor: themeColors.surfaceContainer,
                      padding: 10,
                      borderRadius: 10,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                        {isBM ? "Anggaran Premium MRTT/MRTA:" : "Estimated MRTT/MRTA Premium:"}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textPrimary }}>
                        RM {mortgageEstimate.mrttEstimate.toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                        {isBM ? "Insurans Kebakaran / Rumah:" : "Houseowner / Fire Insurance:"}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textPrimary }}>
                        RM {mortgageEstimate.fireInsuranceAnnual.toLocaleString()}
                        <Text style={{ fontSize: 10, color: themeColors.textMuted }}>
                          {" "}
                          / {isBM ? "thn" : "yr"} (~RM {mortgageEstimate.fireInsuranceMonthly}/bln)
                        </Text>
                      </Text>
                    </View>
                  </View>
                </View>
              )}
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

              {includeInsurance && (
                <>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                      {isBM ? "Insurans Kebakaran (1 Tahun)" : "Fire Insurance (1 Year)"}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: themeColors.textPrimary }}>
                      RM {mortgageEstimate.fireInsuranceAnnual.toLocaleString()}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                      {isBM ? "Takaful / MRTT (Hayat)" : "MRTT / Life Takaful"}
                    </Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: themeColors.textPrimary }}>
                        RM {mortgageEstimate.mrttEstimate.toLocaleString()}
                      </Text>
                      <Text style={{ fontSize: 10, color: financeMrtt ? "#10B981" : themeColors.textMuted, fontWeight: "600" }}>
                        {financeMrtt
                          ? (isBM ? "[Dibiayai dlm Pinjaman]" : "[Financed in Loan]")
                          : (isBM ? "[Dibayar Tunai]" : "[Paid Cash]")}
                      </Text>
                    </View>
                  </View>
                </>
              )}

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
                  RM {mortgageEstimate.totalUpfrontWithInsurance.toLocaleString()}
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
        ) : primaryTab === "dsr" ? (
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
        ) : (
          /* LPPSA Government Loan View */
          <View style={{ gap: 14 }}>
            {/* Header Result Card */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 16,
                padding: 18,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textMuted }}>
                    {isBM ? "Kelayakan Pinjaman LPPSA" : "LPPSA Loan Eligibility"}
                  </Text>
                  <Text style={{ fontSize: 26, fontWeight: "800", color: themeColors.maroonPrimary, marginTop: 2 }}>
                    {formatCurrency(lppsaEstimate.maxEligibleLoanAmount)}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: `${themeColors.maroonPrimary}15`,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.maroonPrimary }}>
                    {isBM ? "Kadar Tetap 4.0%" : "Fixed 4.0%"}
                  </Text>
                </View>
              </View>

              {/* Status Badge */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: lppsaEstimate.isEligible ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  borderWidth: 1,
                  borderColor: lppsaEstimate.isEligible ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)",
                }}
              >
                <MaterialCommunityIcons
                  name={lppsaEstimate.isEligible ? "checkbox-marked-circle" : "alert-circle"}
                  size={18}
                  color={lppsaEstimate.isEligible ? "#10B981" : "#EF4444"}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: "600",
                    color: lppsaEstimate.isEligible ? "#10B981" : "#EF4444",
                  }}
                >
                  {lppsaEstimate.isEligible
                    ? (isBM
                        ? `LAYAK: Ansuran RM ${lppsaEstimate.monthlyInstallment.toLocaleString()}/bln dalam had ${formatCurrency(lppsaEstimate.maxAllowableMonthlyDeduction)}.`
                        : `ELIGIBLE: Installment RM ${lppsaEstimate.monthlyInstallment.toLocaleString()}/mo is within ${formatCurrency(lppsaEstimate.maxAllowableMonthlyDeduction)} limit.`)
                    : (lppsaEstimate.rejectionReason || (isBM ? "MELEBIHI HAD KELAYAKAN POTONGAN SLIP GAJI" : "EXCEEDS PAYSLIP DEDUCTION LIMIT"))}
                </Text>
              </View>

              {/* Key Metrics Grid */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: themeColors.canvasBackground,
                    borderRadius: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                  }}
                >
                  <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
                    {isBM ? "Had Ansuran (60%/50%)" : "Max Monthly Limit"}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary, marginTop: 2 }}>
                    {formatCurrency(lppsaEstimate.maxAllowableMonthlyDeduction)}
                  </Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    backgroundColor: themeColors.canvasBackground,
                    borderRadius: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                  }}
                >
                  <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
                    {isBM ? "Baki Bersih Pulang" : "Net Take-Home"}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary, marginTop: 2 }}>
                    {formatCurrency(lppsaEstimate.netTakeHomeAfterLoan)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Scheme Selector */}
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
              <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                {isBM ? "Pilih Skim Pinjaman LPPSA" : "Select LPPSA Loan Scheme"}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setLppsaScheme("skim1");
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: lppsaScheme === "skim1" ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                    borderWidth: 1,
                    borderColor: lppsaScheme === "skim1" ? themeColors.maroonPrimary : themeColors.borderColor,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: lppsaScheme === "skim1" ? "#FFFFFF" : themeColors.textPrimary,
                    }}
                  >
                    {isBM ? "Skim 1 (Pertama)" : "Scheme 1 (First)"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: lppsaScheme === "skim1" ? "rgba(255,255,255,0.8)" : themeColors.textMuted,
                      marginTop: 2,
                    }}
                  >
                    {isBM ? "Had 60% • Max 35 Thn" : "60% Cap • Max 35 Yrs"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setLppsaScheme("skim2");
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: lppsaScheme === "skim2" ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                    borderWidth: 1,
                    borderColor: lppsaScheme === "skim2" ? themeColors.maroonPrimary : themeColors.borderColor,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: lppsaScheme === "skim2" ? "#FFFFFF" : themeColors.textPrimary,
                    }}
                  >
                    {isBM ? "Skim 2 (Kedua)" : "Scheme 2 (Second)"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: lppsaScheme === "skim2" ? "rgba(255,255,255,0.8)" : themeColors.textMuted,
                      marginTop: 2,
                    }}
                  >
                    {isBM ? "Had 50% • Max 30 Thn" : "50% Cap • Max 30 Yrs"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Income & Deduction Inputs */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.borderColor,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 14,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                {isBM ? "Maklumat Gaji & Slip Gaji (RM)" : "Salary & Payslip Details (RM)"}
              </Text>

              {/* Gaji Pokok */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary, marginBottom: 4 }}>
                  {isBM ? "Gaji Pokok Bulanan" : "Monthly Basic Salary"}
                </Text>
                <TextInput
                  style={{
                    height: 46,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                    backgroundColor: themeColors.canvasBackground,
                    paddingHorizontal: 12,
                    fontSize: 16,
                    fontWeight: "700",
                    color: themeColors.textPrimary,
                  }}
                  keyboardType="numeric"
                  value={lppsaBasicSalary}
                  onChangeText={setLppsaBasicSalary}
                  placeholder="4500"
                  placeholderTextColor={themeColors.textMuted}
                />
              </View>

              {/* Imbuhan Tetap */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary, marginBottom: 4 }}>
                  {isBM ? "Imbuhan Tetap (ITP / ITK / COLA)" : "Fixed Allowances (ITP / ITK / COLA)"}
                </Text>
                <TextInput
                  style={{
                    height: 46,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                    backgroundColor: themeColors.canvasBackground,
                    paddingHorizontal: 12,
                    fontSize: 16,
                    fontWeight: "700",
                    color: themeColors.textPrimary,
                  }}
                  keyboardType="numeric"
                  value={lppsaFixedAllowance}
                  onChangeText={setLppsaFixedAllowance}
                  placeholder="1150"
                  placeholderTextColor={themeColors.textMuted}
                />
              </View>

              {/* Potongan Slip Gaji Sedia Ada */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary, marginBottom: 4 }}>
                  {isBM ? "Potongan Sedia Ada Dalam Slip Gaji" : "Existing Payslip Deductions"}
                </Text>
                <TextInput
                  style={{
                    height: 46,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                    backgroundColor: themeColors.canvasBackground,
                    paddingHorizontal: 12,
                    fontSize: 16,
                    fontWeight: "700",
                    color: themeColors.textPrimary,
                  }}
                  keyboardType="numeric"
                  value={lppsaPayslipDeductions}
                  onChangeText={setLppsaPayslipDeductions}
                  placeholder="800"
                  placeholderTextColor={themeColors.textMuted}
                />
              </View>

              {/* Age & Property Price Row */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary, marginBottom: 4 }}>
                    {isBM ? "Umur Pemohon" : "Borrower Age"}
                  </Text>
                  <View
                    style={{
                      height: 46,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      backgroundColor: themeColors.canvasBackground,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 8,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setLppsaBorrowerAge(Math.max(20, lppsaBorrowerAge - 1));
                        Haptics.selectionAsync().catch(() => {});
                      }}
                      style={{ padding: 6 }}
                    >
                      <MaterialCommunityIcons name="minus" size={18} color={themeColors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                      {lppsaBorrowerAge} {isBM ? "Thn" : "Yrs"}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setLppsaBorrowerAge(Math.min(65, lppsaBorrowerAge + 1));
                        Haptics.selectionAsync().catch(() => {});
                      }}
                      style={{ padding: 6 }}
                    >
                      <MaterialCommunityIcons name="plus" size={18} color={themeColors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flex: 1.3 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textSecondary, marginBottom: 4 }}>
                    {isBM ? "Harga Hartanah" : "Property Price"}
                  </Text>
                  <TextInput
                    style={{
                      height: 46,
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
                    value={lppsaPropertyPrice}
                    onChangeText={setLppsaPropertyPrice}
                    placeholder="400000"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
              </View>
            </View>

            {/* Action Buttons: WhatsApp & Copy */}
            <View style={{ gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleShareLppsaWhatsApp}
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
                  {isBM ? "Kongsi Penilaian LPPSA ke WhatsApp" : "Share LPPSA Assessment to WhatsApp"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleCopyLppsa}
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
                  {copiedToast ? (isBM ? "Disalin ke Papan Keratan!" : "Copied to Clipboard!") : (isBM ? "Salin Ringkasan Kelayakan LPPSA" : "Copy LPPSA Eligibility Summary")}
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
