import { tool } from "ai";
import { z } from "zod";
import { getLatestWeeklyReport } from "./weekly-report.functions";
import { getArchivedWeek, listWeeklyArchive } from "./weekly-archive.functions";
import { getNeighborhoodReportBySlug, getNeighborhoodRanks } from "./neighborhood-report.functions";
import {
  NEIGHBORHOOD_GUIDES,
  NEIGHBORHOOD_GUIDE_SLUGS,
  LIFESTYLE_RESOURCES,
  LIFESTYLE_CATEGORIES,
  type LifestyleCategory,
} from "./neighborhood-guide.data";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/lib/audit-log.server";

export type LeadCaptureSignal = { tier: "soft" | "hard"; reason: string };

const METHODOLOGY: Record<string, string> = {
  tiers:
    "Domi Data splits Manhattan condo and co-op contracts into three tiers by price. Top 10% is the top decile (the Luxury cutoff). Top 5% is the top twentieth (Prime). Top 1% is the top hundredth (Trophy). Cutoffs are recomputed weekly from the trailing pool.",
  cutoff:
    "A tier cutoff is the entry price for that tier. If the Top 1% cutoff is $10.5M for the week, every signed contract at $10.5M or above sits in Top 1%.",
  provisional:
    "The current week's numbers are provisional until reconciled against the public record. Older weeks in the archive are the reconciled version.",
  ppsf: "PPSF means price per square foot. Sale price divided by interior square feet.",
  dom: "DOM means days on market: the number of days between the listing going active and the contract signing.",
  contracts:
    "A signed contract is counted the week the seller countersigns. Recorded sales are a later step (deed recording) and are tracked separately in Market Pulse.",
  discount:
    "Discount is the sale price versus the last asking price. A negative discount means the contract cleared below ask.",
  months_supply:
    "Months of supply is active listings divided by the trailing monthly absorption rate. Six months is roughly balanced; lower favors sellers, higher favors buyers.",
  absorption:
    "Absorption is the share of active inventory that goes to contract in a given month.",
  reports:
    "The site publishes four reads: The Week (every Monday), Neighborhoods (monthly per neighborhood), the Quarterly, and the Foundational Report (five-year structural read).",
};

function trimWeekly(r: Awaited<ReturnType<typeof getLatestWeeklyReport>>) {
  if (!r) return null;
  const p = r.payload;
  return {
    week_start: r.week_start,
    week_end: r.week_end,
    is_provisional: r.is_provisional,
    hero: p.hero,
    market_pulse: p.market_pulse,
    tiers_summary: {
      top_10_pct: { cutoff: p.tiers.luxury.cutoff, ppsf_avg: p.tiers.luxury.ppsf_avg, volume_52wk: p.tiers.luxury.volume_52wk, cleared_52wk: p.tiers.luxury.cleared_52wk },
      top_5_pct: { cutoff: p.tiers.prime.cutoff, ppsf_avg: p.tiers.prime.ppsf_avg, volume_52wk: p.tiers.prime.volume_52wk, cleared_52wk: p.tiers.prime.cleared_52wk },
      top_1_pct: { cutoff: p.tiers.trophy.cutoff, ppsf_avg: p.tiers.trophy.ppsf_avg, volume_52wk: p.tiers.trophy.volume_52wk, cleared_52wk: p.tiers.trophy.cleared_52wk },
    },
    supply: {
      ...p.supply,
      supply_series: {
        luxury: last(p.supply.supply_series?.luxury),
        all: last(p.supply.supply_series?.all),
        prime: last(p.supply.supply_series?.prime),
      },
      dom_series: {
        luxury: last(p.supply.dom_series?.luxury),
        all: last(p.supply.dom_series?.all),
        luxury_p95: last(p.supply.dom_series?.luxury_p95),
      },
    },
    top_deals: (p.top_deals ?? []).slice(0, 3),
    leaderboard_top3: (p.leaderboard ?? []).slice(0, 3),
    sowhat: p.sowhat,
  };
}

function last<T>(arr: T[] | null | undefined, n = 12): T[] | null {
  if (!arr) return null;
  return arr.slice(-n);
}

