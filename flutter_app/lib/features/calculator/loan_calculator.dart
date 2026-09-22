import 'dart:math';

class LoanCalculationResult {
  final int monthlyInstallment;
  final int loanAmount;
  final int downPaymentAmount;
  final int totalInterest;
  final int totalPayment;
  final int stampDuty;
  final int originalStampDuty;
  final int legalFees;
  final int valuationFee;
  final int totalUpfront;
  final int recommendedIncome;
  final int mrttEstimate;
  final int fireInsuranceAnnual;
  final int fireInsuranceMonthly;
  final bool isInsuranceFinanced;
  final int effectiveLoanAmount;
  final int monthlyInstallmentWithInsurance;
  final int totalUpfrontWithInsurance;

  LoanCalculationResult({
    required this.monthlyInstallment,
    required this.loanAmount,
    required this.downPaymentAmount,
    required this.totalInterest,
    required this.totalPayment,
    required this.stampDuty,
    required this.originalStampDuty,
    required this.legalFees,
    required this.valuationFee,
    required this.totalUpfront,
    required this.recommendedIncome,
    required this.mrttEstimate,
    required this.fireInsuranceAnnual,
    required this.fireInsuranceMonthly,
    required this.isInsuranceFinanced,
    required this.effectiveLoanAmount,
    required this.monthlyInstallmentWithInsurance,
    required this.totalUpfrontWithInsurance,
  });
}

