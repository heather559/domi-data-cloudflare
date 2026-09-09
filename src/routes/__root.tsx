import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

const GA_MEASUREMENT_ID = "G-B4RM7TNM38";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

import appCss from "../styles.css?url";
import ogCardAsset from "../assets/domi-data-og-card.jpg.asset.json";

// Sitewide default share card (1200x630). Any route that sets its own
// og:image/twitter:image overrides this, since meta entries merge by key.
const OG_IMAGE = `https://domidata.heatherdomi.com${ogCardAsset.url}`;
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AgentChat } from "../components/agent-chat";
import { InstallPrompt } from "../components/install-prompt";
import { A11yPrefs } from "../components/a11y-prefs";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">

      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Domi Data: A new lens on Manhattan luxury." },
      { name: "description", content: "Weekly and quarterly research on Manhattan luxury signed contracts. Data powered by Marketproof, published by Heather Domi." },
      { name: "author", content: "Heather Domi" },
      { property: "og:title", content: "Domi Data: A new lens on Manhattan luxury." },
      { property: "og:description", content: "Weekly and quarterly research on Manhattan luxury signed contracts. Data powered by Marketproof, published by Heather Domi." },
      { property: "og:site_name", content: "Domi Data" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Domi Data share card: the Manhattan skyline at sunrise behind the headline A new lens on Manhattan luxury." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "theme-color", content: "#0f0f0f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Domi Data" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "alternate", type: "application/rss+xml", title: "Domi Data — Manhattan Luxury Weekly", href: "/rss.xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500&display=swap" },
      // Preload the two most-used Ivy Mode weights above the fold (Regular 400, Light 300).
      { rel: "preload", as: "font", type: "font/ttf", crossOrigin: "anonymous",
        href: "/assets/fonts/IvyMode-Regular.ttf" },
      { rel: "preload", as: "font", type: "font/ttf", crossOrigin: "anonymous",
        href: "/assets/fonts/IvyMode-Light.ttf" },

    ],
    scripts: [
      {
        src: `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`,
        async: true,
      },
      {
        children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:false,content_group:'Domi Data'});`,
      },
      {
        id: "hs-script-loader",
        src: "//js.hs-scripts.com/50792006.js",
        async: true,
        defer: true,
      },
      {
        src: "https://analytics.ahrefs.com/analytics.js",
        "data-key": "b39Bu5dQeMCvEb3rHwXGXg",
        async: true,
      } as unknown as Record<string, unknown>,
      {
        children: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","xts9izdd10");`,
      },
      {
        src: "https://challenges.cloudflare.com/turnstile/v0/api.js",
        async: true,
        defer: true,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Domi Data",
          alternateName: "Domi Data by Heather Domi",
          url: "https://domidata.heatherdomi.com",
          logo: "https://domidata.heatherdomi.com/favicon-512.png",
          description: "Weekly and quarterly research on Manhattan luxury signed contracts. Data powered by Marketproof, published by Heather Domi.",
          founder: {
            "@type": "Person",
            name: "Heather Domi",
            jobTitle: "Licensed Real Estate Salesperson",
            worksFor: { "@type": "Organization", name: "Douglas Elliman" },
            url: "https://heatherdomi.com",
          },
          sameAs: ["https://heatherdomi.com"],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Domi Data",
          url: "https://domidata.heatherdomi.com",
          publisher: { "@type": "Organization", name: "Domi Data" },
          potentialAction: {
            "@type": "SearchAction",
            target: "https://domidata.heatherdomi.com/archive?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const unsub = router.subscribe("onResolved", () => {
      if (typeof window.gtag === "function") {
        window.gtag("event", "page_view", {
          page_path: window.location.pathname + window.location.search,
          page_location: window.location.href,
          page_title: document.title,
        });
      }
    });
    return () => unsub();
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <AgentChat />
      <InstallPrompt />
      <A11yPrefs />
    </QueryClientProvider>
  );
}
