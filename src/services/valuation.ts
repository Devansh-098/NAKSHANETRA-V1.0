import type { PriceComparison, PriceVerdict, Valuation } from "../types";

/** Demo indicative rates (₹/sq.ft). Offline fallback only — the backend is the source of truth. */
const DEMO_RATES: { match: string; rate: number }[] = [
  { match: "mussoorie", rate: 4200 },
  { match: "rishikesh", rate: 3000 },
  { match: "dehradun", rate: 2500 },
  { match: "haridwar", rate: 2200 },
  { match: "haldwani", rate: 1900 },
  { match: "roorkee", rate: 1800 },
];
const DEFAULT_DEMO_RATE = 1500;

/** Same thresholds as backend/app/services/valuation.py so fallback results read identically. */
const SIGNIFICANT_PCT = 10;

export const ASSESSMENTS: Record<PriceComparison, string> = {
  significantly_above: "Asking price appears significantly above the indicative value.",
  slightly_above: "Asking price is slightly above the indicative value.",
  close: "Asking price is close to the indicative value.",
  below: "Asking price appears below the indicative value.",
};

export const DEFAULT_ASKING_PRICE = 7_000_000;

export function getDemoRate(location: string): number {
  const lower = location.toLowerCase();
  return DEMO_RATES.find((r) => lower.includes(r.match))?.rate ?? DEFAULT_DEMO_RATE;
}

export function classifyDifference(pct: number): PriceComparison {
  if (pct > SIGNIFICANT_PCT) return "significantly_above";
  if (pct > 0) return "slightly_above";
  if (pct >= -SIGNIFICANT_PCT) return "close";
  return "below";
}

export function compareWithAsking(base: Valuation, askingPrice: number): Valuation {
  if (!askingPrice || !base.estimatedValue) return { ...base, askingPrice: askingPrice || undefined };
  const difference = askingPrice - base.estimatedValue;
  const percentageDifference = (difference / base.estimatedValue) * 100;
  const comparison = classifyDifference(percentageDifference);
  return {
    ...base,
    askingPrice,
    difference,
    percentageDifference,
    comparison,
    assessment: ASSESSMENTS[comparison],
  };
}

export function getVerdict(valuation: Valuation): PriceVerdict | null {
  const pct = valuation.percentageDifference;
  if (pct === undefined) return null;
  switch (valuation.comparison ?? classifyDifference(pct)) {
    case "significantly_above":
    case "slightly_above":
      return "above";
    case "close":
      return "within";
    case "below":
      return "below";
  }
}
