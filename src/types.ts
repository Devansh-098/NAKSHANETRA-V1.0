export type LatLng = {
  lat: number;
  lng: number;
};

export type Parcel = {
  id: string;
  coordinates: LatLng[];
  areaSqM: number;
  areaSqFt: number;
  areaAcres: number;
  location: string;
};

export type PriceComparison = "significantly_above" | "slightly_above" | "close" | "below";

export type Valuation = {
  ratePerSqFt: number;
  estimatedValue: number;
  askingPrice?: number;
  difference?: number;
  percentageDifference?: number;
  confidence?: number;
  comparison?: PriceComparison;
  assessment?: string;
  /** "locality" when a locality-specific rate matched, "city_default" otherwise. */
  rateBasis?: "locality" | "city_default";
};

/** Where a valuation rate came from — never present demo data as live data. */
export type ValuationSource = "live" | "demo";

export type ValuationResult = {
  valuation: Valuation;
  source: ValuationSource;
  /** Why the result is degraded (fallback rate, location lookup failed…), if it is. */
  notice?: string;
};

export type PriceVerdict = "above" | "within" | "below";

export type AnalysisRecord = {
  id: string;
  createdAt: string;
  parcel: Parcel;
  valuation: Valuation;
  source: ValuationSource;
};
