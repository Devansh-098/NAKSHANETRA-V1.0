import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { APIProvider } from "@vis.gl/react-google-maps";
import { AlertCircle, CheckCircle2, MapPinOff, X } from "lucide-react";
import { ParcelMap, type DrawMode, type ParcelMapHandle } from "../components/ParcelMap";
import { ParcelPanel, type Phase } from "../components/ParcelPanel";
import { ReportModal } from "../components/ReportModal";
import { GOOGLE_MAPS_API_KEY, getLocationFromCoordinates } from "../services/maps";
import { buildParcel, DEMO_LOCATION, DEMO_PARCEL_COORDINATES, getCentroid, InvalidParcelError } from "../services/parcel";
import { DEFAULT_ASKING_PRICE, getDemoRate } from "../services/valuation";
import { ParcelRejectedError, runParcelAnalysis } from "../services/analysis";
import { getAnalysis, saveAnalysis } from "../services/history";
import type { LatLng, Parcel, ValuationResult } from "../types";

type Toast = { kind: "success" | "error"; text: string } | null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

export default function CheckPage() {
  const mapRef = useRef<ParcelMapHandle>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [locating, setLocating] = useState(false);
  const [mode, setMode] = useState<DrawMode>("idle");
  const [phase, setPhase] = useState<Phase>("input");
  const [askingPrice, setAskingPrice] = useState(DEFAULT_ASKING_PRICE);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString());
  const [reportOpen, setReportOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [mapError, setMapError] = useState<string | null>(
    GOOGLE_MAPS_API_KEY ? null : "Map could not load. Check your Google Maps API key.",
  );
  const lookupSeq = useRef(0);
  // Bumped whenever the parcel changes, so a slow calculation can't overwrite a newer shape.
  const calcSeq = useRef(0);
  const running = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Google calls this global when the key is invalid or the referrer isn't allowed.
  useEffect(() => {
    window.gm_authFailure = () => setMapError("Map could not load. Check your Google Maps API key.");
    return () => {
      delete window.gm_authFailure;
    };
  }, []);

  const applyShape = useCallback(async (coordinates: LatLng[], opts: { edited?: boolean; location?: string } = {}) => {
    let next: Parcel;
    try {
      next = buildParcel(coordinates, opts.location ?? "Locating…");
    } catch (err) {
      if (err instanceof InvalidParcelError) setToast({ kind: "error", text: err.message });
      return;
    }

    calcSeq.current++;
    setParcel((prev) => (opts.edited && prev ? { ...next, id: prev.id, location: prev.location } : next));
    setResult(null);
    setPhase("input");
    setToast({ kind: "success", text: opts.edited ? "Parcel boundary updated" : "Parcel boundary captured" });

    if (opts.location || opts.edited) return;

    const seq = ++lookupSeq.current;
    setLocating(true);
    const location = await getLocationFromCoordinates(getCentroid(coordinates));
    if (seq !== lookupSeq.current) return; // a newer shape replaced this one
    setParcel((prev) => (prev ? { ...prev, location } : prev));
    setLocating(false);
  }, []);

  const clearParcel = useCallback(() => {
    lookupSeq.current++;
    calcSeq.current++;
    setParcel(null);
    setLocating(false);
    setResult(null);
    setPhase("input");
  }, []);

  const useSample = () => {
    mapRef.current?.showParcel(DEMO_PARCEL_COORDINATES);
    setAskingPrice(DEFAULT_ASKING_PRICE);
    applyShape(DEMO_PARCEL_COORDINATES, { location: DEMO_LOCATION });
  };

  // Deep link from History: /check?analysis=ID
  const analysisId = searchParams.get("analysis");
  useEffect(() => {
    if (!analysisId) return;
    const record = getAnalysis(analysisId);
    if (record) {
      setParcel(record.parcel);
      setAskingPrice(record.valuation.askingPrice ?? DEFAULT_ASKING_PRICE);
      setResult({ valuation: record.valuation, source: record.source });
      setCreatedAt(record.createdAt);
      setPhase("result");
      // Map may not be mounted yet on first render; ParcelMap queues it until Terra Draw is ready.
      requestAnimationFrame(() => mapRef.current?.showParcel(record.parcel.coordinates));
    }
    setSearchParams({}, { replace: true });
  }, [analysisId, setSearchParams]);

  const calculate = async () => {
    if (!parcel || running.current) return; // ignore repeat clicks while running
    const seq = ++calcSeq.current;
    running.current = true;

    try {
      // Minimum duration keeps the step labels readable when the backend answers instantly.
      const [outcome] = await Promise.all([runParcelAnalysis(parcel, askingPrice, (step) => seq === calcSeq.current && setPhase(step)), wait(900)]);
      if (seq !== calcSeq.current) return;

      const now = new Date().toISOString();
      setParcel(outcome.parcel);
      setResult(outcome.result);
      setCreatedAt(now);
      setPhase("result");
      saveAnalysis({ id: outcome.parcel.id, createdAt: now, parcel: outcome.parcel, valuation: outcome.result.valuation, source: outcome.result.source });
    } catch (err) {
      if (seq !== calcSeq.current) return;
      setPhase("input");
      setToast({ kind: "error", text: err instanceof ParcelRejectedError ? err.message : "Something went wrong. Please try again." });
    } finally {
      running.current = false;
    }
  };

  const reset = () => {
    mapRef.current?.deleteParcel();
    clearParcel();
    setAskingPrice(DEFAULT_ASKING_PRICE);
  };

  const workspace = (
    <div className="workspace">
      <div className="workspace-map">
        {mapError ? (
          <div className="map-error" role="alert">
            <MapPinOff size={32} />
            <strong>{mapError}</strong>
            <span>
              Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to your <code>.env</code> file and restart the dev server. You can still try the
              sample parcel.
            </span>
            {!parcel && (
              <button type="button" className="btn btn-primary" onClick={useSample}>
                Use sample parcel
              </button>
            )}
          </div>
        ) : (
          <ParcelMap
            ref={mapRef}
            hasParcel={!!parcel}
            mode={mode}
            onModeChange={setMode}
            onShapeComplete={(coords, edited) => applyShape(coords, { edited })}
            onShapeCleared={clearParcel}
            onNotice={(text) => setToast({ kind: "error", text })}
          />
        )}

        {toast && (
          <div className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
            {toast.kind === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toast.text}</span>
            <button type="button" className="icon-btn ghost" aria-label="Dismiss" onClick={() => setToast(null)}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      <ParcelPanel
        parcel={parcel}
        locating={locating}
        mode={mode}
        phase={phase}
        previewRate={getDemoRate(parcel?.location ?? "")}
        askingPrice={askingPrice}
        result={result}
        onAskingPriceChange={setAskingPrice}
        onDraw={() => mapRef.current?.startDrawing()}
        onUseSample={useSample}
        onEdit={() => {
          setPhase("input");
          mapRef.current?.startEditing();
        }}
        onDelete={reset}
        onCalculate={calculate}
        onBackToInputs={() => setPhase("input")}
        onReport={() => setReportOpen(true)}
        onReset={reset}
      />

      {reportOpen && parcel && result && (
        <ReportModal parcel={parcel} result={result} createdAt={createdAt} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );

  if (!GOOGLE_MAPS_API_KEY) return workspace;

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      region="IN"
      onError={() => setMapError("Map could not load. Check your Google Maps API key.")}
    >
      {workspace}
    </APIProvider>
  );
}
