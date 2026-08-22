import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "@/context/AppSettingsContext";

const { height: screenHeight } = Dimensions.get("window");

import { LoanCalculationResult } from "@/utils/loanCalculator";

interface MortgageCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  mortgageEstimate: LoanCalculationResult;
  downPaymentPercent: number;
  setDownPaymentPercent: (p: number) => void;
  loanTenure: number;
  setLoanTenure: (t: number) => void;
  interestRate: number;
  setInterestRate: (updater: (prev: number) => number) => void;
}

export function MortgageCalculatorModal({
  visible,
  onClose,
  mortgageEstimate,
  downPaymentPercent,
  setDownPaymentPercent,
  loanTenure,
  setLoanTenure,
  interestRate,
  setInterestRate,
}: MortgageCalculatorModalProps) {
  const insets = useSafeAreaInsets();
  const { themeColors, language } = useAppSettings();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.65)", justifyContent: "flex-end" }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{
            backgroundColor: themeColors.cardBackground,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            maxHeight: screenHeight * 0.9,
          }}
        >
          {/* Sheet Drag Handle */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: themeColors.textMuted,
              alignSelf: "center",
              marginTop: 10,
              opacity: 0.4,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 14,
              borderBottomColor: themeColors.borderColor,
              borderBottomWidth: 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name="calculator-variant" size={22} color={themeColors.maroonPrimary} />
              <Text style={{ fontSize: 18, fontWeight: "700", color: themeColors.textPrimary }}>
                {language === "BM" ? "Kalkulator Ansuran Bank" : "Home Loan Calculator"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: themeColors.surfaceContainer,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              padding: 16,
              gap: 14,
              paddingBottom: Math.max(insets.bottom, 20) + 16,
            }}
          >
            {/* Monthly Installment Result Card */}
            <View
              style={{
                backgroundColor: `${themeColors.maroonPrimary}12`,
                borderColor: `${themeColors.maroonPrimary}40`,
                borderWidth: 1.5,
                borderRadius: 16,
                padding: 16,
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: themeColors.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {language === "BM" ? "Anggaran Bayaran Bulanan" : "Estimated Monthly Payment"}
              </Text>
              <Text style={{ fontSize: 30, fontWeight: "800", color: themeColors.maroonPrimary }}>
                RM {mortgageEstimate.monthlyInstallment.toLocaleString()}
                <Text style={{ fontSize: 14, fontWeight: "600", color: themeColors.textSecondary }}>
                  {" "}
                  / {language === "BM" ? "bulan" : "mo"}
                </Text>
              </Text>
              <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 2 }}>
                {language === "BM"
                  ? `Pinjaman: RM ${mortgageEstimate.loanAmount.toLocaleString()} (${100 - downPaymentPercent}% Loan)`
                  : `Loan: RM ${mortgageEstimate.loanAmount.toLocaleString()} (${100 - downPaymentPercent}% Financing)`}
              </Text>
            </View>

            {/* Downpayment Selector */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Deposit / Wang Pendahuluan" : "Down Payment"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.maroonPrimary }}>
                  {downPaymentPercent}% (RM {mortgageEstimate.downPaymentAmount.toLocaleString()})
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { label: "0%", sub: "Full Loan", val: 0 },
                  { label: "10%", sub: "Standard", val: 10 },
                  { label: "15%", sub: "", val: 15 },
                  { label: "20%", sub: "", val: 20 },
                ].map((item) => (
                  <TouchableOpacity
                    key={`dp-${item.val}`}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setDownPaymentPercent(item.val);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 10,
                      borderWidth: 1,
                      backgroundColor:
                        downPaymentPercent === item.val
                          ? themeColors.maroonPrimary
                          : themeColors.surfaceContainer,
                      borderColor:
                        downPaymentPercent === item.val
                          ? themeColors.maroonPrimary
                          : themeColors.borderColor,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: downPaymentPercent === item.val ? "#FFFFFF" : themeColors.textPrimary,
                      }}
                    >
                      {item.label}
                    </Text>
                    {item.sub ? (
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "500",
                          marginTop: 1,
                          color:
                            downPaymentPercent === item.val
                              ? "rgba(255,255,255,0.85)"
                              : themeColors.textMuted,
                        }}
                      >
                        {item.sub}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Loan Tenure Selector */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Tempoh Pembiayaan" : "Loan Tenure"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.maroonPrimary }}>
                  {loanTenure} {language === "BM" ? "Tahun" : "Years"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[20, 25, 30, 35].map((yrs) => (
                  <TouchableOpacity
                    key={`tenure-${yrs}`}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setLoanTenure(yrs);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 10,
                      borderWidth: 1,
                      backgroundColor:
                        loanTenure === yrs ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                      borderColor:
                        loanTenure === yrs ? themeColors.maroonPrimary : themeColors.borderColor,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: loanTenure === yrs ? "#FFFFFF" : themeColors.textPrimary,
                      }}
                    >
                      {yrs} {language === "BM" ? "Thn" : "Yrs"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Interest Rate Stepper */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 2,
              }}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Kadar Faedah Bank" : "Interest Rate"}
                </Text>
                <Text style={{ fontSize: 12, color: themeColors.textMuted }}>
                  {language === "BM" ? "Purata bank semasa (BR/SBR)" : "Current market average"}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: themeColors.surfaceContainer,
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setInterestRate((prev) => Math.max(2.5, Math.round((prev - 0.1) * 10) / 10));
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: themeColors.cardBackground,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name="minus" size={18} color={themeColors.textPrimary} />
                </TouchableOpacity>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: themeColors.textPrimary,
                    minWidth: 44,
                    textAlign: "center",
                  }}
                >
                  {interestRate.toFixed(1)}%
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setInterestRate((prev) => Math.min(8.0, Math.round((prev + 0.1) * 10) / 10));
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: themeColors.cardBackground,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={themeColors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Entry Cost Breakdown */}
            <View
              style={{
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                gap: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: themeColors.textPrimary,
                  marginBottom: 2,
                }}
              >
                {language === "BM" ? "Perincian Kos Permulaan (Anggaran)" : "Estimated Entry Cost Breakdown"}
              </Text>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                  {language === "BM" ? "Duti Setem MOT (SPA)" : "Stamp Duty (SPA)"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: themeColors.textPrimary }}>
                  RM {mortgageEstimate.stampDuty.toLocaleString()}
                </Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                  {language === "BM" ? "Yuran Guaman SPA & Loan" : "Legal Fees (SPA & Loan)"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: themeColors.textPrimary }}>
                  RM {mortgageEstimate.legalFees.toLocaleString()}
                </Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                  {language === "BM" ? "Yuran Penilaian (Valuation)" : "Valuation Fee"}
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
                  marginTop: 2,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.maroonPrimary }}>
                  {language === "BM" ? "Jumlah Tunai Diperlukan:" : "Total Upfront Cash Needed:"}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: "800", color: themeColors.maroonPrimary }}>
                  RM {mortgageEstimate.totalUpfront.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Income Qualifying Guide */}
            <View
              style={{
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary }}>
                {language === "BM" ? "Kelayakan Gaji Minimum (DSR 60%)" : "Minimum Income Requirement (60% DSR)"}
              </Text>
              <Text style={{ fontSize: 12, color: themeColors.textMuted, lineHeight: 16 }}>
                {language === "BM"
                  ? `Anggaran gaji bersih minima (individu/gabungan) diperlukan tanpa komitmen luar:`
                  : `Estimated minimum net salary (single/joint) required without other commitments:`}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: "800", color: themeColors.textPrimary, marginTop: 4 }}>
                RM {mortgageEstimate.recommendedIncome.toLocaleString()}
                <Text style={{ fontSize: 12, fontWeight: "500", color: themeColors.textMuted }}>
                  {" "}
                  / {language === "BM" ? "bulan" : "month"}
                </Text>
              </Text>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
