import 'dart:math';
import 'calculator_models.dart';

class CalculatorEngine {
  /// Commercial / Islamic Bank Mortgage Calculator
  /// Supports Subsale & New Launch, Developer Rebates, First Home MOT Exemption,
  /// and Capitalized MRTT & Fire Takaful.
  static MortgageResult calculateMortgage({
    required double propertyPrice,
    PropertyCategory category = PropertyCategory.subsale,
    double downPaymentPercent = 10.0,
    double interestRateAnnual = 4.2,
    int tenureYears = 30,
    bool isFirstHomeBuyer = false,
    int borrowerAge = 30,
    double developerDiscountPercent = 0.0,
    bool freeSpaLegal = false,
    bool freeSpaMot = false,
    bool freeLoanLegal = false,
    bool freeLoanStampDuty = false,
    bool includeMrtt = true,
    bool includeFireInsurance = true,
    bool financeMrtt = true,
  }) {
    if (propertyPrice <= 0) {
      return const MortgageResult(
        category: PropertyCategory.subsale,
        propertyPrice: 0,
        developerDiscountPercent: 0,
        developerDiscountAmount: 0,
        netPurchasePrice: 0,
        downPaymentPercent: 0,
        downPaymentAmount: 0,
        loanAmount: 0,
        effectiveLoanAmount: 0,
        monthlyInstallment: 0,
        monthlyInstallmentWithInsurance: 0,
        totalPayment: 0,
        totalInterest: 0,
        stampDuty: 0,
        originalStampDuty: 0,
        legalFees: 0,
        loanLegalFees: 0,
        loanStampDuty: 0,
        valuationFee: 0,
        isFirstHomeBuyer: false,
        freeSpaLegal: false,
        freeSpaMot: false,
        freeLoanLegal: false,
        freeLoanStampDuty: false,
        totalUpfront: 0,
        totalUpfrontWithInsurance: 0,
        recommendedIncome: 0,
        mrttEstimate: 0,
        fireInsuranceAnnual: 0,
        fireInsuranceMonthly: 0,
        isInsuranceFinanced: false,
        includeMrtt: false,
        includeFireInsurance: false,
      );
    }

    // Developer Rebate / Discount calculation (New Launch)
    final double discountAmount = category == PropertyCategory.newLaunch && developerDiscountPercent > 0
        ? propertyPrice * (developerDiscountPercent / 100)
        : 0.0;
    final double netPurchasePrice = max(0.0, propertyPrice - discountAmount);

    final double downPaymentAmount = propertyPrice * (downPaymentPercent / 100);
    final double baseLoanAmount = max(0.0, propertyPrice - downPaymentAmount);

    final double monthlyRate = interestRateAnnual / 100 / 12;
    final int totalMonths = max(1, tenureYears * 12);

    double monthlyInstallment = 0;
    if (monthlyRate > 0 && totalMonths > 0) {
      monthlyInstallment = baseLoanAmount *
          (monthlyRate * pow(1 + monthlyRate, totalMonths)) /
          (pow(1 + monthlyRate, totalMonths) - 1);
    } else if (totalMonths > 0) {
      monthlyInstallment = baseLoanAmount / totalMonths;
    }

    final double totalPayment = monthlyInstallment * totalMonths;
    final double totalInterest = max(0.0, totalPayment - baseLoanAmount);

    // Malaysian Tiered Stamp Duty on SPA (MOT):
    // 1% first RM100k, 2% up to RM500k, 3% up to RM1mil, 4% above RM1mil
    double standardSpaStampDuty = 0;
    if (propertyPrice > 1000000) {
      standardSpaStampDuty = (100000 * 0.01) +
          (400000 * 0.02) +
          (500000 * 0.03) +
          ((propertyPrice - 1000000) * 0.04);
    } else if (propertyPrice > 500000) {
      standardSpaStampDuty = (100000 * 0.01) +
          (400000 * 0.02) +
          ((propertyPrice - 500000) * 0.03);
    } else if (propertyPrice > 100000) {
      standardSpaStampDuty = (100000 * 0.01) + ((propertyPrice - 100000) * 0.02);
    } else {
      standardSpaStampDuty = propertyPrice * 0.01;
    }

    // First-Time Home Buyer exemption on MOT:
    // 100% exemption for property <= RM500k; 75% remission for RM500,001 - RM1,000,000
    double calculatedSpaStampDuty = standardSpaStampDuty;
    if (isFirstHomeBuyer) {
      if (propertyPrice <= 500000) {
        calculatedSpaStampDuty = 0;
      } else if (propertyPrice <= 1000000) {
        calculatedSpaStampDuty = standardSpaStampDuty * 0.25;
      }
    }
    final double effectiveSpaStampDuty = freeSpaMot ? 0.0 : calculatedSpaStampDuty;

    // SRO 2023 Scale of Legal Fees for SPA (Solicitors' Remuneration Order)
    final double standardSpaLegal = calculateSroLegalFees(propertyPrice);
    final double effectiveSpaLegal = freeSpaLegal ? 0.0 : standardSpaLegal;

    // Loan Agreement Legal Fees & Stamp Duty (0.5% flat on loan)
    final double standardLoanLegal = calculateSroLegalFees(baseLoanAmount);
    final double effectiveLoanLegal = freeLoanLegal ? 0.0 : standardLoanLegal;
    final double standardLoanStampDuty = baseLoanAmount * 0.005;
    final double effectiveLoanStampDuty = freeLoanStampDuty ? 0.0 : standardLoanStampDuty;

    // Bank Valuation Fee estimation (Subsale standard)
    final double valuationFee = category == PropertyCategory.newLaunch ? 0.0 : max(1000.0, propertyPrice * 0.003);

    // Initial Cash Required Upfront
    final double effectiveDownpayment = category == PropertyCategory.newLaunch
        ? max(0.0, downPaymentAmount - discountAmount)
        : downPaymentAmount;

    final double totalUpfront = effectiveDownpayment +
        effectiveSpaStampDuty +
        effectiveSpaLegal +
        effectiveLoanStampDuty +
        effectiveLoanLegal +
        valuationFee;

    // Recommended Minimum Net Income (60% DSR standard)
    final double recommendedIncome = monthlyInstallment > 0 ? (monthlyInstallment / 0.60) : 0;

    // MRTT / MLTT Insurance Estimation
    final int clampedAge = min(65, max(20, borrowerAge));
    final double ageFactor = 0.012 + max(0, clampedAge - 25) * 0.0009;
    final double tenureFactor = max(0.5, tenureYears / 30.0);
    final double mrttRate = ageFactor * tenureFactor;
    final double mrttEstimate = includeMrtt && baseLoanAmount > 0 ? (baseLoanAmount * mrttRate) : 0;

    // Fire Insurance (Houseowner takaful: ~0.115% of property value per annum)
    final double fireInsuranceAnnual = includeFireInsurance && propertyPrice > 0 ? (propertyPrice * 0.00115) : 0;
    final double fireInsuranceMonthly = fireInsuranceAnnual / 12;

    final bool isInsuranceFinanced = includeMrtt && financeMrtt;
    final double effectiveLoanAmount = isInsuranceFinanced ? baseLoanAmount + mrttEstimate : baseLoanAmount;

    double monthlyInstallmentWithInsurance = monthlyInstallment;
    if (isInsuranceFinanced && monthlyRate > 0 && totalMonths > 0) {
      monthlyInstallmentWithInsurance = effectiveLoanAmount *
          (monthlyRate * pow(1 + monthlyRate, totalMonths)) /
          (pow(1 + monthlyRate, totalMonths) - 1);
    }

    final double totalUpfrontWithInsurance = isInsuranceFinanced
        ? totalUpfront + fireInsuranceAnnual
        : totalUpfront + mrttEstimate + fireInsuranceAnnual;

    return MortgageResult(
      category: category,
      propertyPrice: propertyPrice,
      developerDiscountPercent: developerDiscountPercent,
      developerDiscountAmount: discountAmount,
      netPurchasePrice: netPurchasePrice,
      downPaymentPercent: downPaymentPercent,
      downPaymentAmount: effectiveDownpayment,
      loanAmount: baseLoanAmount,
      effectiveLoanAmount: effectiveLoanAmount,
      monthlyInstallment: monthlyInstallment,
      monthlyInstallmentWithInsurance: monthlyInstallmentWithInsurance,
      totalPayment: totalPayment,
      totalInterest: totalInterest,
      stampDuty: effectiveSpaStampDuty,
      originalStampDuty: standardSpaStampDuty,
      legalFees: effectiveSpaLegal,
      loanLegalFees: effectiveLoanLegal,
      loanStampDuty: effectiveLoanStampDuty,
      valuationFee: valuationFee,
      isFirstHomeBuyer: isFirstHomeBuyer,
      freeSpaLegal: freeSpaLegal,
      freeSpaMot: freeSpaMot,
      freeLoanLegal: freeLoanLegal,
      freeLoanStampDuty: freeLoanStampDuty,
      totalUpfront: totalUpfront,
      totalUpfrontWithInsurance: totalUpfrontWithInsurance,
      recommendedIncome: recommendedIncome,
      mrttEstimate: mrttEstimate,
      fireInsuranceAnnual: fireInsuranceAnnual,
      fireInsuranceMonthly: fireInsuranceMonthly,
      isInsuranceFinanced: isInsuranceFinanced,
      includeMrtt: includeMrtt,
      includeFireInsurance: includeFireInsurance,
    );
  }

