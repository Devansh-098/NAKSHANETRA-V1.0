import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, MapPin, PenLine } from "lucide-react";
import { clearHistory, getHistory } from "../services/history";
import { getVerdict } from "../services/valuation";
import { formatDate, formatLakh, formatNumber } from "../utils/format";

export default function HistoryPage() {
  const [records, setRecords] = useState(getHistory);

  return (
    <main className="container page">
      <div className="page-head">
        <div>
          <span className="eyebrow">History</span>
          <h1>Previous parcel checks</h1>
          <p className="muted">Analyses are saved in this browser.</p>
        </div>
        <div className="page-head-actions">
          {records.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                clearHistory();
                setRecords([]);
              }}
            >
              Clear history
            </button>
          )}
          <Link to="/check" className="btn btn-primary">
            <PenLine size={16} /> New check
          </Link>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="empty-card">
          <MapPin size={28} />
          <strong>No parcel checks yet</strong>
          <span className="muted">Draw your first parcel to see it here.</span>
          <Link to="/check" className="btn btn-primary">
            Check Parcel Value
          </Link>
        </div>
      ) : (
        <ul className="history-grid">
          {records.map((r) => {
            const verdict = getVerdict(r.valuation);
            const pct = Math.abs(r.valuation.percentageDifference ?? 0).toFixed(1);
            return (
              <li key={r.id} className="history-card">
                <div className="history-top">
                  <span className="mono small muted">{r.parcel.id}</span>
                  <span className="small muted">
                    <Clock size={12} /> {formatDate(r.createdAt)}
                  </span>
                </div>
                <h2>
                  <MapPin size={16} /> {r.parcel.location}
                </h2>
                <div className="history-stats">
                  <div>
                    <span className="label">Area</span>
                    <strong>{formatNumber(r.parcel.areaSqFt)} sq.ft</strong>
                  </div>
                  <div>
                    <span className="label">Estimate</span>
                    <strong>{formatLakh(r.valuation.estimatedValue, true)}</strong>
                  </div>
                  <div>
                    <span className="label">Asking</span>
                    <strong>{r.valuation.askingPrice ? formatLakh(r.valuation.askingPrice, true) : "—"}</strong>
                  </div>
                </div>
                {verdict && (
                  <span className={`tag ${verdict === "above" ? "tag-warn" : "tag-ok"}`}>
                    {verdict === "above" ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                    {verdict === "within" ? "Within indicative range" : `${pct}% ${verdict} estimate`}
                  </span>
                )}
                <Link to={`/check?analysis=${encodeURIComponent(r.id)}`} className="btn btn-secondary btn-block">
                  View Analysis <ArrowRight size={16} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
