import { createServerFn } from "@tanstack/react-start";
import { withReconciledHero } from "./weekly-hero-reconcile";

export type WeeklyTierSeriesMetrics = {
  count: number | null;
  volume: number | null;
  median: number | null;
  ppsf: number | null;
  dom: number | null;
};

export type WeeklyTierSeriesPoint = {
  week_start: string;
  luxury: WeeklyTierSeriesMetrics;
  prime: WeeklyTierSeriesMetrics;
  trophy: WeeklyTierSeriesMetrics;
};

export type WeeklyReportPayload = {
  hero: {
    luxury_cutoff: number | null;
    luxury_count: number | null;
    luxury_count_wow_pct: number | null;
    luxury_count_vs_lastweek_pct?: number | null;
    luxury_count_yoy_pct?: number | null;
    luxury_count_avg52: number | null;
    luxury_volume: number | null;
    luxury_volume_wow_pct: number | null;
    luxury_volume_vs_lastweek_pct?: number | null;
    luxury_volume_yoy_pct?: number | null;
    luxury_volume_avg52: number | null;
    prime_cutoff: number | null;
    prime_count: number | null;
    /** Cumulative (at-or-above) Prime dollar volume this week. */
    prime_volume?: number | null;
    trophy_cutoff: number | null;
    trophy_count: number | null;
    /** Cumulative (at-or-above) Trophy dollar volume this week. */
    trophy_volume?: number | null;
    median_price: number | null;
    median_ppsf: number | null;
    avg_dom: number | null;
  };
  /** Weekly tier momentum series, oldest first. Counts and volumes are already
   *  exclusive-band (server-side subtraction done); do not subtract again. */
  tier_series?: WeeklyTierSeriesPoint[] | null;
  /** Disclosure that historical Luxury/Prime weeks use today's cutoffs retroactively. */
  tier_series_methodology_note?: string | null;
  demand_trend: { counts: number[]; rolling_avg: (number | null)[]; labels?: string[] };
  tiers: {
    luxury: { cutoff: number | null; cutoff_wow_pct?: number | null; cutoff_yoy_pct?: number | null; ppsf_avg: number | null; ppsf_avg_wow_pct: number | null; ppsf_avg_yoy_pct: number | null; volume_52wk: number | null; volume_52wk_wow_pct: number | null; volume_52wk_yoy_pct: number | null; cleared_52wk: number | null; cleared_52wk_wow_pct: number | null; cleared_52wk_yoy_pct: number | null };
    prime: { cutoff: number | null; cutoff_wow_pct?: number | null; cutoff_yoy_pct?: number | null; ppsf_avg: number | null; ppsf_avg_wow_pct: number | null; ppsf_avg_yoy_pct: number | null; volume_52wk: number | null; volume_52wk_wow_pct: number | null; volume_52wk_yoy_pct: number | null; cleared_52wk: number | null; cleared_52wk_wow_pct: number | null; cleared_52wk_yoy_pct: number | null };
    trophy: { cutoff: number | null; cutoff_wow_pct?: number | null; cutoff_yoy_pct?: number | null; ppsf_avg: number | null; ppsf_avg_wow_pct: number | null; ppsf_avg_yoy_pct: number | null; volume_52wk: number | null; volume_52wk_wow_pct: number | null; volume_52wk_yoy_pct: number | null; cleared_52wk: number | null; cleared_52wk_wow_pct: number | null; cleared_52wk_yoy_pct: number | null };
    history_annual: {
      years: (string | number)[];
      p90: number[];
      p95: number[];
      p99: number[];
    };
    history_quarterly?: {
      labels: string[];
      p90: number[];
      p95: number[];
      p99: number[];
    };
  };
  market_pulse: {
    all: {
      contracts: number | null;
      contracts_wow_pct: number | null;
      contracts_yoy_pct: number | null;
      contracts_avg52: number | null;
      contracts_vs_lastweek_pct: number | null;
      volume: number | null;
      volume_wow_pct: number | null;
      volume_yoy_pct: number | null;
      volume_avg52: number | null;
      volume_vs_lastweek_pct: number | null;
    };
    by_type: Record<
      "condo" | "coop" | "townhouse",
      {
        contracts: number | null;
        contracts_wow_pct: number | null;
        contracts_yoy_pct: number | null;
        contracts_volume: number | null;
        contracts_volume_wow_pct: number | null;
        contracts_volume_yoy_pct: number | null;
        recorded_sales: number | null;
        recorded_sales_wow_pct: number | null;
        recorded_sales_yoy_pct: number | null;
        ppsf: number | null;
        ppsf_wow_pct: number | null;
        ppsf_yoy_pct: number | null;
        discount_pct: number | null;
        discount_pct_wow_pct: number | null;
        discount_pct_yoy_pct: number | null;
        dom: number | null;
        dom_wow_pct: number | null;
        dom_yoy_pct: number | null;
      }
    >;
  };
  bedroom_mix: {
    volume: Record<string, number | null> | null;
    count: Record<string, number | null> | null;
  } | null;
  leaderboard: Array<{
    rank: number;
    name: string;
    vol_52wk: number | null;
    contracts_52wk: number | null;
    local_median: number | null;
    avg_sale: number | null;
    pct_lux: number | null;
    wk_contracts: number | null;
    wk_volume: number | null;
    rank_delta: number | null;
  }>;
  concentrated_leaderboard: Array<{
    rank: number;
    name: string;
    vol_52wk: number | null;
    contracts_52wk: number | null;
    local_median: number | null;
    avg_sale: number | null;
    pct_lux: number | null;
    wk_contracts: number | null;
    wk_volume: number | null;
    rank_delta: number | null;
  }>;
  weekly_activity_leaderboard: Array<{
    rank: number;
    name: string;
    wk_contracts: number | null;
    wk_volume: number | null;
    largest_rank: number | null;
    concentrated_rank: number | null;
  }>;
  supply: {
    luxury: { active: number | null; months_supply: number | null; absorption_pct: number | null; active_yoy_pct?: number | null; active_wow_pct?: number | null; months_supply_wow_pct?: number | null; months_supply_yoy_pct?: number | null; absorption_pct_wow_pct?: number | null; absorption_pct_yoy_pct?: number | null };
    prime: { active: number | null; months_supply: number | null; absorption_pct: number | null };
    all: { active: number | null; months_supply: number | null; absorption_pct: number | null; active_yoy_pct?: number | null; active_wow_pct?: number | null; months_supply_wow_pct?: number | null; months_supply_yoy_pct?: number | null; absorption_pct_wow_pct?: number | null; absorption_pct_yoy_pct?: number | null };
    supply_series: { luxury: number[]; all: number[]; prime?: number[] | null };
    dom_series: { luxury: number[]; all: number[] | null; luxury_p95?: number[] | null };
  };
  type_trends?: {
    labels: string[];
    contracts_count: { condo: number[]; coop: number[]; townhouse: number[] };
    contracts_volume: { condo: number[]; coop: number[]; townhouse: number[] };
    sales_avgprice: { condo: number[]; coop: number[]; townhouse: number[] };
    sales_discount: { condo: number[]; coop: number[]; townhouse: number[] };
    sales_ppsf: { condo: number[]; coop: number[]; townhouse: number[] };
    sales_count: { condo: number[]; coop: number[]; townhouse: number[] };
    sales_volume: { condo: number[]; coop: number[]; townhouse: number[] };
  } | null;
  top_deals: Array<{
    address: string;
    price: number;
    neighborhood: string;
    sf?: number | null;
    ppsf?: number | null;
    dom?: number | null;
    property_type?: string | null;
  }> | null;
  sowhat: {
    lede: string;
    market_read: { badge: string; class: string };
    supply_read: string | null;
    pace_read: string | null;
    dom_read: string | null;
    discount_read: string | null;
    volume_read: string | null;
    trophy_read: string | null;
    neighborhood_mover_read: string | null;
    footnotes: {
      asking_not_achieved: string;
      count_reconciliation: string;
      provisional: string;
    };
    streak_weeks: number;
  } | null;
};

export type WeeklyReportRow = {
  week_start: string;
  week_end: string;
  generated_at: string;
  is_provisional: boolean;
  payload: WeeklyReportPayload;
};

export const getLatestWeeklyReport = createServerFn({ method: "GET" }).handler(
  async (): Promise<WeeklyReportRow | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          order: (col: string, o: { ascending: boolean }) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{ data: WeeklyReportRow | null; error: unknown }>;
            };
          };
        };
      };
    };
    const { data, error } = await client
      .from("weekly_report")
      .select("week_start, week_end, generated_at, is_provisional, payload")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[weekly_report] load failed:", error);
      return null;
    }
    // Align the hero totals with the neighborhood activity table before render.
    return data ? withReconciledHero(data) : null;
  },
);
