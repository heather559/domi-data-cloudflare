import { createServerFn } from "@tanstack/react-start";

const SEMRUSH_ANALYTICS = "https://api.semrush.com/";
const SEMRUSH_BACKLINKS = "https://api.semrush.com/analytics/v1/";
const DOMAIN = "domidata.heatherdomi.com";
const ROOT_DOMAIN = "heatherdomi.com";
const DB = "us";

// Backlink endpoints reject requests that omit export_columns (HTTP 400).
const BL_OVERVIEW_COLUMNS =
  "ascore,total,domains_num,urls_num,ips_num,follows_num,nofollows_num,texts_num";

type SemrushTable = { columnNames: string[]; rows: string[][] };

async function callSemrush(
  path: string,
  params: Record<string, string | number | undefined>,
  allowLimit = false,
): Promise<SemrushTable> {
  const key = process.env.SEMRUSH_API_KEY;
  if (!key) {
    throw new Error("SEMRUSH_API_KEY missing on server");
  }
  // Derive the SEMrush `type` from the path segment (e.g. "/backlinks/backlinks_overview" → "backlinks_overview")
  const type = path.split("/").filter(Boolean).pop() ?? path;
  const isBacklinks = path.startsWith("/backlinks/");
  const base = isBacklinks ? SEMRUSH_BACKLINKS : SEMRUSH_ANALYTICS;

  const qs = new URLSearchParams();
  qs.set("type", type);
  qs.set("key", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const headers: Record<string, string> = {};
  if (allowLimit) headers["Allow-Limit-Offset"] = "true";

  const res = await fetch(`${base}?${qs.toString()}`, { headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Semrush ${path} failed [${res.status}]: ${text.slice(0, 300)}`);
  }

  // SEMrush returns semicolon-delimited text; first row is column headers matching export_columns
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return { columnNames: [], rows: [] };
  const columnNames = (lines[0] ?? "").split(";").map((c) => c.trim());
  const rows = lines.slice(1).map((line) => line.split(";").map((c) => c.trim()));
  return { columnNames, rows };
}

// The gateway returns human-readable column headers ("Organic Keywords") rather
// than the short export codes ("Or") that were requested. Map both forms onto
// the codes so downstream lookups work regardless of which style comes back.
const COLUMN_ALIASES: Record<string, string> = {
  rank: "Rk",
  "organic keywords": "Or",
  "organic traffic": "Ot",
  "organic cost": "Oc",
  "adwords keywords": "Ad",
  date: "Dt",
};

function tableToObjects(t: SemrushTable): Record<string, string>[] {
  return t.rows.map((row) => {
    const obj: Record<string, string> = {};
    t.columnNames.forEach((c, i) => {
      obj[c] = row[i];
      const alias = COLUMN_ALIASES[c.trim().toLowerCase()];
      if (alias) obj[alias] = row[i];
    });
    return obj;
  });
}


export type SemrushDashboard = {
  fetchedAt: string;
  domain: string;
  overview: {
    rank: number | null;
    organicKeywords: number | null;
    organicTraffic: number | null;
    organicCost: number | null;
    adwordsKeywords: number | null;
  } | null;
  trend: { month: string; keywords: number; traffic: number; cost: number }[];
  backlinks: {
    total: number | null;
    referringDomains: number | null;
    referringIps: number | null;
    authorityScore: number | null;
    followRatio: number | null;
  } | null;
  topRefDomains: { domain: string; score: number; backlinks: number }[];
  topAnchors: { anchor: string; backlinks: number; domains: number }[];
  competitors: {
    label: string;
    domain: string;
    organicKeywords: number | null;
    organicTraffic: number | null;
    organicCost: number | null;
    authorityScore: number | null;
    referringDomains: number | null;
  }[];
  quotaExhausted: boolean;
  errors: string[];
};

const TRACKED: { label: string; domain: string }[] = [
  { label: "Domi Data (root)", domain: ROOT_DOMAIN },
  { label: "Olshan Report", domain: "olshan.com" },
  { label: "Miller Samuel / Housing Notes", domain: "millersamuel.com" },
];

export const getSemrushDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<SemrushDashboard> => {
    const errors: string[] = [];
    let quotaExhausted = false;

    const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/TOTAL LIMIT EXCEEDED|quota|403/i.test(msg)) quotaExhausted = true;
        errors.push(`${label}: ${msg}`);
        return fallback;
      }
    };

    const overview = await safe(
      "overview",
      async () => {
        const t = await callSemrush("/domains/domain_ranks", {
          domain: DOMAIN,
          database: DB,
          export_columns: "Rk,Or,Ot,Oc,Ad",
        });
        const row = tableToObjects(t)[0];
        if (!row) return null;
        return {
          rank: num(row.Rk),
          organicKeywords: num(row.Or),
          organicTraffic: num(row.Ot),
          organicCost: num(row.Oc),
          adwordsKeywords: num(row.Ad),
        };
      },
      null,
    );

    // Fall back to root domain for trend/backlinks when the subdomain is too new.
    const trendDomain = overview && overview.organicKeywords ? DOMAIN : ROOT_DOMAIN;

    const trend = await safe(
      "trend",
      async () => {
        const t = await callSemrush("/domains/domain_rank_history", {
          domain: trendDomain,
          database: DB,
          export_columns: "Rk,Or,Ot,Oc,Dt",
        }, true);
        return tableToObjects(t)
          .map((r) => ({
            month: r.Dt ?? "",
            keywords: num(r.Or) ?? 0,
            traffic: num(r.Ot) ?? 0,
            cost: num(r.Oc) ?? 0,
          }))
          .filter((r) => r.month)
          // The feed arrives newest first; sort oldest to newest so the chart
          // reads left to right and the last 12 months are the recent ones.
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-12);

      },
      [],
    );

    const backlinks = await safe(
      "backlinks",
      async () => {
        const t = await callSemrush("/backlinks/backlinks_overview", {
          target: trendDomain,
          target_type: "root_domain",
          export_columns: BL_OVERVIEW_COLUMNS,
        });
        const row = tableToObjects(t)[0];
        if (!row) return null;
        const total = num(row.total) ?? num(row.backlinks_num);
        const follow = num(row.follows_num) ?? num(row.follows);
        return {
          total,
          referringDomains: num(row.domains_num) ?? num(row.referring_domains),
          referringIps: num(row.ips_num) ?? num(row.referring_ips),
          authorityScore: num(row.ascore) ?? num(row.authority_score),
          followRatio: total && follow != null ? follow / total : null,
        };
      },
      null,
    );

    const topRefDomains = await safe(
      "refdomains",
      async () => {
        const t = await callSemrush("/backlinks/backlinks_refdomains", {
          target: trendDomain,
          target_type: "root_domain",
          display_limit: 10,
          export_columns: "domain_ascore,domain,backlinks_num",
        });
        return tableToObjects(t)
          .map((r) => ({
            domain: r.domain ?? "",
            score: num(r.domain_ascore) ?? num(r.ascore) ?? 0,
            backlinks: num(r.backlinks_num) ?? 0,
          }))
          .filter((r) => r.domain);
      },
      [],
    );

    const topAnchors = await safe(
      "anchors",
      async () => {
        const t = await callSemrush("/backlinks/backlinks_anchors", {
          target: trendDomain,
          target_type: "root_domain",
          display_limit: 10,
          export_columns: "anchor,domains_num,backlinks_num",
        });

        return tableToObjects(t)
          .map((r) => ({
            anchor: r.anchor ?? "",
            backlinks: num(r.backlinks_num) ?? 0,
            domains: num(r.domains_num) ?? 0,
          }))
          .filter((r) => r.anchor);
      },
      [],
    );

    const competitors = await safe(
      "competitors",
      async () =>
        Promise.all(
          TRACKED.map(async (c) => {
            const base = { label: c.label, domain: c.domain };
            const ranks = await safe(
              `competitor ${c.domain} ranks`,
              async () => {
                const t = await callSemrush("/domains/domain_ranks", {
                  domain: c.domain,
                  database: DB,
                  export_columns: "Rk,Or,Ot,Oc",
                });
                return tableToObjects(t)[0] ?? null;
              },
              null,
            );
            const bl = await safe(
              `competitor ${c.domain} backlinks`,
              async () => {
                const t = await callSemrush("/backlinks/backlinks_overview", {
                  target: c.domain,
                  target_type: "root_domain",
                  export_columns: BL_OVERVIEW_COLUMNS,
                });

                return tableToObjects(t)[0] ?? null;
              },
              null,
            );
            return {
              ...base,
              organicKeywords: ranks ? num(ranks.Or) : null,
              organicTraffic: ranks ? num(ranks.Ot) : null,
              organicCost: ranks ? num(ranks.Oc) : null,
              authorityScore: bl ? (num(bl.ascore) ?? num(bl.authority_score)) : null,
              referringDomains: bl ? (num(bl.domains_num) ?? num(bl.referring_domains)) : null,
            };
          }),
        ),
      [],
    );

    return {
      fetchedAt: new Date().toISOString(),
      domain: DOMAIN,
      overview,
      trend,
      backlinks,
      topRefDomains,
      topAnchors,
      competitors,
      quotaExhausted,
      errors,
    };
  },
);

function num(v: string | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
