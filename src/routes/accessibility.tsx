import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";

const TITLE = "Accessibility — Domi Data · Heather Domi";
const DESC =
  "How Domi Data approaches accessibility: the standard we target, what conforms today, known gaps, and how to report a barrier.";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://domidata.heatherdomi.com/accessibility" }],
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "https://domidata.heatherdomi.com/accessibility" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://domidata.heatherdomi.com/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "Accessibility",
              item: "https://domidata.heatherdomi.com/accessibility",
            },
          ],
        }),
      },
    ],
  }),
  component: AccessibilityPage,
});

function AccessibilityPage() {
  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content" className="page-shell">
        <div className="page-eyebrow">Accessibility</div>
        <h1 className="page-title">Accessibility Statement</h1>
        <div className="page-body">
          <p>
            Domi Data is committed to making its research readable and usable by everyone, including people who
            browse with a screen reader, a keyboard alone, or at high magnification. This statement describes the
            standard we work to, what conforms today, what we know is incomplete, and how to tell us when something
            blocks you.
          </p>

          <h2>The standard we target</h2>
          <p>
            We target the Web Content Accessibility Guidelines (WCAG) 2.1 at conformance Level AA. That is the
            benchmark referenced by the Americans with Disabilities Act in most U.S. enforcement, and it is the
            standard we hold new pages to before they publish.
          </p>

          <h2>What conforms today</h2>
          <ul>
            <li>Automated testing with axe-core returns zero violations across the site's page templates.</li>
            <li>
              Text and interface color meet the 4.5:1 contrast minimum for body copy and 3:1 for large type. Tier
              labels use dedicated darker shades when set as text.
            </li>
            <li>
              Color is never the only carrier of meaning. Tier and property-type series always appear with a written
              label alongside the color.
            </li>
            <li>
              Every page begins with a skip link, uses one main landmark, and follows a single, ordered heading
              structure.
            </li>
            <li>
              Data tables use real table markup with row and column headers. Charts drawn on canvas are paired with a
              screen-reader table carrying the same figures.
            </li>
            <li>Every interactive control is reachable and operable by keyboard, with a visible focus indicator.</li>
            <li>Dialogs, including the chart expander and Ask Heather, trap focus while open and close on Escape.</li>
            <li>Images carry descriptive alternative text; decorative marks are hidden from assistive technology.</li>
            <li>The site honors the operating system's reduce-motion setting.</li>
          </ul>

          <h2>Display preferences</h2>
          <p>
            The accessibility button at the lower left of every page opens a preferences panel we built and maintain
            ourselves. No third-party overlay script runs on this site. The panel offers text size at 100, 115, or 130
            percent, a high-contrast mode, an option to underline every link, and a manual reduce-motion switch for
            people who have not set that preference at the system level. Choices are stored in your browser and
            persist across visits.
          </p>

          <h2>Known gaps</h2>
          <p>
            Automated testing catches roughly a third of accessibility barriers. We are candid about the rest.
          </p>
          <ul>
            <li>
              A full manual audit by an assistive-technology user has not yet been completed. It is scheduled and this
              statement will be updated when it is.
            </li>
            <li>
              The two long-form reports, Foundational and Quarterly, are dense documents with many figures. Their
              charts have text equivalents, but the narrative reading order at very high magnification is still under
              review.
            </li>
            <li>
              Ask Heather, the site's research assistant, returns generated text. Its responses are announced to
              screen readers as they arrive, but streaming output can be verbose for a listener.
            </li>
            <li>
              Some third-party content, including embedded analytics and forms handled by outside providers, is
              outside our direct control. We choose vendors with accessibility in mind and will replace any component
              that proves to be a barrier.
            </li>
          </ul>

          <h2>How we maintain this</h2>
          <p>
            Accessibility checks run against every page template as part of our release process. New pages are tested
            for contrast, heading order, keyboard operation, and alternative text before they publish. Findings are
            logged and remediated on a rolling basis, with barriers that block a task treated as urgent.
          </p>

          <h2>Reporting a barrier</h2>
          <p>
            If any part of this site is difficult or impossible for you to use, please tell us. Email{" "}
            <a href="mailto:hdomi@heatherdomi.com">hdomi@heatherdomi.com</a> or call{" "}
            <a href="tel:9172678012">(917) 267-8012</a>. Include the page address and a short description of what
            happened. We acknowledge reports within two business days and will work with you to provide the
            information in an alternative format while a fix is in progress.
          </p>

          <h2>Formal complaints</h2>
          <p>
            If our response does not resolve the issue, you may escalate to Douglas Elliman, with which the Heather
            Domi Team is affiliated, using the contact channels published at heatherdomi.com.
          </p>
        </div>
        <p className="page-footlink">
          <a href="/contact">Contact →</a>
        </p>
        <p style={{ fontSize: "10.5px", color: "var(--mid)", marginTop: "20px", lineHeight: "1.7" }}>
          Last reviewed: July 2026
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
