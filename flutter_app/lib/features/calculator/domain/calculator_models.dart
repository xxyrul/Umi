import 'package:flutter/foundation.dart';

enum PropertyCategory { newLaunch, subsale }

@immutable
class MortgageResult {
  final PropertyCategory category;
  final double propertyPrice;
  final double developerDiscountPercent;
  final double developerDiscountAmount;
  final double netPurchasePrice;
  final double downPaymentPercent;
  final double downPaymentAmount;
  final double loanAmount;
  final double effectiveLoanAmount;
  final double monthlyInstallment;
  final double monthlyInstallmentWithInsurance;
  final double totalPayment;
  final double totalInterest;
  final double stampDuty;
  final double originalStampDuty;
  final double legalFees;
  final double loanLegalFees;
  final double loanStampDuty;
  final double valuationFee;
  final bool isFirstHomeBuyer;
  final bool freeSpaLegal;
  final bool freeSpaMot;
  final bool freeLoanLegal;
  final bool freeLoanStampDuty;
  final double totalUpfront;
  final double totalUpfrontWithInsurance;
  final double recommendedIncome;
  final double mrttEstimate;
  final double fireInsuranceAnnual;
  final double fireInsuranceMonthly;
  final bool isInsuranceFinanced;
  final bool includeMrtt;
  final bool includeFireInsurance;

  const MortgageResult({
    required this.category,
    required this.propertyPrice,
    required this.developerDiscountPercent,
    required this.developerDiscountAmount,
    required this.netPurchasePrice,
    required this.downPaymentPercent,
    required this.downPaymentAmount,
    required this.loanAmount,
    required this.effectiveLoanAmount,
    required this.monthlyInstallment,
    required this.monthlyInstallmentWithInsurance,
    required this.totalPayment,
    required this.totalInterest,
    required this.stampDuty,
    required this.originalStampDuty,
    required this.legalFees,
    required this.loanLegalFees,
    required this.loanStampDuty,
    required this.valuationFee,
    required this.isFirstHomeBuyer,
    required this.freeSpaLegal,
    required this.freeSpaMot,
    required this.freeLoanLegal,
    required this.freeLoanStampDuty,
    required this.totalUpfront,
    required this.totalUpfrontWithInsurance,
    required this.recommendedIncome,
    required this.mrttEstimate,
    required this.fireInsuranceAnnual,
    required this.fireInsuranceMonthly,
    required this.isInsuranceFinanced,
    required this.includeMrtt,
    required this.includeFireInsurance,
  });
}

enum DsrStatus {
  eligible,     // DSR <= 60%
  moderate,     // 60% < DSR <= Limit
  exceeded,     // DSR > Limit
}

@immutable
class DsrResult {
  final double netIncome;
  final double totalExistingCommitments;
  final double dsrLimitPercent;
  final double currentDsrPercent;
  final double maxTotalAllowableCommitment;
  final double maxAllowableHousingInstallment;
  final double maxEligiblePropertyPrice;
  final double maxEligibleLoanAmount;
  final DsrStatus status;
  final String statusLabel;

  const DsrResult({
    required this.netIncome,
    required this.totalExistingCommitments,
    required this.dsrLimitPercent,
    required this.currentDsrPercent,
    required this.maxTotalAllowableCommitment,
    required this.maxAllowableHousingInstallment,
    required this.maxEligiblePropertyPrice,
    required this.maxEligibleLoanAmount,
    required this.status,
    required this.statusLabel,
  });

  String localizedStatusLabel(bool isBM) {
    switch (status) {
      case DsrStatus.eligible:
        return isBM ? 'Sangat Layak (Sihat)' : 'Qualified (Healthy)';
      case DsrStatus.moderate:
        return isBM ? 'Sederhana (Dalam Had)' : 'Moderate (Within Limit)';
      case DsrStatus.exceeded:
        return isBM ? 'Melebihi Had DSR' : 'DSR Limit Exceeded';
    }
  }
}

@immutable
class LegalFeesResult {
  final double propertyPrice;
  final double loanAmount;
  final bool isFirstHomeBuyer;
  final double spaStampDuty;
  final double originalSpaStampDuty;
  final double spaLegalFees;
  final double loanStampDuty;
  final double loanLegalFees;
  final double disbursementsEst;
  final double totalLegalAndDuties;

  const LegalFeesResult({
    required this.propertyPrice,
    required this.loanAmount,
    required this.isFirstHomeBuyer,
    required this.spaStampDuty,
    required this.originalSpaStampDuty,
    required this.spaLegalFees,
    required this.loanStampDuty,
    required this.loanLegalFees,
    required this.disbursementsEst,
    required this.totalLegalAndDuties,
  });
}
