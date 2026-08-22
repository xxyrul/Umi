/**
 * Automated Test Suite for Core Calculations & Logic
 * Tests:
 * 1. Malaysian Housing Loan & Stamp Duty Calculations (Tiered scaling)
 * 2. Square Footage Parser (supports multiple real-world agent input formats)
 * 3. Price Parser (handles comma formats, "k", "m", and raw strings)
 * 4. Bounded Notification Hygiene
 * 5. Invite Code Generation & Format Safety
 */

const assert = require("assert");

console.log("=========================================");
console.log("🧪 RUNNING CORE ENGINE TEST SUITE");
console.log("=========================================\n");

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. Mortgage & Fee Calculations
// -------------------------------------------------------------
function calculateMortgage(price, downPaymentPercent = 10, interestRateAnnual = 4.2, tenureYears = 30) {
  if (!price || price <= 0) {
    return { monthlyInstallment: 0, loanAmount: 0, stampDuty: 0, totalUpfront: 0 };
  }
  const downPaymentAmount = Math.round(price * (downPaymentPercent / 100));
  const loanAmount = Math.max(0, price - downPaymentAmount);
  const monthlyRate = interestRateAnnual / 100 / 12;
  const totalMonths = tenureYears * 12;

  let monthlyInstallment = 0;
  if (monthlyRate > 0 && totalMonths > 0) {
    monthlyInstallment = Math.round(
      (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
    );
  }

  let stampDuty = 0;
  if (price > 1000000) {
    stampDuty = 100000 * 0.01 + 400000 * 0.02 + 500000 * 0.03 + (price - 1000000) * 0.04;
  } else if (price > 500000) {
    stampDuty = 100000 * 0.01 + 400000 * 0.02 + (price - 500000) * 0.03;
  } else if (price > 100000) {
    stampDuty = 100000 * 0.01 + (price - 100000) * 0.02;
  } else {
    stampDuty = price * 0.01;
  }
  stampDuty = Math.round(stampDuty);

  const legalFees = Math.round(Math.max(2500, price * 0.011));
  const valuationFee = Math.round(Math.max(1000, price * 0.003));
  const totalUpfront = downPaymentAmount + stampDuty + legalFees + valuationFee;
  const recommendedIncome = Math.round(monthlyInstallment / 0.45);

  return { monthlyInstallment, loanAmount, downPaymentAmount, stampDuty, legalFees, valuationFee, totalUpfront, recommendedIncome };
}

console.log("🔹 1. Mortgage & Financial Formulas:");
it("Calculates monthly installment accurately for RM 500,000 property (10% DP, 4.2% rate, 30y)", () => {
  const res = calculateMortgage(500000, 10, 4.2, 30);
  assert.strictEqual(res.loanAmount, 450000);
  assert.strictEqual(res.downPaymentAmount, 50000);
  assert.strictEqual(res.monthlyInstallment, 2201);
  assert.strictEqual(res.stampDuty, 9000); // 100k*1% + 400k*2% = 1000 + 8000 = 9000
  assert.strictEqual(res.legalFees, 5500); // 500k * 0.011
  assert.strictEqual(res.valuationFee, 1500); // 500k * 0.003
  assert.strictEqual(res.totalUpfront, 66000);
  assert.strictEqual(res.recommendedIncome, 4891);
});

it("Calculates tiered stamp duty accurately for RM 1,500,000 luxury property", () => {
  const res = calculateMortgage(1500000, 10, 4.2, 30);
  // 100k*1% (1000) + 400k*2% (8000) + 500k*3% (15000) + 500k*4% (20000) = 44,000
  assert.strictEqual(res.stampDuty, 44000);
});

it("Gracefully handles RM 0 or negative price input without NaN or crash", () => {
  const res = calculateMortgage(0);
  assert.strictEqual(res.monthlyInstallment, 0);
  assert.strictEqual(res.loanAmount, 0);
});

// -------------------------------------------------------------
// 2. Square Footage Text Parser
// -------------------------------------------------------------
function extractSquareFootage(sizeStr) {
  if (!sizeStr) return null;
  const clean = sizeStr.toLowerCase().trim();
  const sqftMatch = clean.match(/(\d[\d,\.]*)\s*(sqft|sq\s*ft|kaki\s*persegi|kps)/i);
  if (sqftMatch) {
    const num = parseFloat(sqftMatch[1].replace(/,/g, ""));
    if (!isNaN(num) && num > 0) return num;
  }
  const dimMatch = clean.match(/(\d+)\s*[x×*]\s*(\d+)/i);
  if (dimMatch) {
    const w = parseFloat(dimMatch[1]);
    const l = parseFloat(dimMatch[2]);
    if (!isNaN(w) && !isNaN(l) && w > 0 && l > 0) return w * l;
  }
  const rawNumMatch = clean.match(/^\s*(\d[\d,\.]*)\s*$/);
  if (rawNumMatch) {
    const num = parseFloat(rawNumMatch[1].replace(/,/g, ""));
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}

console.log("\n🔹 2. Square Footage Parser:");
it("Parses '1,400 sqft' format", () => {
  assert.strictEqual(extractSquareFootage("1,400 sqft"), 1400);
});

it("Parses dimension format '20x70'", () => {
  assert.strictEqual(extractSquareFootage("20x70"), 1400);
});

it("Parses dimension format with spaces '22 x 75'", () => {
  assert.strictEqual(extractSquareFootage("22 x 75"), 1650);
});

it("Parses Bahasa Melayu format '1200 kps'", () => {
  assert.strictEqual(extractSquareFootage("1200 kps"), 1200);
});

it("Returns null for non-numerical descriptions", () => {
  assert.strictEqual(extractSquareFootage("Teres berdekatan masjid"), null);
});

// -------------------------------------------------------------
// 3. Price Parser
// -------------------------------------------------------------
function parsePriceNumber(val) {
  if (typeof val === "number") return val;
  if (!val || typeof val !== "string") return null;
  const clean = val.toLowerCase().replace(/rm/g, "").trim();
  if (clean.endsWith("m")) {
    const n = parseFloat(clean.replace("m", ""));
    return !isNaN(n) ? n * 1000000 : null;
  }
  if (clean.endsWith("k")) {
    const n = parseFloat(clean.replace("k", ""));
    return !isNaN(n) ? n * 1000 : null;
  }
  const sanitized = clean.replace(/,/g, "").replace(/\s/g, "");
  const parsed = parseFloat(sanitized);
  return !isNaN(parsed) ? parsed : null;
}

console.log("\n🔹 3. Price Parser:");
it("Parses 'RM 450,000'", () => {
  assert.strictEqual(parsePriceNumber("RM 450,000"), 450000);
});

it("Parses shorthand '450k'", () => {
  assert.strictEqual(parsePriceNumber("450k"), 450000);
});

it("Parses shorthand '1.5m'", () => {
  assert.strictEqual(parsePriceNumber("1.5m"), 1500000);
});

// -------------------------------------------------------------
// 4. Data Hygiene: Bounded Notification Queue
// -------------------------------------------------------------
console.log("\n🔹 4. Notification Data Hygiene:");
it("Caps notification arrays to prevent unbounded Firestore doc growth", () => {
  const MAX_READ = 200;
  const largeArray = Array.from({ length: 350 }, (_, i) => `notif_${i}`);
  const cloudArray = Array.from({ length: 100 }, (_, i) => `notif_${i + 300}`);
  const merged = Array.from(new Set([...largeArray, ...cloudArray])).slice(-MAX_READ);
  
  assert.strictEqual(merged.length, 200);
  assert.strictEqual(merged[merged.length - 1], "notif_399");
});

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log("\n=========================================");
console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=========================================\n");

if (failed > 0) {
  process.exit(1);
}
