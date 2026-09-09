import { createFileRoute } from "@tanstack/react-router";
import { breadcrumbScriptTag, TRAILS } from "../lib/breadcrumbs";

export const Route = createFileRoute("/report.html")({
  server: {
    handlers: {
      GET: async () => {
        const { default: html } = await import("../reports/report.html?raw");
        // Breadcrumb schema comes from the shared trail source so it stays in
        // sync with the rest of the site. Existing Dataset JSON-LD untouched.
        // These documents have no literal </head>, so anchor on </title>.
        const withCrumbs = html.replace(
          "</title>",
          `</title>${breadcrumbScriptTag(TRAILS.foundational)}`,
        );
        return new Response(withCrumbs, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            // Allowed readers still get an edge-cached copy; blocked bots never
            // reach this handler, so caching costs no enforcement.
            "cache-control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
