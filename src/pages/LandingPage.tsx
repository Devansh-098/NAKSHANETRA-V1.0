import { Link } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  Building2,
  Calculator,
  ChevronRight,
  FileSearch,
  Landmark,
  MapPin,
  PenLine,
  Ruler,
  Satellite,
  Scale,
  Store,
  TrendingUp,
  Layers,
  Map as MapIcon,
} from "lucide-react";

const FEATURES = [
  { icon: PenLine, title: "Draw", text: "Create a parcel boundary directly on the map." },
  { icon: Ruler, title: "Measure", text: "Automatically calculate parcel area using geospatial geometry." },
  { icon: Calculator, title: "Value", text: "Combine parcel area with locality-specific valuation data." },
  { icon: Scale, title: "Decide", text: "Compare the indicative value with the seller's asking price." },
];

const STEPS = ["Draw Parcel", "Calculate Area", "Get Local Rate", "Estimate Value"];

const SEGMENTS = [
  { icon: Building2, title: "Real Estate", text: "Faster property screening and parcel intelligence." },
  { icon: Landmark, title: "Land Acquisition", text: "Screen multiple candidate parcels faster." },
  { icon: FileSearch, title: "Property Consultants", text: "Generate structured parcel reports." },
  { icon: Banknote, title: "Lending", text: "Support preliminary property intelligence workflows." },
];

const SOURCES = [
  { icon: MapIcon, label: "Cadastral Data" },
  { icon: Satellite, label: "Satellite / Imagery" },
  { icon: Layers, label: "GIS Geometry" },
  { icon: Store, label: "Local Market Signals" },
];

export default function LandingPage() {
  return (
    <main className="landing">
      <section className="hero container">
        <div className="hero-copy">
          <span className="eyebrow">AI-assisted land intelligence</span>
          <h1>From Parcel to Property Intelligence.</h1>
          <p className="lead">Draw a parcel, measure its area, and understand its indicative value — all in one map.</p>
          <div className="hero-actions">
            <Link to="/check" className="btn btn-primary btn-lg">
              Check Parcel Value <ArrowRight size={18} />
            </Link>
            <Link to="/history" className="btn btn-secondary btn-lg">
              View past checks
            </Link>
          </div>
          <p className="hero-meta">Fast • Geospatial • Data-driven</p>
        </div>

        <div className="hero-visual" aria-hidden>
          <div className="hero-map">
            <svg viewBox="0 0 480 400" className="hero-map-svg">
              <defs>
                <pattern id="plots" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="skewX(-12)">
                  <rect width="60" height="60" fill="#EAF6EE" />
                  <path d="M60 0H0V60" fill="none" stroke="#FFFFFF" strokeWidth="4" />
                  <path d="M30 0V60M0 30H60" fill="none" stroke="#D3E9DA" strokeWidth="1" strokeDasharray="3 4" />
                </pattern>
              </defs>
              <rect width="480" height="400" fill="url(#plots)" />
              <path d="M-10 250 C 120 220, 200 300, 490 230" stroke="#FFFFFF" strokeWidth="14" fill="none" />
              <path d="M300 -10 C 280 120, 340 260, 290 410" stroke="#FFFFFF" strokeWidth="10" fill="none" />
              <path className="hero-parcel" d="M150 110 L270 95 L300 190 L230 205 L240 265 L160 270 Z" />
              {[
                [150, 110],
                [270, 95],
                [300, 190],
                [230, 205],
                [240, 265],
                [160, 270],
              ].map(([x, y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#FFFFFF" stroke="#176B45" strokeWidth="3" />
              ))}
            </svg>
            <div className="hero-pin">
              <MapPin size={16} /> Dehradun, Uttarakhand
            </div>
            <img src="/naksha-netra-logo.jpeg" alt="" className="hero-logo" />
            <div className="hero-card">
              <span className="label">Estimated land value</span>
              <strong>₹61.25 Lakh</strong>
              <div className="hero-card-row">
                <span>2,450 sq.ft</span>
                <span>₹2,500/sq.ft</span>
              </div>
              <div className="hero-card-flag">
                <TrendingUp size={14} /> Asking 14.3% above estimate
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section container" aria-labelledby="features-title">
        <h2 id="features-title" className="sr-only">
          Features
        </h2>
        <div className="grid-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="feature-card">
              <span className="feature-icon">
                <Icon size={20} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section container" aria-labelledby="how-title">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2 id="how-title">Four steps from boundary to insight</h2>
        </div>
        <ol className="flow">
          {STEPS.map((step, i) => (
            <li key={step} className="flow-step">
              <span className="flow-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="flow-label">{step}</span>
              {i < STEPS.length - 1 && <ChevronRight className="flow-arrow" size={20} aria-hidden />}
            </li>
          ))}
        </ol>
      </section>

      <section className="section container" aria-labelledby="eco-title">
        <div className="section-head">
          <span className="eyebrow">Who it's for</span>
          <h2 id="eco-title">Built for the property ecosystem</h2>
        </div>
        <div className="grid-4">
          {SEGMENTS.map(({ icon: Icon, title, text }) => (
            <article key={title} className="segment-card">
              <Icon size={20} className="segment-icon" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <p className="section-note">“From a single parcel check today to scalable land intelligence APIs tomorrow.”</p>
      </section>

      <section className="section container" aria-labelledby="arch-title">
        <div className="arch">
          <div className="arch-copy">
            <span className="eyebrow">Future-ready architecture</span>
            <h2 id="arch-title">Designed to layer in richer land data</h2>
            <p>
              Today NAKSHA NETRA combines user-drawn GIS geometry with indicative local rates. The pipeline is built so cadastral records,
              imagery and market signals can plug in as they become available.
            </p>
          </div>
          <div className="arch-diagram">
            <div className="arch-sources">
              {SOURCES.map(({ icon: Icon, label }) => (
                <span key={label} className="arch-chip">
                  <Icon size={16} /> {label}
                </span>
              ))}
            </div>
            <span className="arch-connector" aria-hidden />
            <div className="arch-core">
              <img src="/naksha-netra-logo.jpeg" alt="" />
              NAKSHA NETRA
            </div>
            <span className="arch-connector" aria-hidden />
            <div className="arch-out">Land Intelligence</div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="cta-band">
          <div>
            <h2>Looking at a piece of land?</h2>
            <p>Draw it, measure it and see how the asking price compares — in under a minute.</p>
          </div>
          <Link to="/check" className="btn btn-primary btn-lg">
            Check Parcel Value <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="site-footer container">
        <span>© {new Date().getFullYear()} NAKSHA NETRA · From Parcel to Property Intelligence.</span>
        <span>Indicative estimates only. Not an official or legal property valuation.</span>
      </footer>
    </main>
  );
}
