import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAdminRole } from "@/hooks/use-admin-role";
import { getArchivedMonthlyReport } from "@/lib/monthly-archive.functions";
import { archiveCss } from "@/lib/monthly-archive.ui";
import { MonthlyBody } from "@/routes/monthly";

export const Route = createFileRoute("/_authenticated/monthly-archive/$monthStart")({
  head: () => ({
    meta: [
      { title: "Archived month · internal" },
      { name: "description", content: "A frozen edition of the Domi Data monthly report." },
      { name: "robots", content: "noindex, nofollow, noai, noimageai" },
    ],
  }),
  component: ArchivedMonthPage,
});

function ArchivedMonthPage() {
  const { monthStart } = Route.useParams();
  const { state } = useAdminRole();
  const get = useServerFn(getArchivedMonthlyReport);

  const { data, isLoading } = useQuery({
    queryKey: ["monthly-archive", monthStart],
    queryFn: () => get({ data: { monthStart } }),
    enabled: state === "admin",
  });

  if (state === "loading" || isLoading) {
    return (
      <main className="internal-index">
        <p className="lede">Loading…</p>
        <style>{archiveCss}</style>
      </main>
    );
  }
  if (state === "denied") {
    return (
      <main className="internal-index">
        <h1>Access restricted</h1>
        <p className="lede">This page requires an admin account.</p>
        <style>{archiveCss}</style>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="internal-index">
        <h1>Not archived</h1>
        <p className="lede">
          No frozen edition exists for {monthStart}.{" "}
          <Link to="/monthly-archive">Back to the archive index</Link>
        </p>
        <style>{archiveCss}</style>
      </main>
    );
  }

  return <MonthlyBody row={data} />;
}
