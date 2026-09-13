import { useEffect, useRef } from "react";
import { Download, X } from "lucide-react";
import type { Parcel, ValuationResult } from "../types";
import { formatAcres, formatDate, formatINR, formatLakh, formatNumber } from "../utils/format";
import { getVerdict } from "../services/valuation";

type Props = {
  parcel: Parcel;
  result: ValuationResult;
  createdAt: string;
  onClose: () => void;
};

/** Mini outline of the parcel so the report carries the geometry, not just numbers. */
function ParcelOutline({ parcel }: { parcel: Parcel }) {
  const pts = parcel.coordinates;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  // Correct for longitude compression so the shape isn't stretched.
  const lngScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const w = (maxLng - minLng) * lngScale || 1e-9;
  const h = maxLat - minLat || 1e-9;
  const size = 120;
  const pad = 12;
  const scale = (size - pad * 2) / Math.max(w, h);
  const ox = (size - w * scale) / 2;
  const oy = (size - h * scale) / 2;
  const d = pts
    .map((p, i) => `${i ? "L" : "M"}${(ox + (p.lng - minLng) * lngScale * scale).toFixed(1)},${(oy + (maxLat - p.lat) * scale).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="report-outline" role="img" aria-label="Parcel boundary outline">
      <defs>
        <pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0H0V12" fill="none" stroke="#DDE8E1" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={size} height={size} fill="url(#grid)" />
      <path d={`${d} Z`} fill="#34A853" fillOpacity="0.22" stroke="#176B45" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function ReportModal({ parcel, result, createdAt, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { valuation, source } = result;
  const verdict = getVerdict(valuation);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);

  const statusText = valuation.assessment
    ? `${valuation.assessment} (${Math.abs(valuation.percentageDifference ?? 0).toFixed(1)}% ${(valuation.difference ?? 0) >= 0 ? "above" : "below"})`
    : verdict === "above"
      ? `Asking price ${valuation.percentageDifference!.toFixed(1)}% above indicative estimate`
      : verdict === "below"
        ? `Asking price ${Math.abs(valuation.percentageDifference!).toFixed(1)}% below indicative estimate`
        : verdict === "within"
          ? "Asking price within indicative range"
          : "No asking price provided";

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div className="modal-bar no-print">
          <span className="muted small">Report preview</span>
          <div className="modal-bar-actions">
            {/* Browser print → "Save as PDF". Swap for a PDF library later without touching the layout. */}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
              <Download size={16} /> Download Report
            </button>
            <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close report">
              <X size={18} />
            </button>
          </div>
        </div>

        <article className="report" id="property-report">
          <header className="report-head">
            <img src="/naksha-netra-logo.jpeg" alt="NAKSHA NETRA" className="report-logo" />
            <div className="report-head-text">
              <span className="eyebrow">NAKSHA NETRA</span>
              <h2 id="report-title">PROPERTY INTELLIGENCE REPORT</h2>
              <span className="muted small">Generated {formatDate(createdAt)}</span>
            </div>
          </header>

          <section className="report-hero">
            <div>
              <span className="label">Indicative land value</span>
              <strong>{formatLakh(valuation.estimatedValue)}</strong>
              <span className="muted small">{formatINR(valuation.estimatedValue)}</span>
            </div>
            <ParcelOutline parcel={parcel} />
          </section>

          <table className="report-table">
            <tbody>
              <tr>
                <th>Parcel ID</th>
                <td>{parcel.id}</td>
              </tr>
              <tr>
                <th>Location</th>
                <td>{parcel.location}</td>
              </tr>
              <tr>
                <th>Area</th>
                <td>
                  {formatNumber(parcel.areaSqFt)} sq.ft · {formatNumber(parcel.areaSqM, 2)} sq.m · {formatAcres(parcel.areaAcres)} acres
                </td>
              </tr>
              <tr>
                <th>Rate</th>
                <td>
                  {formatINR(valuation.ratePerSqFt)} / sq.ft <span className="muted">({source === "demo" ? "demo indicative rate" : "NAKSHA NETRA valuation service · sample rate data"})</span>
                </td>
              </tr>
              <tr>
                <th>Indicative value</th>
                <td>{formatINR(valuation.estimatedValue)}</td>
              </tr>
              <tr>
                <th>Seller asking price</th>
                <td>{valuation.askingPrice ? formatINR(valuation.askingPrice) : "—"}</td>
              </tr>
              <tr>
                <th>Difference</th>
                <td>{valuation.difference !== undefined ? `${valuation.difference >= 0 ? "+" : "−"}${formatINR(Math.abs(valuation.difference))}` : "—"}</td>
              </tr>
              <tr>
                <th>Analysis status</th>
                <td>
                  <span className={`tag ${verdict === "above" ? "tag-warn" : "tag-ok"}`}>{statusText}</span>
                </td>
              </tr>
              <tr>
                <th>Boundary vertices</th>
                <td className="mono small">
                  {parcel.coordinates.map((c) => `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`).join("  ·  ")}
                </td>
              </tr>
            </tbody>
          </table>

          <footer className="report-foot">
            Indicative estimate only. Not an official/legal valuation. Parcel boundary is user-drawn; verify cadastral records and official
            circle rates before purchase.
          </footer>
        </article>
      </div>
    </div>
  );
}
