import { createServerFn } from "@tanstack/react-start";

/* ─────────── payload contract ─────────── */

export type MonthlySeries = {
  /** Month labels, oldest first. 13 months of history — 12 trailing plus the same calendar month one year prior, so the chart's most recent point carries a visible same-month year-over-year comparison. */
  labels: string[];
  luxury_count: Array<number | null>;
  luxury_count_avg3: Array<number | null>;
  luxury_volume: Array<number | null>;
  by_type?: {
    condo: Array<number | null>;
    coop: Array<number | null>;
    townhouse: Array<number | null>;
  } | null;
};

export type MonthlyMomentumRow = {
  label: string;
  /** "count" renders as an integer, "money" as $M, "ppsf" as $/sf, "days" as days, "pct" as a percentage. */
  unit: "count" | "money" | "ppsf" | "days" | "pct";
  month: number | null;
  avg3: number | null;
  avg12: number | null;
  yoy_pct: number | null;
  /** Sample size behind the month figure, used for the small-sample note. */
  n?: number | null;
};

export type MonthlyTier = {
  cutoff: number | null;
  /** Trailing-12mo signed count — feeds the hero tier box. */
  count: number | null;
  volume: number | null;
  /**
   * Short tagline for the hero-box caption (e.g. "22+ qualifying neighborhoods").
   * This Week hardcodes its three tier taglines as static strings rather than deriving
   * them, so this field is optional — the frontend falls back to the same static
   * strings This Week uses if the data pull doesn't populate it.
   */
  qualifying_note?: string | null;
  /** Cutoff price momentum, shown as delta chips beside the tier price in "The Luxury Lines". */
  cutoff_yoy_pct?: number | null;
  cutoff_mom_pct?: number | null;
  ppsf_avg: number | null;
  ppsf_avg_yoy_pct: number | null;
  ppsf_avg_mom_pct: number | null;
  volume_52wk: number | null;
  volume_52wk_yoy_pct: number | null;
  volume_52wk_mom_pct: number | null;
  /** Same figure as `count` — carried separately because the Luxury Lines card shows it with its own YoY/MoM deltas. */
  cleared_52wk: number | null;
  cleared_52wk_yoy_pct: number | null;
  cleared_52wk_mom_pct: number | null;
  /** Month-of contract count momentum, shown beside the Contracts row in "The Luxury Lines". */
  count_yoy_pct?: number | null;
  count_mom_pct?: number | null;
  /** Month-of dollar volume momentum, shown beside the Volume row in "The Luxury Lines". */
  volume_yoy_pct?: number | null;
  volume_mom_pct?: number | null;
  /** Trailing-12mo median contract price and its year-over-year move. */
  median_price?: number | null;
  median_price_yoy_pct?: number | null;
  /** Trailing-12mo average days on market and its year-over-year move. */
  dom?: number | null;
  dom_yoy_pct?: number | null;
};

/** One month of per-tier readings for the Momentum chart. Null-safe: any metric may be absent. */
export type MonthlyTierSeriesMetrics = {
  count: number | null;
  volume: number | null;
  median: number | null;
  ppsf: number | null;
  dom: number | null;
};

export type MonthlyTierSeriesPoint = {
  /** Short month label, e.g. "Jun '26". Oldest first. */
  month: string;
  luxury: MonthlyTierSeriesMetrics;
  prime: MonthlyTierSeriesMetrics;
  trophy: MonthlyTierSeriesMetrics;
};

export type MonthlySupplyRow = {
  segment: string;
  inventory: number | null;
  contracts: number | null;
  months_supply: number | null;
  absorption_pct: number | null;
};

export type MonthlyLeaderboardRow = {
  rank: number;
  name: string;
  vol_52wk: number | null;
  contracts_52wk: number | null;
  local_median: number | null;
  avg_sale: number | null;
  pct_lux: number | null;
  month_contracts: number | null;
  month_volume: number | null;
  rank_delta: number | null;
};

export type MonthlyActivityRow = {
  rank: number;
  name: string;
  month_contracts: number | null;
  month_volume: number | null;
  largest_rank: number | null;
  concentrated_rank: number | null;
};

export type MonthlyTopDeal = {
  address: string;
  price: number | null;
  neighborhood: string;
  sf: number | null;
  ppsf: number | null;
  dom: number | null;
  property_type: string | null;
};

export type MonthlyMarketRead = {
  /** Display text for the badge, e.g. "Busy", "Above Pace", "Normal", "Slow", "Quiet". */
  badge: string;
  /** Renders as `week-read--{class}` — mirrors This Week's server-side so-what market_read class. */
  class: "busy" | "above" | "normal" | "slow" | "quiet";
};

export type MonthlyMarketPulseByTypeRow = {
  contracts: number | null;
  contracts_mom_pct: number | null;
  contracts_yoy_pct: number | null;
  contracts_volume: number | null;
  contracts_volume_mom_pct: number | null;
  contracts_volume_yoy_pct: number | null;
  recorded_sales: number | null;
  recorded_sales_mom_pct: number | null;
  recorded_sales_yoy_pct: number | null;
  ppsf: number | null;
  ppsf_mom_pct: number | null;
  ppsf_yoy_pct: number | null;
  discount_pct: number | null;
  discount_pct_mom_pct: number | null;
  discount_pct_yoy_pct: number | null;
  dom: number | null;
  dom_mom_pct: number | null;
  dom_yoy_pct: number | null;
};

