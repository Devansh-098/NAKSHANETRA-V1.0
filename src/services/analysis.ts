import { analyzeParcel, ApiError, calculateValuation, reverseGeocode, type ReverseGeocodeResponse } from "./api";
import { compareWithAsking, getDemoRate } from "./valuation";
import type { LatLng, Parcel, ValuationResult } from "../types";

export type AnalysisStep = "analyzing" | "detecting" | "valuing";

export type AnalysisOutcome = {
  parcel: Parcel;
  result: ValuationResult;
};

/** The backend rejected the parcel itself (e.g. self-intersecting). The user must fix the boundary. */
export class ParcelRejectedError extends Error {}

const SERVICE_UNAVAILABLE = "Live valuation service unavailable. Showing demo indicative rate.";

function placeLabel(place: ReverseGeocodeResponse): string {
  const parts = [place.locality, place.city, place.state].filter((p, i, arr): p is string => !!p && arr.indexOf(p) === i);
  return parts.length ? parts.join(", ") : place.formatted_address;
}

function demoResult(parcel: Parcel, askingPrice: number, notice: string): AnalysisOutcome {
  const ratePerSqFt = getDemoRate(parcel.location);
  const valuation = compareWithAsking({ ratePerSqFt, estimatedValue: Math.round(parcel.areaSqFt) * ratePerSqFt }, askingPrice);
  return { parcel, result: { valuation, source: "demo", notice } };
}

/**
 * Parcel → FastAPI area → reverse geocode → indicative valuation.
 *
 * Degrades instead of failing: if the backend is down the client-side area and demo rates are used,
 * and if only the location lookup fails the valuation still runs on the location already shown.
 * Throws ParcelRejectedError only when the boundary itself is invalid.
 */
export async function runParcelAnalysis(
  parcel: Parcel,
  askingPrice: number,
  onStep: (step: AnalysisStep) => void,
): Promise<AnalysisOutcome> {
  // 1. Authoritative area from the backend (projected GIS calculation).
  onStep("analyzing");
  let measured: Parcel;
  let point: LatLng;
  try {
    const area = await analyzeParcel(parcel.coordinates);
    measured = { ...parcel, areaSqM: area.area_sq_m, areaSqFt: area.area_sq_ft, areaAcres: area.area_acres };
    point = area.representative_point;
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) throw new ParcelRejectedError(err.message);
    return demoResult(parcel, askingPrice, SERVICE_UNAVAILABLE);
  }

  // 2. Locality for the rate lookup. Non-fatal.
  onStep("detecting");
  let place: ReverseGeocodeResponse | null = null;
  let locationNotice: string | undefined;
  try {
    place = await reverseGeocode(point);
    measured = { ...measured, location: placeLabel(place) };
  } catch (err) {
    locationNotice = `${err instanceof ApiError ? err.message : "Location lookup unavailable."} Using the map location instead.`;
  }

  // 3. Indicative value.
  onStep("valuing");
  try {
    const v = await calculateValuation({
      area_sq_ft: Math.round(measured.areaSqFt),
      locality: place?.locality,
      city: place?.city,
      // Extra matching hints: Google's full address plus the label already shown for this parcel.
      address: [place?.formatted_address, parcel.location].filter(Boolean).join(" | ") || null,
      asking_price: askingPrice || null,
    });

    if (v.rate_basis === "locality" && v.locality) measured = { ...measured, location: `${v.locality}, ${v.city}` };

    return {
      parcel: measured,
      result: {
        source: "live",
        notice: locationNotice,
        valuation: {
          ratePerSqFt: v.rate_per_sq_ft,
          estimatedValue: v.estimated_value,
          askingPrice: v.asking_price ?? undefined,
          difference: v.difference ?? undefined,
          percentageDifference: v.percentage_difference ?? undefined,
          comparison: v.comparison ?? undefined,
          assessment: v.assessment ?? undefined,
          rateBasis: v.rate_basis,
        },
      },
    };
  } catch (err) {
    const notice = err instanceof ApiError && err.status === 404 ? `${err.message} Showing demo indicative rate.` : SERVICE_UNAVAILABLE;
    return demoResult(measured, askingPrice, notice);
  }
}