  /// Calculates Debt Service Ratio (DSR) & Maximum Property Affordability
  static DsrResult calculateDsr({
    required double netIncome,
    double dsrLimitPercent = 70.0,
    double carLoan = 0,
    double housingLoan = 0,
    double creditCard = 0,
    double personalLoan = 0,
    double ptptnOther = 0,
    double interestRate = 4.2,
    int tenureYears = 30,
  }) {
    final double totalCommitments = carLoan + housingLoan + creditCard + personalLoan + ptptnOther;

    if (netIncome <= 0) {
      return const DsrResult(
        netIncome: 0,
        totalExistingCommitments: 0,
        dsrLimitPercent: 70,
        currentDsrPercent: 0,
        maxTotalAllowableCommitment: 0,
        maxAllowableHousingInstallment: 0,
        maxEligiblePropertyPrice: 0,
        maxEligibleLoanAmount: 0,
        status: DsrStatus.eligible,
        statusLabel: 'Tiada Data',
      );
    }

    final double currentDsrPercent = (totalCommitments / netIncome) * 100;
    final double maxTotalAllowableCommitment = netIncome * (dsrLimitPercent / 100);
    final double maxAllowableHousingInstallment = max(0.0, maxTotalAllowableCommitment - totalCommitments);

    // Derive max eligible loan amount from max allowable housing installment
    final double monthlyRate = interestRate / 100 / 12;
    final int totalMonths = max(1, tenureYears * 12);

    double maxEligibleLoanAmount = 0;
    if (monthlyRate > 0 && totalMonths > 0 && maxAllowableHousingInstallment > 0) {
      maxEligibleLoanAmount = maxAllowableHousingInstallment *
          (pow(1 + monthlyRate, totalMonths) - 1) /
          (monthlyRate * pow(1 + monthlyRate, totalMonths));
    }

    // Assuming 90% loan margin (10% downpayment)
    final double maxEligiblePropertyPrice = maxEligibleLoanAmount > 0 ? (maxEligibleLoanAmount / 0.90) : 0;

    DsrStatus status;
    String statusLabel;
    if (currentDsrPercent <= 60.0) {
      status = DsrStatus.eligible;
      statusLabel = 'Sangat Layak (Sihat)';
    } else if (currentDsrPercent <= dsrLimitPercent) {
      status = DsrStatus.moderate;
      statusLabel = 'Sederhana (Dalam Had)';
    } else {
      status = DsrStatus.exceeded;
      statusLabel = 'Melebihi Had DSR';
    }

    return DsrResult(
      netIncome: netIncome,
      totalExistingCommitments: totalCommitments,
      dsrLimitPercent: dsrLimitPercent,
      currentDsrPercent: currentDsrPercent,
      maxTotalAllowableCommitment: maxTotalAllowableCommitment,
      maxAllowableHousingInstallment: maxAllowableHousingInstallment,
      maxEligiblePropertyPrice: maxEligiblePropertyPrice,
      maxEligibleLoanAmount: maxEligibleLoanAmount,
      status: status,
      statusLabel: statusLabel,
    );
  }

