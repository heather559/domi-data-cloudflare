import { useEffect, useRef, useState } from "react";
import domiDataLockupAsset from "../assets/hd-dd-lockup-v2.png.asset.json";
import deLogoBlackAsset from "../assets/de-logo-black.png.asset.json";
import deLogoWhiteAsset from "../assets/de-logo-white.png.asset.json";
import { NAV_ENTRIES, isGroup, type NavGroup } from "../lib/nav";
import { MP_PATH } from "./site-footer";

const domiDataLockup = domiDataLockupAsset.url;

function NavMenu({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const hoverOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  return (
    <div
      className="nav-menu"
      ref={ref}
      onMouseEnter={hoverOpen}
      onMouseLeave={hoverClose}
      onFocus={hoverOpen}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="nav-menu__label"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {group.label}
        <span className="nav-menu__caret" aria-hidden="true" />
      </button>
      <div className={`nav-menu__panel ${open ? "is-open" : ""}`} role="group" aria-label={group.label}>
        {group.children.map((c) => (
          <a key={c.href} href={c.href} onClick={() => setOpen(false)}>
            <span className="nav-menu__item-label">{c.label}</span>
            {c.note ? <span className="nav-menu__item-note">{c.note}</span> : null}
          </a>
        ))}
      </div>
    </div>
  );
}

type Props = { variant?: "overlay" | "solid" };


export function SiteHeader({ variant = "solid" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const set = () => {
      // Round up: a fractional height leaves a sub-pixel gap under the sticky header
      // that page content shows through beneath sticky contents bars.
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--site-header-h", h + "px");
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener("resize", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`site-header-wrap ${variant}`}>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <div className={`mp-credit-strip ${variant}`} role="region" aria-label="Data attribution">
        <div className="mp-credit-strip__row">
          <span>Data Powered by</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576.01 100" aria-label="Marketproof" role="img"><path fillRule="nonzero" fill="currentColor" d={MP_PATH}/></svg>
        </div>
      </div>
      <header className={`site-header ${variant}`}>
        <a href="/" className="brand-lockup" aria-label="Heather Domi Team — Domi Data">
          <img src={domiDataLockup} alt="Heather Domi and Domi Data logo lockup: an interlocking hd monogram above the words Heather Domi and Domi Data." className="brand-mark" />
          <img
            src={variant === "overlay" ? deLogoWhiteAsset.url : deLogoBlackAsset.url}
            alt="Douglas Elliman Real Estate logo: the DE monogram in a circle beside the Douglas Elliman wordmark."
            className="brand-de-logo"
          />
        </a>

        <nav className="site-nav" aria-label="Primary">
          {NAV_ENTRIES.map((n) =>
            isGroup(n) ? (
              <NavMenu key={n.label} group={n} />
            ) : (
              <a key={n.label} href={n.href}>
                {n.label}
              </a>
            )
          )}
        </nav>

        <div className="site-meta">
          <a href="tel:9172678012">(917) 267-8012</a>
        </div>
        <button
          type="button"
          className="site-nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`site-nav-toggle__icon ${open ? "is-open" : ""}`} aria-hidden="true">
            <span /><span /><span />
          </span>
        </button>
      </header>
      {open && (
        <>
          <div className="site-nav-drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="site-nav-drawer" role="dialog" aria-modal="true" aria-label="Site navigation">
            <div className="site-nav-drawer__inner">
              <nav aria-label="Mobile primary">
                {NAV_ENTRIES.map((n) =>
                  isGroup(n) ? (
                    <div key={n.label} className="site-nav-drawer__group">
                      <span className="site-nav-drawer__group-label">{n.label}</span>
                      {n.children.map((c) => (
                        <a key={c.href} href={c.href} onClick={() => setOpen(false)}>
                          {c.label}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <a key={n.label} href={n.href} onClick={() => setOpen(false)}>
                      {n.label}
                    </a>
                  )
                )}
              </nav>

              <a className="site-nav-drawer__phone" href="tel:9172678012" onClick={() => setOpen(false)}>
                (917) 267-8012
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