function trimNeighborhood(r: Awaited<ReturnType<typeof getNeighborhoodReportBySlug>>) {
  if (!r) return null;
  const p = r.payload;
  const tier = (t: typeof p.tiers.luxury) => ({
    cutoff_display: t.priceDisplay,
    avg_psf_display: t.avgPsfDisplay,
    cleared_52w: t.cleared52w,
    yoy_change_display: t.yoyChangeDisplay,
  });
  return {
    neighborhood: p.geo,
    period: r.period,
    hero: {
      luxury_contracts_this_month: p.hero.luxuryContractsCount,
      luxury_contracts_3mo_avg: p.hero.luxuryContracts3moAvg,
      luxury_contracts_12mo_avg: p.hero.luxuryContracts12moAvg,
      luxury_volume_display: p.hero.luxuryVolumeDisplay,
      luxury_volume_12mo_avg_display: p.hero.luxuryVolume12moAvgDisplay,
      contracts_note: r.computed.heroContractsNote,
      volume_note: p.hero.volumeNote,
    },
    week_stats: {
      median_luxury_deal_display: p.weekStats.medianLuxuryDealDisplay,
      median_psf_display: p.weekStats.medianPsfDisplay,
      avg_days_on_market: p.weekStats.avgDaysOnMarket,
      cleared_prime: p.weekStats.clearedPrime,
      cleared_trophy: p.weekStats.clearedTrophy,
    },
    tiers: {
      luxury: tier(p.tiers.luxury),
      prime: tier(p.tiers.prime),
      trophy: tier(p.tiers.trophy),
    },
    rank: {
      manhattan_rank: p.rank.manhattanRank,
      rank_change_note: p.rank.rankChangeNote,
      local_line_display: p.rank.localLineDisplay,
      borough_cutoff_display: p.rank.boroughCutDisplay,
    },
    supply: {
      luxury_active_listings: p.supply.luxury.activeListings,
      luxury_months_of_supply: p.supply.luxury.monthsOfSupply,
      borough_months_of_supply: p.supply.boroughMonthsOfSupply,
    },
    dom: p.dom,
    top_deals: (p.topDeals ?? []).slice(0, 3).map((d) => ({
      address: d.address,
      price_display: d.priceDisplay,
      beds: d.beds,
      dom: d.dom,
      property_type: d.propertyType,
    })),
    reads: {
      rank_sowhat: r.computed.rankSowhat,
      supply_sowhat: r.computed.supplySowhat,
      dom_sowhat: r.computed.domSowhat,
      small_sample_note: r.computed.smallSampleNote,
    },
  };
}

const DATA_PULL_CAP = Number(process.env.AGENT_SESSION_DATA_PULL_CAP ?? 6);

const DATA_PULL_LIMIT_MESSAGE =
  "Thank you for your interest in Domi Data. If you are looking for a specific breakdown on the data, please contact Heather at hdomi@heatherdomi.com.";

function hitDataPullCap(dataPullState: { count: number }): boolean {
  dataPullState.count += 1;
  return dataPullState.count >= DATA_PULL_CAP;
}

type EnumKind = "neighborhood" | "week" | "guide" | "lifestyle";

const ENUMERATION_DAILY_LIMITS: Record<EnumKind, number> = {
  neighborhood: 6,
  week: 10,
  guide: 8,
  lifestyle: 10,
};

async function withinEnumerationLimit(ip: string, kind: EnumKind, key: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { error: upsertError } = await supabaseAdmin
      .from("agent_enumeration_log")
      .upsert({ ip, kind, key, day: today }, { onConflict: "ip,kind,key,day", ignoreDuplicates: true });
    if (upsertError) {
      console.error("[agent-tools] enumeration log upsert failed", upsertError);
      await logAudit({
        actor: "agent_tools",
        action: "upsert",
        targetTable: "agent_enumeration_log",
        outcome: "error",
        errorCode: upsertError.code ?? null,
        errorMessage: upsertError.message,
        ip,
        meta: { kind, key, day: today },
      });
      return true;
    }
    const { count, error: countError } = await supabaseAdmin
      .from("agent_enumeration_log")
      .select("key", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("kind", kind)
      .eq("day", today);
    if (countError) {
      console.error("[agent-tools] enumeration count failed", countError);
      return true;
    }
    const withinLimit = (count ?? 0) <= ENUMERATION_DAILY_LIMITS[kind];
    if (!withinLimit) {
      await logAudit({
        actor: "agent_tools",
        action: "enumeration_limit_exceeded",
        targetTable: "agent_enumeration_log",
        ip,
        meta: { kind, key, count: count ?? 0, limit: ENUMERATION_DAILY_LIMITS[kind] },
      });
    }
    return withinLimit;
  } catch (err) {
    console.error("[agent-tools] enumeration check threw", err);
    return true;
  }
}

