import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/neighborhoods/$slug/archive")({
  component: () => <Outlet />,
});
