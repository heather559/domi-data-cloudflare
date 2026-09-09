import { createServerFn } from "@tanstack/react-start";

export interface BedroomLabelAnomaly {
  neighborhood_slug: string | null;
  period: string | null;
  series: string;
  raw_label: string;
  occurrences: number;
  last_seen_at: string;
}

/**
 * Unmapped bedroomMix labels recorded by the database validation trigger on
 * neighborhood_monthly_report. Any label whose canonical form is not one of
 * Studio / 1-Bed / 2-Bed / 3-Bed / 4+ Beds is logged there on write.
 */
export const getBedroomLabelAnomalies = createServerFn({ method: "GET" }).handler(
  async (): Promise<BedroomLabelAnomaly[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          order: (
            col: string,
            o: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{ data: BedroomLabelAnomaly[] | null; error: unknown }>;
          };
        };
      };
    };

    const { data, error } = await client
      .from("bedroom_label_anomalies")
      .select("neighborhood_slug, period, series, raw_label, occurrences, last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[bedroom_label_anomalies] load failed:", error);
      return [];
    }
    return data ?? [];
  },
);
