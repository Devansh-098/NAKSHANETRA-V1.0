import { useId } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  MapPin,
  Pencil,
  PenLine,
  RotateCcw,
  Ruler,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { DrawMode } from "./ParcelMap";
import type { Parcel, ValuationResult } from "../types";
import { formatAcres, formatINR, formatLakh, formatNumber, parseCurrency } from "../utils/format";
import { getVerdict } from "../services/valuation";

export type Phase = "input" | "analyzing" | "detecting" | "valuing" | "result";

const PHASE_LABELS: Partial<Record<Phase, string>> = {
  analyzing: "Analyzing parcel…",
  detecting: "Detecting location…",
  valuing: "Calculating indicative value…",
};

type Props = {
  parcel: Parcel | null;
  locating: boolean;
  mode: DrawMode;
  phase: Phase;
  previewRate: number;
  askingPrice: number;
  result: ValuationResult | null;
  onAskingPriceChange: (value: number) => void;
  onDraw: () => void;
  onUseSample: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCalculate: () => void;
  onBackToInputs: () => void;
  onReport: () => void;
  onReset: () => void;
};

const STEPS = ["Draw", "Measure", "Value", "Report"];

export function ParcelPanel(props: Props) {
  const { parcel, phase, mode } = props;
  const step = !parcel ? (mode === "drawing" ? 0 : -1) : phase === "result" ? 3 : 2;

  return (
    <aside className="panel" aria-label="Parcel analysis">
      <ol className="stepper" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? "done" : i === step ? "current" : ""} aria-current={i === step ? "step" : undefined}>
            <span className="stepper-dot">{i < step ? <CheckCircle2 size={14} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="panel-body">
        {!parcel && <EmptyState {...props} />}
        {parcel && phase !== "result" && <InputState {...props} parcel={parcel} />}
        {parcel && phase === "result" && props.result && <ResultState {...props} parcel={parcel} result={props.result} />}
      </div>

      <p className="disclaimer">
        <Info size={14} aria-hidden />
        Indicative estimate only. Not an official or legal property valuation. Verify cadastral records and official valuation before purchase.
      </p>
    </aside>
  );
}

function EmptyState({ mode, onDraw, onUseSample }: Props) {
  return (
    <div className="panel-section fade-in">
      <h1 className="panel-title">Check Parcel Value</h1>
      <p className="panel-sub">
        {mode === "drawing"
          ? "Click on the map to place each corner of the land boundary. Click the first point again to close it."
          : "Draw a parcel on the map to begin your analysis."}
      </p>

      <button type="button" className="btn btn-primary btn-block btn-lg" onClick={onDraw} disabled={mode === "drawing"}>
        <PenLine size={18} /> {mode === "drawing" ? "Drawing on map…" : "Draw Parcel"}
      </button>
      <button type="button" className="btn btn-link btn-block" onClick={onUseSample}>
        <Sparkles size={16} /> Use sample parcel
      </button>

      <ul className="howto">
        <li>
          <span className="howto-num">1</span>
          <div>
            <strong>Find the land</strong>
            <span>Search a place or pan the satellite map.</span>
          </div>
        </li>
        <li>
          <span className="howto-num">2</span>
          <div>
            <strong>Mark the boundary</strong>
            <span>Click each corner, then close the shape.</span>
          </div>
        </li>
        <li>
          <span className="howto-num">3</span>
          <div>
            <strong>Get the insight</strong>
            <span>Area, local rate and an indicative value.</span>
          </div>
        </li>
      </ul>
    </div>
  );
}

function InputState({
  parcel,
  locating,
  mode,
  phase,
  previewRate,
  askingPrice,
  onAskingPriceChange,
  onCalculate,
  onEdit,
  onDelete,
}: Props & { parcel: Parcel }) {
  const priceId = useId();
  const busy = phase in PHASE_LABELS;

  return (
    <div className="panel-section fade-in">
      <div className="captured-badge" role="status">
        <CheckCircle2 size={16} /> Parcel boundary captured
      </div>
      <div className="panel-title-row">
        <h1 className="panel-title">Parcel captured</h1>
        <div className="panel-actions">
          <button type="button" className="icon-btn" onClick={onEdit} aria-label="Edit boundary" title="Edit boundary" disabled={busy}>
            <Pencil size={16} />
          </button>
          <button type="button" className="icon-btn" onClick={onDelete} aria-label="Delete parcel" title="Delete parcel" disabled={busy}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <dl className="data-card">
        <div className="data-row">
          <dt>
            <MapPin size={15} /> Location
          </dt>
          <dd>{locating ? <span className="skeleton">Locating…</span> : parcel.location}</dd>
        </div>
      </dl>

      <div className="area-card">
        <span className="label">
          <Ruler size={15} /> Area
        </span>
        <strong className="area-main">
          {formatNumber(parcel.areaSqFt)} <small>sq.ft</small>
        </strong>
        <div className="area-sub">
          <span>{formatNumber(parcel.areaSqM, 2)} sq.m</span>
          <span>{formatAcres(parcel.areaAcres)} acres</span>
        </div>
        {mode === "editing" && <span className="live-tag">Updates after each adjustment</span>}
      </div>

      <div className="rate-card">
        <div>
          <span className="label">Local valuation rate</span>
          <strong>
            {formatINR(previewRate)} <small>/ sq.ft</small>
          </strong>
          <span className="muted small">Indicative local rate</span>
        </div>
        <span className="tag tag-neutral">Demo rate • Replace with verified regional data</span>
      </div>

      <div className="field">
        <label htmlFor={priceId}>Seller asking price</label>
        <div className="input-prefix">
          <span aria-hidden>₹</span>
          <input
            id={priceId}
            inputMode="numeric"
            value={askingPrice ? formatNumber(askingPrice) : ""}
            onChange={(e) => onAskingPriceChange(parseCurrency(e.target.value))}
            placeholder="70,00,000"
            disabled={busy}
          />
        </div>
        <span className="field-hint">{askingPrice ? formatLakh(askingPrice) : "Optional — compare against the estimate"}</span>
      </div>

      <button type="button" className="btn btn-primary btn-block btn-lg" onClick={onCalculate} disabled={busy || locating || mode !== "idle"}>
        {busy ? (
          <>
            <Loader2 size={18} className="spin" /> {PHASE_LABELS[phase]}
          </>
        ) : (
          <>
            Calculate Indicative Value <ArrowRight size={18} />
          </>
        )}
      </button>
      {mode === "editing" && <p className="field-hint center">Finish editing the boundary to calculate.</p>}
    </div>
  );
}