class LoanCalculator {
  static LoanCalculationResult calculateMortgage({
    required int price,
    double downPaymentPercent = 10,
    double interestRateAnnual = 4.2,
    int tenureYears = 30,
    bool isFirstHomeBuyer = false,
    int borrowerAge = 30,
    bool includeInsurance = true,
    bool financeMrtt = true,
  }) {
    if (price <= 0) {
      return LoanCalculationResult(
        monthlyInstallment: 0,
        loanAmount: 0,
        downPaymentAmount: 0,
        totalInterest: 0,
        totalPayment: 0,
        stampDuty: 0,
        originalStampDuty: 0,
        legalFees: 0,
        valuationFee: 0,
        totalUpfront: 0,
        recommendedIncome: 0,
        mrttEstimate: 0,
        fireInsuranceAnnual: 0,
        fireInsuranceMonthly: 0,
        isInsuranceFinanced: financeMrtt,
        effectiveLoanAmount: 0,
        monthlyInstallmentWithInsurance: 0,
        totalUpfrontWithInsurance: 0,
      );
    }

    final downPaymentAmount = (price * (downPaymentPercent / 100)).round();
    final loanAmount = max(0, price - downPaymentAmount);

    final monthlyRate = interestRateAnnual / 100 / 12;
    final totalMonths = tenureYears * 12;

    int monthlyInstallment = 0;
    if (monthlyRate > 0 && totalMonths > 0) {
      monthlyInstallment = (loanAmount * (monthlyRate * pow(1 + monthlyRate, totalMonths)) /
              (pow(1 + monthlyRate, totalMonths) - 1))
          .round();
    } else if (totalMonths > 0) {
      monthlyInstallment = (loanAmount / totalMonths).round();
    }

    final totalPayment = monthlyInstallment * totalMonths;
    final totalInterest = max(0, totalPayment - loanAmount);

    // Malaysian Stamp Duty on SPA (Tiered: 1% first 100k, 2% up to 500k, 3% up to 1M, 4% above 1M)
    double standardStampDuty = 0;
    if (price > 1000000) {
      standardStampDuty = 100000 * 0.01 + 400000 * 0.02 + 500000 * 0.03 + (price - 1000000) * 0.04;
    } else if (price > 500000) {
      standardStampDuty = 100000 * 0.01 + 400000 * 0.02 + (price - 500000) * 0.03;
    } else if (price > 100000) {
      standardStampDuty = 100000 * 0.01 + (price - 100000) * 0.02;
    } else {
      standardStampDuty = price * 0.01;
    }
    final originalStampDuty = standardStampDuty.round();

    int stampDuty = originalStampDuty;
    if (isFirstHomeBuyer) {
      if (price <= 500000) {
        stampDuty = 0; // 100% exemption for first home <= RM 500k
      } else if (price <= 1000000) {
        stampDuty = (standardStampDuty * 0.25).round(); // 75% remission for RM 500k - RM 1M
      }
    }

    // Scale of Legal Fees (Solicitors' Remuneration Order ~1.1% of property value, min RM2,500)
    final legalFees = max(2500, (price * 0.011).round());

    // Bank Valuation Fee estimation
    final valuationFee = max(1000, (price * 0.003).round());

    // Base Total Initial Cash Required = Downpayment + Stamp Duty + Legal Fees + Valuation
    final totalUpfront = downPaymentAmount + stampDuty + legalFees + valuationFee;

    // Recommended Min. Net Household Income (assume 60% DSR)
    final recommendedIncome = (monthlyInstallment / 0.60).round();

    // MRTT / MRTA Estimation
    final clampedAge = min(65, max(20, borrowerAge));
    final ageFactor = 0.012 + max(0, clampedAge - 25) * 0.0009;
    final tenureFactor = max(0.5, tenureYears / 30.0);
    final mrttRate = ageFactor * tenureFactor;
    final mrttEstimate = includeInsurance && loanAmount > 0 ? (loanAmount * mrttRate).round() : 0;

    // Fire Insurance
    final fireInsuranceAnnual = includeInsurance && price > 0 ? (price * 0.00115).round() : 0;
    final fireInsuranceMonthly = (fireInsuranceAnnual / 12).round();

    final isInsuranceFinanced = includeInsurance && financeMrtt;
    final effectiveLoanAmount = isInsuranceFinanced ? loanAmount + mrttEstimate : loanAmount;

    int monthlyInstallmentWithInsurance = monthlyInstallment;
    if (isInsuranceFinanced && monthlyRate > 0 && totalMonths > 0) {
      monthlyInstallmentWithInsurance = (effectiveLoanAmount * (monthlyRate * pow(1 + monthlyRate, totalMonths)) /
              (pow(1 + monthlyRate, totalMonths) - 1))
          .round();
    }

    final totalUpfrontWithInsurance = isInsuranceFinanced
        ? totalUpfront + fireInsuranceAnnual
        : totalUpfront + mrttEstimate + fireInsuranceAnnual;

    return LoanCalculationResult(
      monthlyInstallment: monthlyInstallment,
      loanAmount: loanAmount,
      downPaymentAmount: downPaymentAmount,
      totalInterest: totalInterest,
      totalPayment: totalPayment,
      stampDuty: stampDuty,
      originalStampDuty: originalStampDuty,
      legalFees: legalFees,
      valuationFee: valuationFee,
      totalUpfront: totalUpfront,
      recommendedIncome: recommendedIncome,
      mrttEstimate: mrttEstimate,
      fireInsuranceAnnual: fireInsuranceAnnual,
      fireInsuranceMonthly: fireInsuranceMonthly,
      isInsuranceFinanced: isInsuranceFinanced,
      effectiveLoanAmount: effectiveLoanAmount,
      monthlyInstallmentWithInsurance: monthlyInstallmentWithInsurance,
      totalUpfrontWithInsurance: totalUpfrontWithInsurance,
    );
  }

  /// Simple monthly installment calculation without full breakdown
  static int calculateMonthlyInstallment({
    required int loanAmount,
    required double interestRate,
    required int tenureYears,
  }) {
    if (loanAmount <= 0 || tenureYears <= 0) return 0;
    final monthlyRate = interestRate / 100 / 12;
    final totalMonths = tenureYears * 12;
    if (monthlyRate <= 0) return (loanAmount / totalMonths).round();
    return (loanAmount *
            (monthlyRate * pow(1 + monthlyRate, totalMonths)) /
            (pow(1 + monthlyRate, totalMonths) - 1))
        .round();
  }

