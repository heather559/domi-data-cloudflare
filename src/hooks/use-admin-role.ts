import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminState = "loading" | "admin" | "denied";

/**
 * Reads the signed-in user's role from public.user_roles. RLS lets a user see
 * only their own rows, so a non-admin simply gets nothing back. Roles are
 * granted in the database, never from the client.
 */
export function useAdminRole(): { state: AdminState; email: string | null } {
  const [state, setState] = useState<AdminState>("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (cancelled) return;
      setEmail(userData.user?.email ?? null);
      if (!userData.user) {
        setState("denied");
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      setState(!error && data ? "admin" : "denied");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, email };
}
