import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { listWeeklyArchive } from "../lib/weekly-archive.functions";
import { listBriefs } from "../lib/briefs.data";
import { NEIGHBORHOOD_BANNERS } from "../lib/neighborhood-banners";
import { ROUTE_IMAGES, type SiteImage } from "../lib/site-images";

const BASE_URL = "https://domidata.heatherdomi.com";

interface SitemapEntry {
  path: string;
  /** Only ever a page-specific date from that page's own data. Never a build stamp. */
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  images?: SiteImage[];
}

/** Neighborhoods with a published report page, whether or not they carry a banner. */
const NEIGHBORHOOD_SLUGS = [
  "tribeca",
  "upper-east-side",
  "west-village",
  "upper-west-side",
  "lenox-hill",
  "midtown",
  "lincoln-square",
  "greenwich-village",
  "west-chelsea",
  "soho",
];

/** Banner map is keyed by lowercased geo name; the route uses the dashed slug. */
const bannerBySlug = new Map(
  Object.entries(NEIGHBORHOOD_BANNERS).map(([geo, b]) => [
    geo.replace(/\s+/g, "-"),
    { url: b.asset.url, caption: b.alt } satisfies SiteImage,
  ]),
);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const absolute = (url: string) => (url.startsWith("http") ? url : `${BASE_URL}${url}`);

/** YYYY-MM-DD or YYYY-MM, both valid W3C datetimes for <lastmod>. */
function isoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as {
          from: (t: string) => any;
        };

        // ── Page-specific timestamps, pulled from each page's own record ──
        let weekLastmod: string | undefined;
        let monthLastmod: string | undefined;
        const neighborhoodLastmod = new Map<string, string>();

        try {
          const { data } = await db
            .from("weekly_report")
            .select("week_end")
            .order("week_start", { ascending: false })
            .limit(1)
            .maybeSingle();
          weekLastmod = isoDate(data?.week_end);
        } catch (e) {
          console.error("[sitemap] weekly lastmod failed:", e);
        }

        try {
          const { data } = await db
            .from("monthly_report")
            .select("month_end")
            .order("month_start", { ascending: false })
            .limit(1)
            .maybeSingle();
          monthLastmod = isoDate(data?.month_end);
        } catch (e) {
          console.error("[sitemap] monthly lastmod failed:", e);
        }

        try {
          const { data } = await db
            .from("neighborhood_monthly_report")
            .select("neighborhood_slug, period")
            .order("period", { ascending: true });
          for (const row of (data ?? []) as Array<{ neighborhood_slug: string; period: string }>) {
            const d = isoDate(row.period);
            if (d) neighborhoodLastmod.set(row.neighborhood_slug, d); // ascending → last wins
          }
        } catch (e) {
          console.error("[sitemap] neighborhood lastmod failed:", e);
        }

        const latestNeighborhood = [...neighborhoodLastmod.values()].sort().pop();

        const entries: SitemapEntry[] = [
          // Homepage leads with the weekly read, so it carries the weekly date.
          { path: "/", lastmod: weekLastmod, changefreq: "weekly", priority: "1.0", images: ROUTE_IMAGES["/"] },
          { path: "/this-week", lastmod: weekLastmod, changefreq: "weekly", priority: "0.9" },
          { path: "/monthly", lastmod: monthLastmod, changefreq: "monthly", priority: "0.8" },
          { path: "/neighborhoods", lastmod: latestNeighborhood, changefreq: "weekly", priority: "0.8" },
          { path: "/briefs", changefreq: "monthly", priority: "0.6" },

          { path: "/archive", lastmod: weekLastmod, changefreq: "weekly", priority: "0.7" },
          // Evergreen pages: no per-record date exists, so no lastmod is claimed.
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/buy-sell", changefreq: "monthly", priority: "0.6" },
          { path: "/contact", changefreq: "monthly", priority: "0.5" },
          { path: "/accessibility", changefreq: "yearly", priority: "0.3" },
          { path: "/report.html", changefreq: "monthly", priority: "0.8" },
          { path: "/quarterly-brief.html", changefreq: "monthly", priority: "0.8" },
        ];

        // Every slug with a report page, plus any newly bannered neighborhood.
        const slugs = [...new Set([...NEIGHBORHOOD_SLUGS, ...bannerBySlug.keys()])];
        for (const slug of slugs) {
          const banner = bannerBySlug.get(slug);
          entries.push({
            path: `/neighborhoods/${slug}`,
            lastmod: neighborhoodLastmod.get(slug),
            changefreq: "weekly",
            priority: "0.7",
            images: banner ? [banner] : undefined,
          });
        }

        for (const b of listBriefs()) {
          entries.push({ path: `/briefs/${b.slug}`, lastmod: b.date, changefreq: "yearly", priority: "0.7" });
        }

        try {
          const weeks = await listWeeklyArchive();
          for (const w of weeks) {
            // The archived week's own date, not when the snapshot was written.
            entries.push({
              path: `/archive/${w.week_start}`,
              lastmod: isoDate(w.week_start),
              changefreq: "never",
              priority: "0.5",
            });
          }
        } catch (e) {
          console.error("[sitemap] archive fetch failed:", e);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            ...(e.images ?? []).map((img) =>
              [
                `    <image:image>`,
                `      <image:loc>${esc(absolute(img.url))}</image:loc>`,
                `      <image:caption>${esc(img.caption)}</image:caption>`,
                `    </image:image>`,
              ].join("\n"),
            ),
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
