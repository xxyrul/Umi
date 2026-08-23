export interface LoanCalculationResult {
  monthlyInstallment: number;
  loanAmount: number;
  downPaymentAmount: number;
  totalInterest: number;
  totalPayment: number;
  stampDuty: number;
  originalStampDuty: number;
  legalFees: number;
  valuationFee: number;
  totalUpfront: number;
  recommendedIncome: number;
}

/**
 * Calculates standard Malaysian housing loan monthly installment and entry fees.
 */
export function calculateMortgage(
  price: number,
  downPaymentPercent: number = 10,
  interestRateAnnual: number = 4.2,
  tenureYears: number = 30,
  isFirstHomeBuyer: boolean = false
): LoanCalculationResult {
  if (!price || price <= 0) {
    return {
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
    };
  }

  const downPaymentAmount = Math.round(price * (downPaymentPercent / 100));
  const loanAmount = Math.max(0, price - downPaymentAmount);

  // Standard Monthly Installment formula: M = L * [ i(1+i)^n ] / [ (1+i)^n - 1 ]
  const monthlyRate = interestRateAnnual / 100 / 12;
  const totalMonths = tenureYears * 12;

  let monthlyInstallment = 0;
  if (monthlyRate > 0 && totalMonths > 0) {
    monthlyInstallment = Math.round(
      (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
    );
  } else if (totalMonths > 0) {
    monthlyInstallment = Math.round(loanAmount / totalMonths);
  }

  const totalPayment = monthlyInstallment * totalMonths;
  const totalInterest = Math.max(0, totalPayment - loanAmount);

  // Malaysian Stamp Duty on SPA (Tiered: 1% first 100k, 2% up to 500k, 3% up to 1M, 4% above 1M)
  let standardStampDuty = 0;
  if (price > 1000000) {
    standardStampDuty = 100000 * 0.01 + 400000 * 0.02 + 500000 * 0.03 + (price - 1000000) * 0.04;
  } else if (price > 500000) {
    standardStampDuty = 100000 * 0.01 + 400000 * 0.02 + (price - 500000) * 0.03;
  } else if (price > 100000) {
    standardStampDuty = 100000 * 0.01 + (price - 100000) * 0.02;
  } else {
    standardStampDuty = price * 0.01;
  }
  standardStampDuty = Math.round(standardStampDuty);

  let stampDuty = standardStampDuty;
  if (isFirstHomeBuyer) {
    if (price <= 500000) {
      stampDuty = 0; // 100% exemption for first home <= RM 500k
    } else if (price <= 1000000) {
      stampDuty = Math.round(standardStampDuty * 0.25); // 75% remission for RM 500k - RM 1M
    }
  }

  // Scale of Legal Fees (Solicitors' Remuneration Order ~1.1% of property value, min RM2,500)
  const legalFees = Math.round(Math.max(2500, price * 0.011));

  // Bank Valuation Fee estimation
  const valuationFee = Math.round(Math.max(1000, price * 0.003));

  // Total Initial Cash Required = Downpayment + Stamp Duty + Legal Fees + Valuation
  const totalUpfront = downPaymentAmount + stampDuty + legalFees + valuationFee;

  // Recommended Min. Net Household Income (assume 60% DSR)
  const recommendedIncome = Math.round(monthlyInstallment / 0.60);

  return {
    monthlyInstallment,
    loanAmount,
    downPaymentAmount,
    totalInterest,
    totalPayment,
    stampDuty,
    originalStampDuty: standardStampDuty,
    legalFees,
    valuationFee,
    totalUpfront,
    recommendedIncome,
  };
}

/**
 * Extracts numerical square footage from text like "1,400 sqft", "20x70", "3000 sq ft"
 */
export function extractSquareFootage(sizeStr?: string): number | null {
  if (!sizeStr) return null;
  const clean = sizeStr.toLowerCase().trim();

  // If format is like "20x70" or "22 x 75"
  const dimMatch = clean.match(/(\d+)\s*[x×*]\s*(\d+)/);
  if (dimMatch && dimMatch[1] && dimMatch[2]) {
    const w = parseFloat(dimMatch[1]);
    const l = parseFloat(dimMatch[2]);
    if (w > 0 && l > 0 && w < 1000 && l < 1000) {
      return w * l;
    }
  }

  // Extract direct digits
  const numMatch = clean.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  if (numMatch && numMatch[1]) {
    const val = parseFloat(numMatch[1]);
    if (val >= 100 && val <= 500000) {
      return val;
    }
  }
  return null;
}

/**
 * Parses raw title (which might contain a full copy-pasted WhatsApp broadcast ad)
 * into a clean title headline and separated description.
 */
export function parseListingTitleAndDescription(
  rawTitle?: string,
  fallbackDesc?: string
): { cleanTitle: string; extractedDescription: string } {
  const raw = (rawTitle || "").trim();
  if (!raw) return { cleanTitle: "", extractedDescription: fallbackDesc || "" };

  const lines = raw.split("\n").map((l: string) => l.trim()).filter(Boolean);
  if (lines.length === 1) {
    return { cleanTitle: lines[0], extractedDescription: fallbackDesc || "" };
  }

  // Common noise tags in real estate broadcast ads
  const noiseRegex = /^(writing|wts|wtb|wtr|wts\/wtl|for sale|for rent|exclusive|hot listing|new listing|listing|coa listing|disewa|dijual|iklan)/i;

  let titleIndex = 0;
  // If line 0 is a noise tag or very short and line 1 exists, use line 1 as the headline
  if (lines.length > 1 && (noiseRegex.test(lines[0]) || (lines[0].length < 10 && lines[1].length >= 10))) {
    titleIndex = 1;
  }

  const cleanTitle = lines[titleIndex];
  const otherLines = lines.filter((_, idx) => idx !== titleIndex);
  const extractedDescription = [otherLines.join("\n\n"), fallbackDesc].filter(Boolean).join("\n\n");

  return { cleanTitle, extractedDescription };
}

export function cleanListingTitle(rawTitle?: string): string {
  return parseListingTitleAndDescription(rawTitle).cleanTitle;
}