export type MonthlyMarketPulse = {
  all: {
    contracts: number | null;
    contracts_mom_pct: number | null;
    contracts_yoy_pct: number | null;
    contracts_avg12: number | null;
    volume: number | null;
    volume_mom_pct: number | null;
    volume_yoy_pct: number | null;
    volume_avg12: number | null;
  };
  by_type: Record<"condo" | "coop" | "townhouse", MonthlyMarketPulseByTypeRow>;
} | null;

export type MonthlyMarketPulseSeriesMetrics = {
  contracts: number | null;
  contracts_volume: number | null;
  recorded_sales: number | null;
  ppsf: number | null;
  discount_pct: number | null;
  dom: number | null;
};

export type MonthlyMarketPulseSeriesPoint = {
  /** Short month label, e.g. "Aug '25". Oldest first. */
  month: string;
  /** All-Manhattan total — only carries contracts/volume; the source endpoint has no
   * recorded-sales/ppsf/discount/dom breakdown at the all-Manhattan level. */
  all: { contracts: number | null; volume: number | null };
  condo: MonthlyMarketPulseSeriesMetrics;
  coop: MonthlyMarketPulseSeriesMetrics;
  townhouse: MonthlyMarketPulseSeriesMetrics;
};

export type MonthlyReportPayload = {
  glance: {
    luxury_count: number | null;
    luxury_count_mom_pct: number | null;
    luxury_count_yoy_pct: number | null;
    /** Third comparison for the headline delta chips — vs. trailing 3-month average. */
    luxury_count_vs_trailing3_pct: number | null;
    luxury_volume: number | null;
    luxury_volume_mom_pct: number | null;
    luxury_volume_yoy_pct: number | null;
    luxury_volume_vs_trailing3_pct: number | null;
    median_price: number | null;
    median_ppsf: number | null;
    avg_dom: number | null;
    /** Secondary stat row, ported from This Week's week-stats strip. */
    cleared_prime_count: number | null;
    cleared_trophy_count: number | null;
  };
  tiers: {
    luxury: MonthlyTier;
    prime: MonthlyTier;
    trophy: MonthlyTier;
  };
  momentum: MonthlyMomentumRow[];
  series: MonthlySeries;
  /** 13 months of per-tier readings driving the Momentum chart. Null until the data pull populates it. */
  tier_series?: MonthlyTierSeriesPoint[] | null;
  supply: MonthlySupplyRow[];
  leaderboard: MonthlyLeaderboardRow[];
  concentrated_leaderboard: MonthlyLeaderboardRow[];
  monthly_activity_leaderboard: MonthlyActivityRow[];
  /** Top signed-contract deals of the month, same row shape as This Week's top_deals. Re-added 2026-07-30 for the verbatim Top Deals of the Month port. */
  top_deals: MonthlyTopDeal[] | null;
  /** Drives the Manhattan Market Pulse status badge, ported verbatim from This Week's 5-state so-what market_read concept. */
  market_read: MonthlyMarketRead | null;
  /** Manhattan Market Pulse full breakdown (all-Manhattan totals + condo/co-op/townhouse
   * columns), ported from This Week's market_pulse shape and adapted to monthly cadence
   * (mom_pct replaces wow_pct, avg12 replaces avg52). Null until a data-pull update populates it. */
  market_pulse: MonthlyMarketPulse;
  /** Trailing months of the Market Pulse breakdown above, one point per month, oldest first.
   * Drives the Market Pulse history chart. Null/absent until the data pull populates it. */
  market_pulse_series?: MonthlyMarketPulseSeriesPoint[] | null;
  /** Contracts and dollar volume by bedroom count (studio/1/2/3/4+), ported from This
   * Week's bedroom_mix shape — metric-first: bedroom_mix.count.studio, NOT
   * bedroom_mix.studio.count. Null until a data-pull update populates it. */
  bedroom_mix: {
    count: Record<string, number | null> | null;
    volume: Record<string, number | null> | null;
  } | null;
  /** Top 10 neighborhoods' share of this month's Luxury (Top 10%) dollar volume, ported from
   * the Quarterly Report's concentration summary. Genuinely null until a future data-pull
   * update computes it — render null-safely, never fabricate a value. */
  top10_concentration: {
    pct_of_luxury_volume: number | null;
    volume: number | null;
    contracts: number | null;
  } | null;
  narrative?: {
    part1_quote?: string | null;
    part2_lede?: string | null;
    part3_lede?: string | null;
    part3_callout?: string | null;
    part4_lede?: string | null;
    part5_lede?: string | null;
    what_this_means?: string | null;
    recommendation?: string | null;
    open_item?: string | null;
    bottom_line?: string | null;
  } | null;
};

export type MonthlyReportRow = {
  month_start: string;
  month_end: string;
  generated_at: string;
  is_provisional: boolean;
  payload: MonthlyReportPayload;
};

/* ─────────── server function ─────────── */

export const getLatestMonthlyReport = createServerFn({ method: "GET" }).handler(
  async (): Promise<MonthlyReportRow | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          order: (col: string, o: { ascending: boolean }) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{ data: MonthlyReportRow | null; error: unknown }>;
            };
          };
        };
      };
    };
    const { data, error } = await client
      .from("monthly_report")
      .select("month_start, month_end, generated_at, is_provisional, payload")
      .order("month_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[monthly_report] load failed:", error);
      return null;
    }
    return data ?? null;
  },
);
