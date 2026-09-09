import { useEffect, useState } from "react";
import heatherLifestyle from "../assets/heather-lifestyle.jpg.asset.json";

const STORAGE_KEY = "domi-install-prompt-v1";
const DELAY_MS = 8000;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { until } = JSON.parse(stored) as { until: number };
        if (until && Date.now() < until) return;
      }
    } catch {
      /* ignore */
    }

    const p = detectPlatform();
    setPlatform(p);
    if (p === "other") return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const t = window.setTimeout(() => setVisible(true), DELAY_MS);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBIP);
    };
  }, []);

  function remember(days: number) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ until: Date.now() + days * 24 * 60 * 60 * 1000 }),
      );
    } catch {
      /* ignore */
    }
  }

  function close(days = 14) {
    remember(days);
    setVisible(false);
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      remember(outcome === "accepted" ? 3650 : 30);
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="Add Domi Data to your home screen">
      <button
        type="button"
        className="install-prompt__close"
        aria-label="Dismiss"
        onClick={() => close(14)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="install-prompt__media">
        <img src={heatherLifestyle.url} alt="Heather Domi seated in a green velvet armchair beside a sunlit window, a small apricot poodle in her lap." />
      </div>
      <div className="install-prompt__body">
        <div className="install-prompt__eyebrow">Domi Data</div>
        <h3 className="install-prompt__title">Keep Manhattan luxury close.</h3>
        <p className="install-prompt__copy">
          Add Domi Data to your home screen for one-tap access to the weekly read.
        </p>

        {platform === "ios" ? (
          <div className="install-prompt__steps">
            <p>
              Tap the Share icon{" "}
              <span className="install-prompt__icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3v13" />
                  <path d="M7 8l5-5 5 5" />
                  <path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </span>{" "}
              in Safari, then choose <strong>Add to Home Screen</strong>.
            </p>
            <div className="install-prompt__actions">
              <button type="button" className="install-prompt__btn install-prompt__btn--ghost" onClick={() => close(14)}>
                Not now
              </button>
            </div>
          </div>
        ) : (
          <div className="install-prompt__actions">
            <button type="button" className="install-prompt__btn install-prompt__btn--ghost" onClick={() => close(14)}>
              Not now
            </button>
            <button
              type="button"
              className="install-prompt__btn install-prompt__btn--primary"
              onClick={install}
              disabled={!deferred}
            >
              {deferred ? "Add to home screen" : "Use browser menu"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
