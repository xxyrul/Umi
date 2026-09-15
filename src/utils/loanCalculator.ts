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
  // Insurance additions
  mrttEstimate: number;
  fireInsuranceAnnual: number;
  fireInsuranceMonthly: number;
  isInsuranceFinanced: boolean;
  effectiveLoanAmount: number;
  monthlyInstallmentWithInsurance: number;
  totalUpfrontWithInsurance: number;
}

/**
 * Calculates standard Malaysian housing loan monthly installment, entry fees, and insurance (MRTT/Fire).
 */
export function calculateMortgage(
  price: number,
  downPaymentPercent: number = 10,
  interestRateAnnual: number = 4.2,
  tenureYears: number = 30,
  isFirstHomeBuyer: boolean = false,
  borrowerAge: number = 30,
  includeInsurance: boolean = true,
  financeMrtt: boolean = true
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
      mrttEstimate: 0,
      fireInsuranceAnnual: 0,
      fireInsuranceMonthly: 0,
      isInsuranceFinanced: financeMrtt,
      effectiveLoanAmount: 0,
      monthlyInstallmentWithInsurance: 0,
      totalUpfrontWithInsurance: 0,
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

  // Base Total Initial Cash Required = Downpayment + Stamp Duty + Legal Fees + Valuation
  const totalUpfront = downPaymentAmount + stampDuty + legalFees + valuationFee;

  // Recommended Min. Net Household Income (assume 60% DSR)
  const recommendedIncome = Math.round(monthlyInstallment / 0.60);

  // --- INSURANCE CALCULATIONS ---
  // MRTT / MRTA Estimation:
  // Base rate scaled by borrower age and loan tenure (approx 1.2% to 3.2% of loan amount)
  const clampedAge = Math.min(65, Math.max(20, borrowerAge));
  const ageFactor = 0.012 + Math.max(0, clampedAge - 25) * 0.0009;
  const tenureFactor = Math.max(0.5, tenureYears / 30);
  const mrttRate = ageFactor * tenureFactor;
  const mrttEstimate = includeInsurance && loanAmount > 0 ? Math.round(loanAmount * mrttRate) : 0;

  // Houseowner / Fire Insurance (Tarif standard BNM ~0.115% per annum of property value)
  const fireInsuranceAnnual = includeInsurance && price > 0 ? Math.round(price * 0.00115) : 0;
  const fireInsuranceMonthly = Math.round(fireInsuranceAnnual / 12);

  // Effective loan amount if MRTT is financed into mortgage
  const isInsuranceFinanced = includeInsurance && financeMrtt;
  const effectiveLoanAmount = isInsuranceFinanced ? loanAmount + mrttEstimate : loanAmount;

  let monthlyInstallmentWithInsurance = monthlyInstallment;
  if (isInsuranceFinanced && monthlyRate > 0 && totalMonths > 0) {
    monthlyInstallmentWithInsurance = Math.round(
      (effectiveLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
    );
  }

  // Total Upfront Cash with insurance considerations
  // If MRTT is financed: upfront only includes cash downpayment, stamp duty, legal, valuation (+ optional 1st yr fire ins)
  // If MRTT is paid cash upfront: includes mrttEstimate + 1st yr fire ins
  const totalUpfrontWithInsurance = isInsuranceFinanced
    ? totalUpfront + fireInsuranceAnnual
    : totalUpfront + mrttEstimate + fireInsuranceAnnual;

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
    mrttEstimate,
    fireInsuranceAnnual,
    fireInsuranceMonthly,
    isInsuranceFinanced,
    effectiveLoanAmount,
    monthlyInstallmentWithInsurance,
    totalUpfrontWithInsurance,
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

// ---------------------------------------------------------------------------
// MALAYSIAN REAL ESTATE LPPSA (GOVERNMENT LOAN) ENGINE
// ---------------------------------------------------------------------------

export interface LPPSACalculationInput {
  basicSalary: number; // Gaji Pokok
  fixedAllowances: number; // Imbuhan Tetap (ITP, ITK, BIW/COLA)
  currentPayslipDeductions: number; // Potongan sedia ada dalam slip gaji
  propertyPrice: number; // Harga hartanah dimohon
  borrowerAge?: number; // Umur pemohon (max umur tamat 70 thn)
  scheme?: "skim1" | "skim2"; // Skim 1 (Pinjaman Pertama) vs Skim 2 (Pinjaman Kedua)
}

export interface LPPSACalculationResult {
  qualifyingIncome: number; // Gaji Pokok + Imbuhan Tetap
  maxAllowableMonthlyDeduction: number; // Had 60% (Skim 1) atau 50% (Skim 2)
  monthlyInstallment: number; // Ansuran bulanan untuk harga hartanah dimohon
  maxEligibleLoanAmount: number; // Jumlah pinjaman maksimum layak
  maxTenureYears: number; // Tempoh maksimum pinjaman (tahun)
  interestRate: number; // Fixed 4.0%
  isEligible: boolean; // Layak / Melebihi had
  surplusDeficitMonthly: number; // Baki lebihan / kekurangan kelayakan sebulan
  netTakeHomeAfterLoan: number; // Anggaran gaji bersih dibawa pulang selepas potongan LPPSA
  rejectionReason?: string; // Sebab tidak layak jika ada
}

/**
 * Calculates government housing financing eligibility under LPPSA (Lembaga Pembiayaan Perumahan Sektor Awam)
 * - Fixed 4.0% per annum
 * - Skim 1: Max 60% deduction of qualifying salary, tenure up to 35 years or age 70.
 * - Skim 2: Max 50% deduction of qualifying salary, tenure up to 30 years or age 70.
 * - Max total slip deductions cannot exceed 75% of gross income.
 */
export function calculateLPPSA(input: LPPSACalculationInput): LPPSACalculationResult {
  const {
    basicSalary,
    fixedAllowances = 0,
    currentPayslipDeductions = 0,
    propertyPrice = 0,
    borrowerAge = 30,
    scheme = "skim1",
  } = input;

  const qualifyingIncome = Math.max(0, basicSalary + fixedAllowances);
  const interestRate = 4.0; // Fixed LPPSA rate
  const monthlyRate = interestRate / 100 / 12;

  // Max tenure: up to age 70 or scheme cap (35 yrs for skim 1, 30 yrs for skim 2)
  const ageCap = Math.max(0, 70 - borrowerAge);
  const schemeCap = scheme === "skim1" ? 35 : 30;
  const maxTenureYears = Math.min(schemeCap, Math.max(5, ageCap));
  const totalMonths = maxTenureYears * 12;

  // Max allowable monthly installment based on scheme rules
  // Skim 1: 60% of qualifying income
  // Skim 2: 50% of qualifying income
  const maxDeductionRate = scheme === "skim1" ? 0.6 : 0.5;
  const maxMonthlyFromQualifying = qualifyingIncome * maxDeductionRate;

  // 75% total deduction ceiling constraint
  const max75Ceiling = qualifyingIncome * 0.75 - currentPayslipDeductions;
  const maxAllowableMonthlyDeduction = Math.max(
    0,
    Math.round(Math.min(maxMonthlyFromQualifying, max75Ceiling))
  );

  // Calculate monthly installment for requested property price (100% financing under LPPSA)
  let monthlyInstallment = 0;
  if (propertyPrice > 0 && totalMonths > 0) {
    monthlyInstallment = Math.round(
      (propertyPrice * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
    );
  }

  // Calculate maximum loan capacity based on max allowable monthly deduction
  // PV = PMT * [1 - (1+i)^-n] / i
  let maxEligibleLoanAmount = 0;
  if (maxAllowableMonthlyDeduction > 0 && totalMonths > 0) {
    maxEligibleLoanAmount = Math.round(
      (maxAllowableMonthlyDeduction * (1 - Math.pow(1 + monthlyRate, -totalMonths))) /
        monthlyRate
    );
  }

  const surplusDeficitMonthly = maxAllowableMonthlyDeduction - monthlyInstallment;
  const isEligible = propertyPrice > 0 ? monthlyInstallment <= maxAllowableMonthlyDeduction : maxEligibleLoanAmount > 0;
  const netTakeHomeAfterLoan = Math.max(
    0,
    Math.round(qualifyingIncome - currentPayslipDeductions - monthlyInstallment)
  );

  let rejectionReason: string | undefined;
  if (!isEligible && propertyPrice > 0) {
    if (monthlyInstallment > maxMonthlyFromQualifying) {
      rejectionReason = `Ansuran bulanan (RM ${monthlyInstallment.toLocaleString()}) melebihi had ${maxDeductionRate * 100}% gaji kelayakan (RM ${Math.round(maxMonthlyFromQualifying).toLocaleString()}).`;
    } else if (monthlyInstallment > max75Ceiling) {
      rejectionReason = `Potongan slip gaji sedia ada (RM ${currentPayslipDeductions.toLocaleString()}) terlalu tinggi dan melanggar had siling 75% slip gaji.`;
    }
  }

  return {
    qualifyingIncome,
    maxAllowableMonthlyDeduction,
    monthlyInstallment,
    maxEligibleLoanAmount,
    maxTenureYears,
    interestRate,
    isEligible,
    surplusDeficitMonthly,
    netTakeHomeAfterLoan,
    rejectionReason,
  };
}

// ---------------------------------------------------------------------------
// CO-BROKE & AGENT SHARING TEMPLATE GENERATOR
// ---------------------------------------------------------------------------

export interface CoBrokeShareInput {
  title: string;
  price: number;
  propertyType?: string;
  tenure?: string;
  lotType?: string;
  size?: string;
  bedrooms?: number;
  bathrooms?: number;
  location?: string;
  description?: string;
  agentName?: string;
  agentPhone?: string;
  agencyName?: string;
  renNumber?: string;
  coBrokeRatio?: string; // e.g., "50/50" or "Co-Broke Welcome"
  listingUrl?: string;
  language?: "BM" | "EN";
}

/**
 * Generates a professionally structured, agency-standard Co-Broke broadcast message
 * with property highlights and co-broke split details for fellow REN agents.
 */
export function generateCoBrokeShareText(input: CoBrokeShareInput): string {
  const {
    title,
    price,
    propertyType = "Hartanah",
    tenure = "Freehold",
    lotType = "Bumi/Non-Bumi",
    size = "N/A",
    bedrooms = 0,
    bathrooms = 0,
    location = "Malaysia",
    description = "",
    agentName = "REN Agent",
    agentPhone = "",
    agencyName = "Artha Realty",
    renNumber = "REN",
    coBrokeRatio = "50/50 Co-Broke Dialu-alukan (Welcome)",
    listingUrl = "",
    language = "BM",
  } = input;

  const isBM = language === "BM";
  const formattedPrice = `RM ${price.toLocaleString()}`;

  if (isBM) {
    return (
      `🤝 *[CO-BROKE LISTING] ${title.toUpperCase()}*\n\n` +
      `💰 *Harga Jualan:* ${formattedPrice} (Boleh Runding/Nego)\n` +
      `📍 *Lokasi:* ${location}\n` +
      `🏠 *Jenis:* ${propertyType} | ${tenure} (${lotType})\n` +
      `📐 *Keluasan:* ${size}\n` +
      `🛏 *Bilik:* ${bedrooms} Bilik Tidur | 🚿 ${bathrooms} Bilik Air\n\n` +
      (description ? `📋 *Keterangan Unit:*\n${description.trim()}\n\n` : "") +
      `---------------------------------\n` +
      `💼 *Syarat Co-Broke:*\n` +
      `• Nisbah Komisen: *${coBrokeRatio}*\n` +
      `• Status: *Direct Listing / Kunci Sedia Ada*\n` +
      `• Viewing: *Sila maklumkan 1 hari lebih awal*\n` +
      `---------------------------------\n` +
      (listingUrl ? `🔗 *Pautan Info & Foto:* ${listingUrl}\n\n` : "") +
      `📲 *Hubungi Listing Agent (Direct):*\n` +
      `👤 *${agentName}* (${renNumber})\n` +
      `🏢 *${agencyName}*\n` +
      `📞 WhatsApp: wa.me/${agentPhone.replace(/[^0-9]/g, "")}`
    );
  }

  return (
    `🤝 *[CO-BROKE LISTING] ${title.toUpperCase()}*\n\n` +
    `💰 *Asking Price:* ${formattedPrice} (Negotiable)\n` +
    `📍 *Location:* ${location}\n` +
    `🏠 *Type:* ${propertyType} | ${tenure} (${lotType})\n` +
    `📐 *Built-up / Land:* ${size}\n` +
    `🛏 *Layout:* ${bedrooms} Beds | 🚿 ${bathrooms} Baths\n\n` +
    (description ? `📋 *Unit Highlights:*\n${description.trim()}\n\n` : "") +
    `---------------------------------\n` +
    `💼 *Co-Broke Terms:*\n` +
    `• Commission Split: *${coBrokeRatio}*\n` +
    `• Listing Status: *Direct Listing / Keys on Hand*\n` +
    `• Viewing: *Please RSVP 1 day in advance*\n` +
    `---------------------------------\n` +
    (listingUrl ? `🔗 *Full Details & Photos:* ${listingUrl}\n\n` : "") +
    `📲 *Contact Listing Agent (Direct):*\n` +
    `👤 *${agentName}* (${renNumber})\n` +
    `🏢 *${agencyName}*\n` +
    `📞 WhatsApp: wa.me/${agentPhone.replace(/[^0-9]/g, "")}`
  );
}
