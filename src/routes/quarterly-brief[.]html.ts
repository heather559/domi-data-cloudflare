import { createFileRoute } from "@tanstack/react-router";
import { breadcrumbScriptTag, TRAILS } from "../lib/breadcrumbs";

export const Route = createFileRoute("/quarterly-brief.html")({
  server: {
    handlers: {
      GET: async () => {
        const { default: html } = await import("../reports/quarterly-brief.html?raw");
        // Shared trail source; anchored on </title> since these documents
        // contain no literal </head>.
        const withCrumbs = html.replace(
          "</title>",
          `</title>${breadcrumbScriptTag(TRAILS.quarterly)}`,
        );
        return new Response(withCrumbs, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