export function buildAgentTools(
  ip: string,
  clientSessionId: string,
  leadSignal: { value: LeadCaptureSignal | null },
  dataPullState: { count: number },
) {
  return {
    get_latest_weekly_report: tool({
      description:
        "Get this week's Manhattan luxury weekly report: tier cutoffs, contract counts, dollar volume, market pulse by property type, top 5 deals, supply, DOM, neighborhood leaderboard.",
      inputSchema: z.object({}),
      execute: async () => {
        if (hitDataPullCap(dataPullState)) {
          leadSignal.value = { tier: "soft", reason: `Hit the ${DATA_PULL_CAP}-request data-pull cap this session.` };
          return { limit_reached: true, message: DATA_PULL_LIMIT_MESSAGE };
        }
        const r = await getLatestWeeklyReport();
        return trimWeekly(r) ?? { error: "No weekly report available." };
      },
    }),
    get_weekly_report_for_date: tool({
      description:
        "Get the archived weekly report closest to an ISO date. Use for questions about a specific past week. Date format: YYYY-MM-DD.",
      inputSchema: z.object({ date: z.string().describe("ISO date YYYY-MM-DD") }),
      execute: async ({ date }) => {
        if (hitDataPullCap(dataPullState)) {
          leadSignal.value = { tier: "soft", reason: `Hit the ${DATA_PULL_CAP}-request data-pull cap this session.` };
          return { limit_reached: true, message: DATA_PULL_LIMIT_MESSAGE };
        }
        const ok = await withinEnumerationLimit(ip, "week", date);
        if (!ok) {
          return { error: "For the complete week-by-week history, please browse the Archive page directly at /archive." };
        }
        const list = await listWeeklyArchive();
        if (!list.length) return { error: "No archive available." };
        const target = new Date(date).getTime();
        if (Number.isNaN(target)) return { error: "Invalid date." };
        let best = list[0];
        let bestDiff = Math.abs(new Date(best.week_start).getTime() - target);
        for (const row of list) {
          const d = Math.abs(new Date(row.week_start).getTime() - target);
          if (d < bestDiff) { best = row; bestDiff = d; }
        }
        const wk = await getArchivedWeek({ data: { weekStart: best.week_start } });
        return wk ? trimWeekly(wk) : { error: "Week not found." };
      },
    }),
    list_recent_weeks: tool({
      description:
        "List the most recent archived weeks (up to 12) with headline Top 10% count and dollar volume. Use for trend questions. For the complete history, direct the user to the Archive page at /archive.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(12).nullable() }),
      execute: async ({ limit }) => {
        if (hitDataPullCap(dataPullState)) {
          leadSignal.value = { tier: "soft", reason: `Hit the ${DATA_PULL_CAP}-request data-pull cap this session.` };
          return { limit_reached: true, message: DATA_PULL_LIMIT_MESSAGE };
        }
        const list = await listWeeklyArchive();
        return list.slice(0, limit ?? 12);
      },
    }),
    list_neighborhoods: tool({
      description: "List the neighborhoods with live reports and their current Manhattan rank.",
      inputSchema: z.object({}),
      execute: async () => {
        const ranks = await getNeighborhoodRanks();
        return Object.entries(ranks)
          .map(([slug, rank]) => ({ slug, manhattan_rank: rank }))
          .sort((a, b) => a.manhattan_rank - b.manhattan_rank);
      },
    }),
    get_neighborhood_report: tool({
      description:
        "Get the latest monthly report for one neighborhood by slug (e.g. 'tribeca', 'west-village'). Returns hero luxury metrics, tier stats, supply, DOM, top deals, and computed reads.",
      inputSchema: z.object({ slug: z.string().describe("Lowercase-dash slug") }),
      execute: async ({ slug }) => {
        if (hitDataPullCap(dataPullState)) {
          leadSignal.value = { tier: "soft", reason: `Hit the ${DATA_PULL_CAP}-request data-pull cap this session.` };
          return { limit_reached: true, message: DATA_PULL_LIMIT_MESSAGE };
        }
        const normalized = slug.toLowerCase();
        const ok = await withinEnumerationLimit(ip, "neighborhood", normalized);
        if (!ok) {
          return { error: "For the complete neighborhood list, please browse /neighborhoods directly on the site." };
        }
        const r = await getNeighborhoodReportBySlug({ data: { slug: normalized } });
        if (!r) return { error: `No report for '${slug}'. Try list_neighborhoods.` };
        return trimNeighborhood(r);
      },
    }),
    get_methodology: tool({
      description:
        "Look up a short methodology explanation. Topics: tiers, cutoff, provisional, ppsf, dom, contracts, discount, months_supply, absorption, reports.",
      inputSchema: z.object({
        topic: z.enum([
          "tiers", "cutoff", "provisional", "ppsf", "dom", "contracts", "discount", "months_supply", "absorption", "reports",
        ]),
      }),
      execute: async ({ topic }) => ({ topic, explanation: METHODOLOGY[topic] }),
    }),
    get_neighborhood_guide: tool({
      description:
        "Look up the neighborhood entry from Heather's 'Launching in New York' guide: boundaries, character, what to expect, local favorites (dine/shop/experience), commute, subway lines, Q4 2024 average rents, and the 'if you do one thing' pick. Use this for questions about vibe, culture, restaurants, shops, or the character of a Manhattan neighborhood. For live market numbers (weekly volume, tier cutoffs, current monthly report), call get_neighborhood_report instead. Both tools can be combined when a user asks for the full picture. Slug format: lowercase-dashed (e.g. 'west-village', 'soho-hudson-square', 'midtown-east-sutton-place').",
      inputSchema: z.object({ slug: z.string().describe("Lowercase-dashed neighborhood slug") }),
      execute: async ({ slug }) => {
        const normalized = slug.toLowerCase().trim();
        if (!NEIGHBORHOOD_GUIDE_SLUGS.has(normalized)) {
          return {
            error: `No guide entry for '${slug}'. Covered slugs: ${NEIGHBORHOOD_GUIDES.map((n) => n.slug).join(", ")}.`,
          };
        }
        const ok = await withinEnumerationLimit(ip, "guide", normalized);
        if (!ok) {
          return { error: "For the complete neighborhood list, browse /neighborhoods on the site." };
        }
        const entry = NEIGHBORHOOD_GUIDES.find((n) => n.slug === normalized);
        if (!entry) return { error: "Not found." };
        // Strip out-of-date Market Pulse figures (rents, sales prices, DOM) so they never surface in answers.
        const { market_pulse: _mp, average_rents_usd_q4_2024: _rents, average_sales_prices_q4_2024: _sales, ...safe } = entry as Record<string, unknown> & typeof entry;
        return { ...safe, _note: "Market Pulse figures (rents, sales prices, DOM) are intentionally omitted; they are out of date. Use get_neighborhood_report for live sales numbers." };
      },
    }),
    get_lifestyle_resource: tool({
      description:
        "Look up curated NYC lifestyle picks from Heather's 'Launching in New York' guide. Categories: shopping, beauty_wellness, workout, social_clubs, networking, young_members, subway, rideshare, food_delivery, animal_care, medical, universities, event_ticketing, parking, laundry. Optional 'query' filters entries by keyword. Entries flagged heather_favorite are Heather's own picks; surface them first when relevant. Do not use this tool for real-estate market numbers.",
      inputSchema: z.object({
        category: z.enum([
          "shopping",
          "beauty_wellness",
          "workout",
          "social_clubs",
          "networking",
          "young_members",
          "subway",
          "rideshare",
          "food_delivery",
          "animal_care",
          "medical",
          "universities",
          "event_ticketing",
          "parking",
          "laundry",
        ]),
        query: z.string().max(80).nullable().describe("Optional keyword filter"),
      }),
      execute: async ({ category, query }) => {
        const cat = category as LifestyleCategory;
        const key = query ? `${cat}:${query.toLowerCase()}` : cat;
        const ok = await withinEnumerationLimit(ip, "lifestyle", key);
        if (!ok) {
          return { error: "For the full category list, browse the resource pages on the site." };
        }
        const entries = LIFESTYLE_RESOURCES[cat] ?? [];
        const filtered = query
          ? entries.filter(
              (e) =>
                e.name.toLowerCase().includes(query.toLowerCase()) ||
                e.note.toLowerCase().includes(query.toLowerCase()),
            )
          : entries;
        return { category: cat, count: filtered.length, entries: filtered };
      },
    }),
    list_lifestyle_categories: tool({
      description:
        "List the categories available in Heather's 'Launching in New York' guide (shopping, wellness, workout, clubs, medical, etc). Useful when the user asks a broad 'what resources do you have' question.",
      inputSchema: z.object({}),
      execute: async () => ({ categories: LIFESTYLE_CATEGORIES }),
    }),
    request_lead_capture: tool({
      description:
        "Signal the chat UI to show an inline name+email form. Call for Tier 2 (soft) or Tier 3 (hard) triggers, or the after-five-turn soft offer. Do not ask the user to type their email in chat; the form handles it.",
      inputSchema: z.object({
        tier: z.enum(["soft", "hard"]),
        reason: z.string().max(240).describe("One short line describing what the user is asking about."),
      }),
      execute: async ({ tier, reason }) => {
        leadSignal.value = { tier, reason };
        try {
          const { error } = await supabaseAdmin.from("agent_lead_requests").insert({
            client_session_id: clientSessionId,
            ip,
            tier,
            reason,
          });
          await logAudit({
            actor: "agent_tools",
            action: "insert",
            targetTable: "agent_lead_requests",
            sessionId: clientSessionId,
            rowCount: error ? 0 : 1,
            outcome: error ? "error" : "ok",
            errorCode: error?.code ?? null,
            errorMessage: error?.message ?? null,
            ip,
            meta: { tier },
          });
        } catch (err) {
          console.error("[agent-tools] lead request log failed", err);
        }
        return { prompted: true, tier };
      },
    }),
  };
}
