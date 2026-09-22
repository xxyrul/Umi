import 'package:flutter_test/flutter_test.dart';
import 'package:caseflow/features/calculator/loan_calculator.dart';

void main() {
  group('LoanCalculator Tests', () {
    test('Calculates RM 500,000 standard mortgage correctly', () {
      final result = LoanCalculator.calculateMortgage(
        price: 500000,
        downPaymentPercent: 10,
        interestRateAnnual: 4.2,
        tenureYears: 30,
        isFirstHomeBuyer: true,
      );

      expect(result.loanAmount, equals(450000));
      expect(result.downPaymentAmount, equals(50000));
      // First home buyer <= 500k gets 100% stamp duty exemption
      expect(result.stampDuty, equals(0));
      expect(result.monthlyInstallment, greaterThan(2000));
      expect(result.monthlyInstallment, lessThan(2500));
    });

    test('Calculates LPPSA eligibility correctly', () {
      final lppsa = LoanCalculator.calculateLPPSA(
        basicSalary: 4500,
        fixedAllowances: 1150,
        currentPayslipDeductions: 800,
        propertyPrice: 400000,
        borrowerAge: 32,
        scheme: 'skim1',
      );

      expect(lppsa.qualifyingIncome, equals(5650));
      // 60% of 5650 = 3390
      expect(lppsa.maxAllowableMonthlyDeduction, equals(3390));
      expect(lppsa.isEligible, isTrue);
      expect(lppsa.interestRate, equals(4.0));
      expect(lppsa.maxTenureYears, equals(35));
    });
  });
}
