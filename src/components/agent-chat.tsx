import { useEffect, useRef, useState } from "react";
import heatherHeadshotAsset from "../assets/heather-domi-headshot.png.asset.json";

const AVATAR = heatherHeadshotAsset.url;
const STORAGE_KEY = "domi-agent-thread-v1";
const SESSION_KEY = "domi-agent-session-v1";
const STATE_KEY = "domi-agent-state-v4";

type LeadPrompt = { tier: "soft" | "hard"; reason: string };
type ClosedState = null | "idle" | "handoff";
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  leadPrompt?: LeadPrompt;
  leadSubmitted?: boolean;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      execute: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const SUGGESTIONS = [
  "What moved this week?",
  "What's the vibe in the West Village?",
  "How is Tribeca trending?",
  "What does Top 1% mean?",
];

const LEAD_SENTINEL = "<<<LEAD_CAPTURE>>>";

function loadMessages(): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Msg[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: Msg[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch {
    // ignore quota
  }
}

function loadOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function loadClosedState(): ClosedState {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STATE_KEY);
  if (v === "idle" || v === "handoff") return v;
  return null;
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ||
  "0x4AAAAAAD665erU81Cp3Nae";

function extractLeadPrompt(text: string): { text: string; prompt: LeadPrompt | null } {
  const idx = text.lastIndexOf(LEAD_SENTINEL);
  if (idx === -1) return { text, prompt: null };
  const tail = text.slice(idx + LEAD_SENTINEL.length).trim();
  try {
    const parsed = JSON.parse(tail) as LeadPrompt;
    if (parsed && (parsed.tier === "soft" || parsed.tier === "hard")) {
      return { text: text.slice(0, idx).trimEnd(), prompt: parsed };
    }
  } catch {
    // ignore
  }
  return { text, prompt: null };
}

function closedCopy(state: ClosedState): string {
  if (state === "idle")
    return "This conversation timed out. Start a new one anytime, or reach the team at hdomi@heatherdomi.com or (917) 267-8012.";
  return "We'd love to help you with your search. Please complete the form below and a member of our team will be in touch shortly.";
}

type LeadFormProps = {
  prompt: LeadPrompt;
  sessionId: string;
  transcript: Array<{ role: "user" | "assistant"; text: string }>;
  onSubmitted: () => void;
};

function LeadForm({ prompt, sessionId, transcript, onSubmitted }: LeadFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState(prompt.reason);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setErr("Name and email are required.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const label = prompt.tier === "hard" ? "Chatbot handoff" : "Chatbot follow-up";
      const trimmedTranscript = transcript.slice(-30).map((t) => ({
        role: t.role,
        text: t.text.slice(0, 4000),
      }));
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "other",
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          message: `${label}: ${note.trim() || prompt.reason}`,
          source_path: typeof window !== "undefined" ? window.location.pathname : "/",
          session_id: sessionId,
          tier: prompt.tier,
          transcript: trimmedTranscript,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !body.ok) throw new Error("submit_failed");
      onSubmitted();
    } catch {
      setErr("Something went wrong. Please try again or email hdomi@heatherdomi.com.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="agent-lead" onSubmit={submit}>
      <div className="agent-lead__title">
        {prompt.tier === "hard" ? "Let's get you connected with Heather's team." : "Want us to follow up?"}
      </div>
      <input
        type="text"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <input
        type="tel"
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        autoComplete="tel"
      />
      <input
        type="text"
        placeholder="What can we help with?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
      />
      {err && <div className="agent-lead__err">{err}</div>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Sending..." : prompt.tier === "hard" ? "Request a callback" : "Send it over"}
      </button>
    </form>
  );
}

export function AgentChat() {
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closedState, setClosedState] = useState<ClosedState>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const prevOpenRef = useRef(false);
  const sessionIdRef = useRef<string>("");
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const turnstileResolveRef = useRef<((token: string) => void) | null>(null);
  const turnstileRejectRef = useRef<((err: Error) => void) | null>(null);

  useEffect(() => {
    setMessages(loadMessages());
    sessionIdRef.current = loadOrCreateSessionId();
    setClosedState(loadClosedState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveMessages(messages);
  }, [messages, hydrated]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, pending]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  // Return focus to the FAB when the panel closes (via Escape, close button, or FAB toggle).
  useEffect(() => {
    if (prevOpenRef.current && !open) {
      fabRef.current?.focus();
    }
    prevOpenRef.current = open;
  }, [open]);

  // Escape-to-close + Tab focus trap while the panel is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const sel =
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(sel)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
      );
      if (!focusable.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !TURNSTILE_SITE_KEY || turnstileWidgetId.current) return;
    let cancelled = false;
    let pollId: number | undefined;

    function renderWidget() {
      if (cancelled || !window.turnstile || !turnstileContainerRef.current) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        size: "flexible",
        appearance: "interaction-only",
        execution: "execute",
        callback: (token: string) => {
          turnstileResolveRef.current?.(token);
          turnstileResolveRef.current = null;
        },
        "error-callback": () => {
          const reject = turnstileRejectRef.current;
          turnstileResolveRef.current = null;
          turnstileRejectRef.current = null;
          reject?.(new Error("Verification failed. Please try again."));
        },
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      pollId = window.setInterval(() => {
        if (window.turnstile) {
          if (pollId) window.clearInterval(pollId);
          renderWidget();
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
    };
  }, [open]);

  function persistClosed(state: ClosedState) {
    setClosedState(state);
    try {
      if (state) window.localStorage.setItem(STATE_KEY, state);
      else window.localStorage.removeItem(STATE_KEY);
    } catch {
      // ignore
    }
  }

  function getTurnstileToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!TURNSTILE_SITE_KEY) {
        resolve("");
        return;
      }
      if (!window.turnstile || turnstileWidgetId.current == null) {
        reject(new Error("Verification isn't ready yet. Please try again in a moment."));
        return;
      }
      turnstileResolveRef.current = resolve;
      turnstileRejectRef.current = reject;
      window.turnstile.reset(turnstileWidgetId.current);
      window.turnstile.execute(turnstileWidgetId.current);
      window.setTimeout(() => {
        if (turnstileResolveRef.current === resolve) {
          turnstileResolveRef.current = null;
          turnstileRejectRef.current = null;
          reject(new Error("Verification timed out. Please try again."));
        }
      }, 15000);
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || pending || closedState) return;
    setError(null);
    setPending(true);

    let turnstileToken: string;
    try {
      turnstileToken = await getTurnstileToken();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
      setPending(false);
      return;
    }

    const userMsg: Msg = { id: newId(), role: "user", content: text };
    const assistantId = newId();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          message: text,
          turnstile_token: turnstileToken,
        }),
      });
      if (!res.ok || !res.body) {
        if (res.status === 429) throw new Error("You've hit the rate limit. Please wait a bit and try again.");
        if (res.status === 503) throw new Error("The assistant is taking a break. Try again later or email hdomi@heatherdomi.com.");
        throw new Error(`Agent responded ${res.status}`);
      }
      const stateHeader = res.headers.get("X-Agent-Session-State");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const { text: visible } = extractLeadPrompt(acc);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: visible } : m)),
        );
      }
      const { text: finalText, prompt } = extractLeadPrompt(acc);
      const displayText = finalText.trim() || (prompt
        ? (prompt.tier === "hard"
            ? "Happy to connect you with Heather's team."
            : "I can pull that together for you. Where should I send it?")
        : "I couldn't produce an answer. Please try again.");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: displayText, leadPrompt: prompt ?? undefined }
            : m,
        ),
      );
      if (stateHeader === "closed_idle") persistClosed("idle");
      else if (stateHeader === "closed_handoff") persistClosed("handoff");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setPending(false);
      textareaRef.current?.focus();
    }
  }

  function reset() {
    setMessages([]);
    setError(null);
    persistClosed(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SESSION_KEY);
    }
    sessionIdRef.current = loadOrCreateSessionId();
  }

  function onLeadSubmitted(msgId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, leadSubmitted: true } : m)),
    );
  }

  function pickSuggestion(s: string) {
    setInput(s);
    textareaRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!hydrated) return null;

  const composerDisabled = pending || !!closedState;

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className={`agent-fab ${open ? "is-open" : ""}`}
        aria-label={open ? "Close Ask Heather" : "Ask Heather"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 6L6 18M6 6l12 12"/></svg>
        ) : (
          <img src={AVATAR} alt="" aria-hidden="true" className="agent-fab__avatar" />
        )}
      </button>

      {open && (
        <div className="agent-panel" role="dialog" aria-label="Ask Heather" ref={panelRef} tabIndex={-1}>
          <header className="agent-panel__head">
            <div className="agent-panel__brand">
              <img src={AVATAR} alt="Heather Domi, smiling headshot against a neutral studio background." className="agent-panel__avatar" />
              <div>
                <div className="agent-panel__title">Ask Heather</div>
                <div className="agent-panel__sub">Manhattan luxury, on demand</div>
              </div>
            </div>
            <div className="agent-panel__actions">
              {messages.length > 0 && (
                <button type="button" className="agent-panel__reset" onClick={reset} aria-label="New conversation">
                  New
                </button>
              )}
              <button type="button" className="agent-panel__close" onClick={() => setOpen(false)} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </header>

          <div className="agent-panel__body" ref={scrollRef} aria-live="polite" aria-busy={pending} aria-atomic="false">
            {messages.length === 0 ? (
              <div className="agent-empty">
                <p>Ask about this week's numbers, a neighborhood, or how the tiers work. Answers come from the same data that powers the site.</p>
                <p className="agent-empty__disclaimer">
                  For questions about your specific search or listing, I'll connect you with Heather's team.
                </p>
                <div className="agent-empty__suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => pickSuggestion(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`agent-msg agent-msg--${m.role}`}>
                  {m.role === "assistant" && !m.content && pending ? (
                    <span className="agent-typing"><span/><span/><span/></span>
                  ) : (
                    <>
                      {m.content && <div className="agent-msg__content">{m.content}</div>}
                      {m.role === "assistant" && m.leadPrompt && !m.leadSubmitted && (
                        <LeadForm
                          prompt={m.leadPrompt}
                          sessionId={sessionIdRef.current}
                          transcript={messages.map((mm) => ({ role: mm.role, text: mm.content }))}
                          onSubmitted={() => onLeadSubmitted(m.id)}
                        />
                      )}
                      {m.role === "assistant" && m.leadSubmitted && (
                        <div className="agent-lead__ok">
                          Thank you. Heather's team will be in touch shortly.
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
            {error && <div className="agent-error">{error}</div>}
          </div>

          <div ref={turnstileContainerRef} style={{ display: "none" }} aria-hidden="true" />

          {closedState ? (
            <div className="agent-panel__footnote agent-capped">
              {closedCopy(closedState)}
            </div>
          ) : (
            <>
              <form
                className="agent-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Ask about the market..."
                  rows={2}
                  disabled={composerDisabled}
                />
                <button type="submit" disabled={composerDisabled || !input.trim()} aria-label="Send">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </button>
              </form>
              <div className="agent-panel__footnote">
                Answers use live Domi Data. Not investment advice.
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