  static LPPSACalculationResult calculateLPPSA({
    required int basicSalary,
    int fixedAllowances = 0,
    int currentPayslipDeductions = 0,
    int propertyPrice = 0,
    int borrowerAge = 30,
    String scheme = 'skim1',
  }) {
    final qualifyingIncome = max(0, basicSalary + fixedAllowances);
    const interestRate = 4.0;
    const monthlyRate = interestRate / 100 / 12;

    final ageCap = max(0, 70 - borrowerAge);
    final schemeCap = scheme == 'skim1' ? 35 : 30;
    final maxTenureYears = min(schemeCap, max(5, ageCap));
    final totalMonths = maxTenureYears * 12;

    final maxDeductionRate = scheme == 'skim1' ? 0.6 : 0.5;
    final maxMonthlyFromQualifying = qualifyingIncome * maxDeductionRate;
    final max75Ceiling = (qualifyingIncome * 0.75) - currentPayslipDeductions;
    final maxAllowableMonthlyDeduction = max(
      0,
      min(maxMonthlyFromQualifying, max75Ceiling).round(),
    );

    int monthlyInstallment = 0;
    if (propertyPrice > 0 && totalMonths > 0) {
      monthlyInstallment = (propertyPrice * (monthlyRate * pow(1 + monthlyRate, totalMonths)) /
              (pow(1 + monthlyRate, totalMonths) - 1))
          .round();
    }

    int maxEligibleLoanAmount = 0;
    if (maxAllowableMonthlyDeduction > 0 && totalMonths > 0) {
      maxEligibleLoanAmount = (maxAllowableMonthlyDeduction * (1 - pow(1 + monthlyRate, -totalMonths)) / monthlyRate).round();
    }

    final surplusDeficitMonthly = maxAllowableMonthlyDeduction - monthlyInstallment;
    final isEligible = propertyPrice > 0 ? monthlyInstallment <= maxAllowableMonthlyDeduction : maxEligibleLoanAmount > 0;
    final netTakeHomeAfterLoan = max(0, qualifyingIncome - currentPayslipDeductions - monthlyInstallment);

    String? rejectionReason;
    if (!isEligible && propertyPrice > 0) {
      if (monthlyInstallment > maxMonthlyFromQualifying) {
        rejectionReason = 'Ansuran bulanan (RM $monthlyInstallment) melebihi had ${(maxDeductionRate * 100).toInt()}% gaji kelayakan (RM ${maxMonthlyFromQualifying.round()}).';
      } else if (monthlyInstallment > max75Ceiling) {
        rejectionReason = 'Potongan slip gaji sedia ada (RM $currentPayslipDeductions) terlalu tinggi dan melanggar had siling 75% slip gaji.';
      }
    }

    return LPPSACalculationResult(
      qualifyingIncome: qualifyingIncome,
      maxAllowableMonthlyDeduction: maxAllowableMonthlyDeduction,
      monthlyInstallment: monthlyInstallment,
      maxEligibleLoanAmount: maxEligibleLoanAmount,
      maxTenureYears: maxTenureYears,
      interestRate: interestRate,
      isEligible: isEligible,
      surplusDeficitMonthly: surplusDeficitMonthly,
      netTakeHomeAfterLoan: netTakeHomeAfterLoan,
      rejectionReason: rejectionReason,
    );
  }
}

class LPPSACalculationResult {
  final int qualifyingIncome;
  final int maxAllowableMonthlyDeduction;
  final int monthlyInstallment;
  final int maxEligibleLoanAmount;
  final int maxTenureYears;
  final double interestRate;
  final bool isEligible;
  final int surplusDeficitMonthly;
  final int netTakeHomeAfterLoan;
  final String? rejectionReason;

  LPPSACalculationResult({
    required this.qualifyingIncome,
    required this.maxAllowableMonthlyDeduction,
    required this.monthlyInstallment,
    required this.maxEligibleLoanAmount,
    required this.maxTenureYears,
    required this.interestRate,
    required this.isEligible,
    required this.surplusDeficitMonthly,
    required this.netTakeHomeAfterLoan,
    this.rejectionReason,
  });
}
