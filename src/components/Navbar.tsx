import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, PenLine, X } from "lucide-react";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={close} aria-label="NAKSHA NETRA home">
          <img src="/naksha-netra-logo.jpeg" alt="" className="brand-logo" width={44} height={44} />
          <span className="brand-text">
            <span className="brand-name">NAKSHA NETRA</span>
            <span className="brand-tag">Land Intelligence</span>
          </span>
        </Link>

        <button
          type="button"
          className="icon-btn nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav className={`nav-links${open ? " is-open" : ""}`} aria-label="Main">
          <NavLink to="/" end onClick={close}>
            Home
          </NavLink>
          <NavLink to="/check" onClick={close}>
            Check Parcel
          </NavLink>
          <NavLink to="/history" onClick={close}>
            History
          </NavLink>
          <Link to="/check" className="btn btn-primary btn-sm nav-cta" onClick={close}>
            <PenLine size={16} /> Check Parcel
          </Link>
        </nav>
      </div>
    </header>
  );
}
