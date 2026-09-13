import type { LatLng } from "../types";

export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const REQUEST_TIMEOUT_MS = 10_000;

/** The backend answered with an error it considers the caller's to handle (e.g. invalid polygon, unknown city). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Network failure, timeout or a malformed response — the backend is effectively unavailable. */
export class ApiUnavailableError extends Error {}

// ---------- Response / request shapes (mirror backend/app/schemas.py) ----------

export type ParcelAnalysisResponse = {
  area_sq_m: number;
  area_sq_ft: number;
  area_acres: number;
  representative_point: LatLng;
};

export type ReverseGeocodeResponse = {
  formatted_address: string;
  locality: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
};

export type ValuationComparison = "significantly_above" | "slightly_above" | "close" | "below";

export type ValuationRequest = {
  area_sq_ft: number;
  locality?: string | null;
  city?: string | null;
  address?: string | null;
  asking_price?: number | null;
};

export type ValuationResponse = {
  locality: string | null;
  city: string;
  rate_basis: "locality" | "city_default";
  rate_per_sq_ft: number;
  estimated_value: number;
  asking_price: number | null;
  difference: number | null;
  percentage_difference: number | null;
  comparison: ValuationComparison | null;
  assessment: string | null;
  label: string;
  is_demo_data: boolean;
  disclaimer: string;
};

// ---------- Transport ----------

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiUnavailableError(controller.signal.aborted ? "Request timed out" : String(err));
  } finally {
    clearTimeout(timer);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiUnavailableError(`Unexpected response (HTTP ${res.status})`);
  }

  if (!res.ok) {
    const detail = (data as { detail?: unknown })?.detail;
    // 5xx without a readable message means the service itself is broken, not the request.
    if (typeof detail !== "string") throw new ApiUnavailableError(`HTTP ${res.status}`);
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

// ---------- Endpoints ----------

export function analyzeParcel(coordinates: LatLng[]): Promise<ParcelAnalysisResponse> {
  return post("/api/parcel/analyze", { coordinates });
}

export function reverseGeocode(point: LatLng): Promise<ReverseGeocodeResponse> {
  return post("/api/location/reverse-geocode", point);
}

export function calculateValuation(request: ValuationRequest): Promise<ValuationResponse> {
  return post("/api/valuation/calculate", request);
}
