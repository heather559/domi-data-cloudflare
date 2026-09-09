import { createServerFn } from "@tanstack/react-start";

// Explicit JSON shape: the server-fn serializer rejects `unknown` values.
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface ReconciliationFlag {
  id: string;
  week_start: string;
  check_name: string;
  hero_value: number | null;
  table_value: number | null;
  delta: number | null;
  severity: string;
  detail: { [key: string]: JsonValue } | null;
  status: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Open and recently resolved reconciliation flags, newest week first. */
export const getReconciliationFlags = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReconciliationFlag[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data, error } = await client
      .from("weekly_reconciliation_flags")
      .select(
        "id, week_start, check_name, hero_value, table_value, delta, severity, detail, status, resolved_at, created_at, updated_at",
      )
      .order("week_start", { ascending: false })
      .order("check_name", { ascending: true })
      .limit(200);
    if (error) {
      console.error("[weekly_reconciliation_flags] load failed:", error);
      return [];
    }
    return (data ?? []) as ReconciliationFlag[];
  },
);
