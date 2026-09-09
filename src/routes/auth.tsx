import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

// Public sign-in page for the internal tools. Email + password only during migration.
// Access is granted by assigning an admin role in the database.
export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in · internal" },
      { name: "description", content: "Sign in to the Domi Data internal tools." },
      { name: "robots", content: "noindex, nofollow, noai, noimageai" },
    ],
  }),
  component: AuthPage,
});

function safePath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/internal";
  return value;
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = safePath(redirect);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: target, replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: target, replace: true });
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, target]);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message ?? "Sign-in failed. Check your email and password.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Domi Data</p>
        <h1>Internal sign-in</h1>
        <p className="lede">
          These tools are restricted. Sign in with your Domi Data account.
        </p>
        <form onSubmit={signIn}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoComplete="current-password"
            required
          />
          <button type="submit" disabled={busy || !email || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <style>{css}</style>
    </main>
  );
}

const css = `
.auth-page {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  font-family: "Jost", system-ui, sans-serif;
  color: #2b2b2b;
}
.auth-card {
  max-width: 420px;
  width: 100%;
  border: 1px solid #e5e2dc;
  padding: 40px 32px;
  background: #fdfcfa;
}
.auth-card .eyebrow {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #918c7e;
  margin: 0 0 10px;
}
.auth-card h1 {
  font-family: "Ivy Mode", "Cormorant Garamond", serif;
  font-weight: 300;
  font-size: 32px;
  margin: 0 0 12px;
}
.auth-card .lede { color: #5a5a5a; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
.auth-card form { display: flex; flex-direction: column; gap: 12px; }
.auth-card input {
  width: 100%;
  padding: 11px 14px;
  border: 1px solid #ccc9c2;
  background: #fff;
  font-family: inherit;
  font-size: 15px;
  color: #2b2b2b;
  box-sizing: border-box;
}
.auth-card input:focus { outline: 2px solid #a37670; border-color: #a37670; }
.auth-card input:disabled { opacity: 0.6; }
.auth-card button {
  width: 100%;
  padding: 13px 18px;
  border: 1px solid #2b2b2b;
  background: #2b2b2b;
  color: #fdfcfa;
  font-family: inherit;
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  margin-top: 4px;
}
.auth-card button:disabled { opacity: 0.6; cursor: default; }
.auth-card button:hover:not(:disabled) { background: #a37670; border-color: #a37670; }
.auth-error { color: #a3403a; font-size: 14px; margin: 16px 0 0; }
`;
