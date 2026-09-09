import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/briefs")({
  component: () => <Outlet />,
});
