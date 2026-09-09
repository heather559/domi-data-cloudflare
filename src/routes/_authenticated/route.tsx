import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Pathless gate for internal routes. Client-only because the Supabase session
// lives in localStorage, which the server cannot read.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
