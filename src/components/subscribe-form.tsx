import { useState } from "react";

const SUB_CSS = `
.sub-form{max-width:560px;width:100%;margin:0 auto;padding:40px 32px;background:var(--ground-hi,#f5f0e8);border:1px solid var(--rule,#ddd8ce);border-radius:2px;box-sizing:border-box}
.sub-eyebrow{font-family:var(--sans,'Jost',system-ui,sans-serif);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--text-dim,#8a837a);margin:0 0 14px}
.sub-head{font-family:var(--serif,'Ivy Mode',Georgia,serif);font-weight:300;font-size:28px;line-height:1.2;color:var(--ink,#2b2b2b);margin:0 0 12px}
.sub-body{font-family:var(--sans,'Jost',system-ui,sans-serif);font-size:15px;line-height:1.55;color:var(--text-dim,#6b6560);margin:0 0 24px}
.sub-fields{display:flex;gap:12px;margin-bottom:16px}
.sub-field{flex:1;min-width:0}
.sub-label{display:block;font-family:var(--sans,'Jost',system-ui,sans-serif);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim,#8a837a);margin-bottom:6px}
.sub-input{width:100%;box-sizing:border-box;padding:11px 12px;font-family:var(--sans,'Jost',system-ui,sans-serif);font-size:15px;color:var(--ink,#2b2b2b);background:#fff;border:1px solid var(--rule,#ddd8ce);border-radius:2px;outline:none}
.sub-input:focus{border-color:var(--accent,#a37670)}
.sub-hp{position:absolute;opacity:0;pointer-events:none;height:0;width:0;overflow:hidden}
.sub-btn{display:inline-block;padding:12px 28px;font-family:var(--sans,'Jost',system-ui,sans-serif);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--ground-hi,#f5f0e8);background:var(--ink,#2b2b2b);border:1px solid var(--ink,#2b2b2b);border-radius:2px;cursor:pointer}
.sub-btn:disabled{opacity:.6;cursor:default}
.sub-error{margin:12px 0 0;font-family:var(--sans,'Jost',system-ui,sans-serif);font-size:13px;color:#a02b2b}
.sub-thanks{font-family:var(--serif,'Ivy Mode',Georgia,serif);font-weight:300;font-size:24px;line-height:1.3;color:var(--ink,#2b2b2b);margin:0}
@media (max-width:600px){
  .sub-fields{flex-direction:column;gap:14px}
  .sub-btn{width:100%}
  .sub-head{font-size:24px}
}
`;

export function SubscribeForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/public/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company,
          source_path: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setError(
          json?.error === "rate_limited"
            ? "Too many attempts. Please try again in a minute."
            : json?.error === "invalid_input"
              ? "Please check your name and email address."
              : "Something went wrong. Please try again.",
        );
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sub-form">
      <style dangerouslySetInnerHTML={{ __html: SUB_CSS }} />
      {done ? (
        <p className="sub-thanks">You&rsquo;re in. Look for your first briefing next Monday.</p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <p className="sub-eyebrow">Domi Data</p>
          <h2 className="sub-head">Your Domi Data briefing, delivered every Monday</h2>
          <p className="sub-body">
            Manhattan luxury contracts, signed and tracked. Free, every Monday.
          </p>

          <div className="sub-fields">
            <div className="sub-field">
              <label className="sub-label" htmlFor="sub-name">Name</label>
              <input
                id="sub-name"
                className="sub-input"
                type="text"
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="sub-field">
              <label className="sub-label" htmlFor="sub-email">Email</label>
              <input
                id="sub-email"
                className="sub-input"
                type="email"
                required
                maxLength={320}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="sub-hp" aria-hidden="true">
            <label htmlFor="sub-company">Company</label>
            <input
              id="sub-company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>

          <button className="sub-btn" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Subscribe"}
          </button>
          {error ? <p className="sub-error">{error}</p> : null}
        </form>
      )}
    </div>
  );
}

export default SubscribeForm;
