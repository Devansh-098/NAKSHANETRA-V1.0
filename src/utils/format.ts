const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const dec2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** ₹61,25,000 */
export function formatINR(value: number): string {
  return `₹${inr.format(Math.round(value))}`;
}

/** ₹61.25 Lakh / ₹1.20 Crore */
export function formatLakh(value: number, short = false): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${dec2.format(value / 1e7)} ${short ? "Cr" : "Crore"}`;
  if (abs >= 1e5) return `₹${dec2.format(value / 1e5)} ${short ? "L" : "Lakh"}`;
  return formatINR(value);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatAcres(value: number): string {
  return value < 1 ? value.toFixed(3) : value.toFixed(2);
}

/** Parse "70,00,000" or "₹ 70 00 000" into 7000000. */
export function parseCurrency(input: string): number {
  const digits = input.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
