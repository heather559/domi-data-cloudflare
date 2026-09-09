import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MonthlyLive } from "./monthly";
import {
  getLatestMonthlyReport,
  type MonthlyReportRow,
} from "../lib/monthly-report.functions";

export const Route = createFileRoute("/monthly-draft")({
  loader: async () => {
    try {
      return await getLatestMonthlyReport();
    } catch (err) {
      console.error("[monthly-draft] loader fell back to client fetch:", err);
      return null;
    }
  },
  head: () => ({
    meta: [
      { title: "The Month Draft · Domi Data" },
      {
        name: "description",
        content: "Unpublished working draft of The Month with current Manhattan luxury market data.",
      },
      { name: "robots", content: "noindex, nofollow, noai, noimageai" },
      { property: "og:title", content: "The Month Draft · Domi Data" },
      {
        property: "og:description",
        content: "Unpublished working draft of The Month with current Manhattan luxury market data.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonthlyDraftPage,
});

function MonthlyDraftPage() {
  const loaded = Route.useLoaderData();
  const fetchRow = useServerFn(getLatestMonthlyReport);
  const [row, setRow] = useState<MonthlyReportRow | null>(loaded ?? null);
  const [loading, setLoading] = useState(!loaded);

  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    void fetchRow()
      .then((result) => {
        if (!cancelled) setRow((result as MonthlyReportRow | null) ?? null);
      })
      .catch((err) => console.error("[monthly-draft] client fetch failed:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, fetchRow]);

  return <MonthlyLive row={row} loading={loading} />;
}