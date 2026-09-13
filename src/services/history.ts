import { buildParcel, DEMO_LOCATION, DEMO_PARCEL_COORDINATES } from "./parcel";
import { compareWithAsking } from "./valuation";
import type { AnalysisRecord, LatLng } from "../types";

const STORAGE_KEY = "naksha-netra:history";
const MAX_RECORDS = 30;

function seed(id: string, daysAgo: number, coordinates: LatLng[], location: string, rate: number, asking: number): AnalysisRecord {
  const parcel = buildParcel(coordinates, location, id);
  const valuation = compareWithAsking({ ratePerSqFt: rate, estimatedValue: Math.round(parcel.areaSqFt) * rate }, asking);
  return {
    id,
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    parcel,
    valuation,
    source: "demo",
  };
}

/** Sample analyses so the history page is never empty during a demo. */
function sampleRecords(): AnalysisRecord[] {
  return [
    seed("NN-SAMPLE1", 1, DEMO_PARCEL_COORDINATES, DEMO_LOCATION, 2500, 7_000_000),
    seed("NN-SAMPLE2", 3, [
      { lat: 30.1085, lng: 78.2965 },
      { lat: 30.1085, lng: 78.2968 },
      { lat: 30.10878, lng: 78.2968 },
      { lat: 30.10878, lng: 78.2965 },
    ], "Tapovan, Rishikesh, Uttarakhand", 3000, 2_450_000),
    seed("NN-SAMPLE3", 6, [
      { lat: 29.9457, lng: 78.1642 },
      { lat: 29.9457, lng: 78.16448 },
      { lat: 29.94595, lng: 78.16452 },
      { lat: 29.94595, lng: 78.1642 },
    ], "Jwalapur, Haridwar, Uttarakhand", 2200, 1_850_000),
  ];
}

function read(): AnalysisRecord[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AnalysisRecord[]) : null;
  } catch {
    return null;
  }
}

function write(records: AnalysisRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    /* storage unavailable — history is a convenience */
  }
}

export function getHistory(): AnalysisRecord[] {
  return read() ?? sampleRecords();
}

export function getAnalysis(id: string): AnalysisRecord | undefined {
  return getHistory().find((r) => r.id === id);
}

export function saveAnalysis(record: AnalysisRecord): void {
  write([record, ...getHistory().filter((r) => r.id !== record.id)]);
}

export function clearHistory(): void {
  write([]);
}
