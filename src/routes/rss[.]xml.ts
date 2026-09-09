import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { listWeeklyArchive } from "../lib/weekly-archive.functions";
import { getLatestMonthlyReport } from "../lib/monthly-report.functions";

const BASE_URL = "https://domidata.heatherdomi.com";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtLong(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        let weeks: Awaited<ReturnType<typeof listWeeklyArchive>> = [];
        try {
          weeks = await listWeeklyArchive();
        } catch (e) {
          console.error("[rss] archive fetch failed:", e);
        }

        const items = weeks.slice(0, 50).map((w) => {
          const url = `${BASE_URL}/archive/${w.week_start}`;
          const title = `Manhattan Luxury Signed Contracts — Week of ${fmtLong(w.week_start)}`;
          const pubDate = new Date(w.archived_at || w.week_start).toUTCString();
          const count = w.luxury_count ?? null;
          const vol = w.luxury_volume ?? null;
          const desc = [
            count != null ? `${count} luxury signed contracts` : null,
            vol != null ? `$${(vol / 1_000_000).toFixed(1)}M luxury volume` : null,
          ].filter(Boolean).join(" · ") || "Locked weekly snapshot of Manhattan luxury signed-contract activity.";
          return [
            `    <item>`,
            `      <title>${esc(title)}</title>`,
            `      <link>${url}</link>`,
            `      <guid isPermaLink="true">${url}</guid>`,
            `      <pubDate>${pubDate}</pubDate>`,
            `      <description>${esc(desc)}</description>`,
            `    </item>`,
          ].join("\n");
        });

        try {
          const monthly = await getLatestMonthlyReport();
          if (monthly) {
            const url = `${BASE_URL}/monthly`;
            const monthName = new Date(monthly.month_start + "T00:00:00Z").toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            });
            const title = `The Month — Manhattan Luxury, ${monthName}`;
            const desc =
              "Month over month read on Manhattan luxury signed contracts: tier cutoffs, momentum against the trailing three and twelve month averages, supply and absorption, and neighborhood concentration.";
            items.unshift(
              [
                `    <item>`,
                `      <title>${esc(title)}</title>`,
                `      <link>${url}</link>`,
                `      <guid isPermaLink="false">${url}#${monthly.month_start}</guid>`,
                `      <pubDate>${new Date(monthly.generated_at).toUTCString()}</pubDate>`,
                `      <description>${esc(desc)}</description>`,
                `    </item>`,
              ].join("\n"),
            );
          }
        } catch (e) {
          console.error("[rss] monthly fetch failed:", e);
        }

        const lastBuild = weeks[0]?.archived_at
          ? new Date(weeks[0].archived_at).toUTCString()
          : new Date().toUTCString();

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
          `  <channel>`,
          `    <title>Domi Data — Manhattan Luxury Weekly</title>`,
          `    <link>${BASE_URL}/archive</link>`,
          `    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />`,
          `    <description>Weekly Manhattan luxury signed-contract snapshots from Domi Data by Heather Domi.</description>`,
          `    <language>en-us</language>`,
          `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
          ...items,
          `  </channel>`,
          `</rss>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
