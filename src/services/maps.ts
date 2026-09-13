import type { LatLng } from "../types";

export const GOOGLE_MAPS_API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
export const GOOGLE_MAP_ID: string = import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID";

export const DEHRADUN_CENTER: LatLng = { lat: 30.3165, lng: 78.0322 };
export const DEFAULT_ZOOM = 13;

const LOOKUP_TIMEOUT_MS = 3000;

function mapsAvailable(): boolean {
  return typeof window !== "undefined" && !!window.google?.maps?.Geocoder;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function isNearDehradun({ lat, lng }: LatLng): boolean {
  return lat > 30.1 && lat < 30.55 && lng > 77.8 && lng < 78.3;
}

function coordinateLabel({ lat, lng }: LatLng): string {
  return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
}

function pick(components: google.maps.GeocoderAddressComponent[], type: string): string | undefined {
  return components.find((c) => c.types.includes(type))?.long_name;
}

/**
 * Resolve a human-readable locality for a coordinate.
 * Uses the Google Geocoder today; swap the body for a backend locality service later
 * without touching the UI.
 */
export async function getLocationFromCoordinates(point: LatLng): Promise<string> {
  const fallback = isNearDehradun(point) ? "Dehradun, Uttarakhand" : coordinateLabel(point);
  if (!mapsAvailable()) return fallback;

  try {
    const geocoder = new google.maps.Geocoder();
    const { results } = await withTimeout(geocoder.geocode({ location: point }), LOOKUP_TIMEOUT_MS);
    if (!results.length) return fallback;

    const components = results.flatMap((r) => r.address_components);
    const parts = [
      pick(components, "sublocality_level_1") ?? pick(components, "neighborhood"),
      pick(components, "locality") ?? pick(components, "administrative_area_level_3"),
      pick(components, "administrative_area_level_1"),
    ].filter((p, i, arr): p is string => !!p && arr.indexOf(p) === i);

    return parts.length ? parts.join(", ") : results[0].formatted_address;
  } catch {
    return fallback;
  }
}

export type SearchResult = {
  label: string;
  location: LatLng;
  viewport?: google.maps.LatLngBounds;
};

/** Forward geocode a free-text query. Returns null when nothing is found or the service is unavailable. */
export async function searchLocation(query: string): Promise<SearchResult | null> {
  if (!mapsAvailable() || !query.trim()) return null;
  try {
    const geocoder = new google.maps.Geocoder();
    const { results } = await withTimeout(
      geocoder.geocode({ address: query, region: "in", componentRestrictions: { country: "IN" } }),
      LOOKUP_TIMEOUT_MS,
    );
    const top = results[0];
    if (!top) return null;
    return {
      label: top.formatted_address,
      location: top.geometry.location.toJSON(),
      viewport: top.geometry.viewport,
    };
  } catch {
    return null;
  }
}

export function boundsFromCoordinates(coordinates: LatLng[]): google.maps.LatLngBounds {
  const bounds = new google.maps.LatLngBounds();
  coordinates.forEach((c) => bounds.extend(c));
  return bounds;
}