function ResultState({
  parcel,
  result,
  onReport,
  onReset,
  onBackToInputs,
}: Props & { parcel: Parcel; result: ValuationResult }) {
  const { valuation, source } = result;
  const verdict = getVerdict(valuation);
  const pct = Math.abs(valuation.percentageDifference ?? 0);
  const notice = result.notice ?? (source === "demo" ? "Live valuation service unavailable. Showing demo indicative rate." : null);
  const rateLabel =
    source === "demo" ? "Demo indicative rate" : valuation.rateBasis === "city_default" ? "City indicative rate" : "Local indicative rate";

  return (
    <div className="panel-section fade-in">
      <div className="panel-title-row">
        <span className="eyebrow">Property insight</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onBackToInputs}>
          <ArrowLeft size={14} /> Edit inputs
        </button>
      </div>

      <div className="hero-value">
        <span className="label">Indicative Land Value</span>
        <strong>{formatLakh(valuation.estimatedValue)}</strong>
        <span className="muted small">{formatINR(valuation.estimatedValue)}</span>
      </div>

      {notice && (
        <p className="notice notice-info">
          <Info size={15} /> {notice}
        </p>
      )}

      <dl className="data-card">
        <div className="data-row">
          <dt>Parcel area</dt>
          <dd>{formatNumber(parcel.areaSqFt)} sq.ft</dd>
        </div>
        <div className="data-row">
          <dt>Location</dt>
          <dd>{parcel.location}</dd>
        </div>
        <div className="data-row">
          <dt>{rateLabel}</dt>
          <dd>{formatINR(valuation.ratePerSqFt)}/sq.ft</dd>
        </div>
        {valuation.askingPrice !== undefined && (
          <div className="data-row">
            <dt>Seller asking price</dt>
            <dd>{formatLakh(valuation.askingPrice)}</dd>
          </div>
        )}
        {valuation.confidence !== undefined && (
          <div className="data-row">
            <dt>Model confidence</dt>
            <dd>{Math.round(valuation.confidence * 100)}%</dd>
          </div>
        )}
      </dl>

      {verdict && valuation.difference !== undefined && (
        <div className={`verdict verdict-${verdict}`} role="status">
          <div className="verdict-head">
            {verdict === "above" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <strong>
              {valuation.assessment ?? (
                <>
                  {verdict === "above" && "Asking price is above the indicative estimate"}
                  {verdict === "within" && "Asking price is within the indicative range"}
                  {verdict === "below" && "Asking price is below the indicative estimate"}
                </>
              )}
            </strong>
          </div>
          <div className="verdict-body">
            <div>
              <span className="label">Difference</span>
              <strong>{formatLakh(Math.abs(valuation.difference))}</strong>
            </div>
            <div className="verdict-pct">
              {pct.toFixed(1)}% {valuation.difference >= 0 ? "above" : "below"} indicative value
            </div>
          </div>
          <PriceBar estimate={valuation.estimatedValue} asking={valuation.askingPrice!} />
        </div>
      )}

      <button type="button" className="btn btn-primary btn-block btn-lg" onClick={onReport}>
        <FileText size={18} /> Generate Property Report
      </button>
      <button type="button" className="btn btn-secondary btn-block" onClick={onReset}>
        <RotateCcw size={16} /> Check another parcel
      </button>
    </div>
  );
}

/** Two bars on a shared scale — makes the gap obvious at a glance. */
function PriceBar({ estimate, asking }: { estimate: number; asking: number }) {
  const max = Math.max(estimate, asking) || 1;
  return (
    <div className="price-bars" aria-hidden>
      <div className="price-bar">
        <span>Estimate</span>
        <div className="bar-track">
          <div className="bar-fill bar-estimate" style={{ width: `${(estimate / max) * 100}%` }} />
        </div>
      </div>
      <div className="price-bar">
        <span>Asking</span>
        <div className="bar-track">
          <div className="bar-fill bar-asking" style={{ width: `${(asking / max) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
