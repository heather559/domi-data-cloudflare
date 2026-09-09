import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "domi-a11y-prefs";

type Prefs = {
  textSize: 100 | 115 | 130;
  contrast: boolean;
  motion: boolean;
  links: boolean;
};

const DEFAULTS: Prefs = { textSize: 100, contrast: false, motion: false, links: false };

function read(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) } as Prefs;
  } catch {
    return DEFAULTS;
  }
}

function apply(p: Prefs) {
  const el = document.documentElement;
  el.setAttribute("data-a11y-text", String(p.textSize));
  el.toggleAttribute("data-a11y-contrast", p.contrast);
  el.toggleAttribute("data-a11y-motion", p.motion);
  el.toggleAttribute("data-a11y-links", p.links);
}

export function A11yPrefs() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const p = read();
    setPrefs(p);
    setHydrated(true);
    apply(p);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    apply(prefs);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable, preferences stay session-only */
    }
  }, [prefs, hydrated]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const set = <K extends keyof Prefs>(key: K, value: Prefs[K]) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        className="a11y-fab"
        aria-expanded={open}
        aria-controls="a11y-panel"
        aria-label="Display and accessibility preferences"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="4.2" r="2" fill="currentColor" />
          <path
            d="M3.5 7.6h17M12 7.6v6m0 0 3.4 7m-3.4-7-3.4 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </button>

      {open && (
        <div
          id="a11y-panel"
          className="a11y-panel"
          role="dialog"
          aria-label="Display and accessibility preferences"
          ref={panelRef}
          tabIndex={-1}
        >
          <div className="a11y-panel__head">
            <h2 className="a11y-panel__title">Display Preferences</h2>
            <button
              type="button"
              className="a11y-panel__close"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              aria-label="Close preferences"
            >
              &times;
            </button>
          </div>

          <fieldset className="a11y-field">
            <legend>Text size</legend>
            <div className="a11y-seg" role="group">
              {([100, 115, 130] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`a11y-seg__btn ${prefs.textSize === size ? "is-on" : ""}`}
                  aria-pressed={prefs.textSize === size}
                  onClick={() => set("textSize", size)}
                >
                  {size}%
                </button>
              ))}
            </div>
          </fieldset>

          <Toggle
            label="High contrast"
            hint="Darkens body text and strengthens rules and borders."
            checked={prefs.contrast}
            onChange={(v) => set("contrast", v)}
          />
          <Toggle
            label="Underline links"
            hint="Marks every link with an underline, not color alone."
            checked={prefs.links}
            onChange={(v) => set("links", v)}
          />
          <Toggle
            label="Reduce motion"
            hint="Stops transitions and chart animations. Your system setting is already honored."
            checked={prefs.motion}
            onChange={(v) => set("motion", v)}
          />

          <div className="a11y-panel__foot">
            <button type="button" className="a11y-reset" onClick={() => setPrefs(DEFAULTS)}>
              Reset to defaults
            </button>
            <a href="/accessibility">Accessibility statement</a>
          </div>
        </div>
      )}
    </>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="a11y-field">
      <label className="a11y-toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="a11y-toggle__label">{label}</span>
      </label>
      <p className="a11y-hint">{hint}</p>
    </div>
  );
}