  /// Calculates Legal Fees & Stamp Duty breakdown (SRO 2023 Scale)
  static LegalFeesResult calculateLegalFees({
    required double propertyPrice,
    double loanAmount = 0,
    bool isFirstHomeBuyer = false,
  }) {
    final effectiveLoan = loanAmount > 0 ? loanAmount : (propertyPrice * 0.90);

    // Tiered MOT Stamp Duty
    double standardSpaStampDuty = 0;
    if (propertyPrice > 1000000) {
      standardSpaStampDuty = (100000 * 0.01) +
          (400000 * 0.02) +
          (500000 * 0.03) +
          ((propertyPrice - 1000000) * 0.04);
    } else if (propertyPrice > 500000) {
      standardSpaStampDuty = (100000 * 0.01) +
          (400000 * 0.02) +
          ((propertyPrice - 500000) * 0.03);
    } else if (propertyPrice > 100000) {
      standardSpaStampDuty = (100000 * 0.01) + ((propertyPrice - 100000) * 0.02);
    } else {
      standardSpaStampDuty = propertyPrice * 0.01;
    }

    double effectiveSpaStampDuty = standardSpaStampDuty;
    if (isFirstHomeBuyer) {
      if (propertyPrice <= 500000) {
        effectiveSpaStampDuty = 0;
      } else if (propertyPrice <= 1000000) {
        effectiveSpaStampDuty = standardSpaStampDuty * 0.25;
      }
    }

    final double spaLegal = calculateSroLegalFees(propertyPrice);
    final double loanStampDuty = effectiveLoan * 0.005;
    final double loanLegal = calculateSroLegalFees(effectiveLoan);
    final double disbursementsEst = 1800.0; // Standard searches, registration, bankruptcy & stamping

    final double total = effectiveSpaStampDuty + spaLegal + loanStampDuty + loanLegal + disbursementsEst;

    return LegalFeesResult(
      propertyPrice: propertyPrice,
      loanAmount: effectiveLoan,
      isFirstHomeBuyer: isFirstHomeBuyer,
      spaStampDuty: effectiveSpaStampDuty,
      originalSpaStampDuty: standardSpaStampDuty,
      spaLegalFees: spaLegal,
      loanStampDuty: loanStampDuty,
      loanLegalFees: loanLegal,
      disbursementsEst: disbursementsEst,
      totalLegalAndDuties: total,
    );
  }

  /// SRO 2023 Legal Fees Scale:
  /// First RM 500,000 : 1.25% (min RM 500)
  /// Next RM 7,000,000 : 1.00%
  /// Excess over RM 7,500,000 : Negotiable (capped at 1%)
  static double calculateSroLegalFees(double amount) {
    if (amount <= 0) return 0;
    if (amount <= 500000) {
      return max(500.0, amount * 0.0125);
    } else if (amount <= 7500000) {
      return (500000 * 0.0125) + ((amount - 500000) * 0.01);
    } else {
      return (500000 * 0.0125) + (7000000 * 0.01) + ((amount - 7500000) * 0.01);
    }
  }

  /// Helper to calculate raw monthly installment
  static double calculateMonthlyInstallment({
    required double loanAmount,
    required double interestRate,
    required int tenureYears,
  }) {
    if (loanAmount <= 0 || tenureYears <= 0) return 0;
    final double monthlyRate = interestRate / 100 / 12;
    final int totalMonths = tenureYears * 12;
    if (monthlyRate <= 0) return loanAmount / totalMonths;
    return loanAmount *
        (monthlyRate * pow(1 + monthlyRate, totalMonths)) /
        (pow(1 + monthlyRate, totalMonths) - 1);
  }
}
