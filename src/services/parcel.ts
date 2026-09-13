import area from "@turf/area";
import type { LatLng, Parcel } from "../types";

const SQFT_PER_SQM = 10.7639;
const SQM_PER_ACRE = 4046.8564224;

export class InvalidParcelError extends Error {
  constructor() {
    super("Please draw a closed parcel boundary.");
  }
}

/** Convert a GeoJSON polygon ring ([lng, lat][]) into lat/lng objects without the closing point. */
export function ringToLatLngs(ring: number[][]): LatLng[] {
  const points = ring.map(([lng, lat]) => ({ lat, lng }));
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 1 && first.lat === last.lat && first.lng === last.lng) points.pop();
  return points;
}

/** Closed GeoJSON ring from lat/lng objects. */
export function latLngsToRing(coordinates: LatLng[]): number[][] {
  const ring = coordinates.map(({ lat, lng }) => [lng, lat]);
  if (ring.length) ring.push([...ring[0]]);
  return ring;
}

export function calculateArea(coordinates: LatLng[]) {
  const areaSqM = area({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [latLngsToRing(coordinates)] },
  });
  return {
    areaSqM,
    areaSqFt: areaSqM * SQFT_PER_SQM,
    areaAcres: areaSqM / SQM_PER_ACRE,
  };
}

export function validateCoordinates(coordinates: LatLng[]): void {
  const unique = new Set(coordinates.map((c) => `${c.lat.toFixed(8)},${c.lng.toFixed(8)}`));
  if (unique.size < 3) throw new InvalidParcelError();
  if (calculateArea(coordinates).areaSqM < 1) throw new InvalidParcelError();
}

/** Area-weighted representative point is overkill here — the vertex average is fine for parcel-sized shapes. */
export function getCentroid(coordinates: LatLng[]): LatLng {
  const sum = coordinates.reduce((acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / coordinates.length, lng: sum.lng / coordinates.length };
}

export function createParcelId(): string {
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `NN-${stamp}${rand}`;
}

export function buildParcel(coordinates: LatLng[], location: string, id = createParcelId()): Parcel {
  validateCoordinates(coordinates);
  return { id, coordinates, location, ...calculateArea(coordinates) };
}

/**
 * Demo parcel near Rajpur Road, Dehradun (2,450 sq.ft by the backend's ellipsoidal area; Turf's spherical preview reads ~0.1% higher).
 * A slightly skewed quadrilateral so it reads as a real plot rather than a perfect square.
 */
export const DEMO_PARCEL_COORDINATES: LatLng[] = [
  { lat: 30.3406, lng: 78.06 },
  { lat: 30.3406, lng: 78.0601353 },
  { lat: 30.3407578, lng: 78.0601613 },
  { lat: 30.3407578, lng: 78.060026 },
];

export const DEMO_LOCATION = "Rajpur Road, Dehradun, Uttarakhand";
