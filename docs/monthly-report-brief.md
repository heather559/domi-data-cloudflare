# Domi Data — Monthly Report Design Brief

Hand this file, plus `docs/design-rulebook.md`, to whoever builds the Monthly
Report. The rulebook is the law; this brief says how the Monthly Report
specifically inherits it and where it plugs into the site.

Reference implementation to copy from: `src/reports/quarterly-brief.html`
(the Quarterly Report). Do not invent components. If a need is not covered by
the rulebook, ask before adding a new role.

---

## 1. What this report is

Cadence: monthly, published after month close. Sits between This Week
(velocity) and the Quarterly Report (structure).

Its job: **what changed this month, and whether it is signal or noise.**
Weekly answers "what happened." Quarterly answers "what is the regime."
Monthly answers "is the regime bending."

Do not repeat the Quarterly's structural analysis. Cross-link to it with the
`.xref` pill instead.

---

## 2. Build format

Decided: **React route pulling live data**, same shape as This Week. The
Quarterly Report is moving to a React route as well, so build Monthly that way
from day one and treat `src/routes/this-week.tsx` as the structural reference
and `src/reports/quarterly-brief.html` as the visual reference.

- Route file: `src/routes/monthly.tsx` (TanStack file route, `createFileRoute("/monthly")`).
- Data: a `createServerFn` in `src/lib/monthly-report.functions.ts`, following
  the pattern in `src/lib/weekly-report.functions.ts` and
  `src/lib/neighborhood-report.functions.ts`. Read the latest period row, do
  the derived math server side, return one typed payload. Never query the
  database from the component.
- Loading shape: `context.queryClient.ensureQueryData(...)` in the route loader
  plus `useSuspenseQuery` in the component. No `useEffect` fetching.
- Tokens: `src/styles.css` only. Do not redeclare a `:root` block or fork a hex.
- Shared utilities: `src/lib/qr-design.ts` for report chrome,
  `src/lib/sowhat.ts` for thresholds, provisional and small-sample strings,
  `src/lib/sr-table.ts` for the hidden screen-reader table on every chart.
- Charts: Chart.js, same config conventions as This Week.
- Head metadata lives in the route's `head()`. Favicon, analytics tags, header,
  footer and the accessibility panel are inherited from `__root.tsx`, so do not
  re-add any of them.
- Give the route an `errorComponent` and `notFoundComponent`; a failed data read
  must not blank the page.

Never place the file in `public/`. Anything in `public/` is served by the CDN
before the bot gate runs and can be scraped whole. React routes are gated by
`src/server.ts` automatically.

Where the brief below says "static HTML", "copy the QR token block", or
"inline the favicon and analytics tags", those instructions no longer apply.


---

## 3. Non-negotiables (the five that get caught in review)

1. **Tier palette is locked.** Luxury `#98A0A8`, Prime `#918C7E`,
   Trophy `#A37670`. Fills, bars, chips, swatches, chart lines. No exceptions.
   When a tier name or figure is **type on a light background**, use the AA
   text shades: `#6C7881` / `#7A7363` / `#A45A58`.
2. **No em dashes (—) and no `--` pseudo dashes.** Anywhere. Rewrite with
   periods, commas, semicolons, or parentheses. No exclamation points, no
   emoji, no hype.
3. **Ivy Mode for editorial and numerals, Jost for UI and body.** Olive
   (`#75694E`) for eyebrows and labels only, never paragraphs. Rust
   (`#9E5040`) is one accent gesture per surface.
4. **`font-variant-numeric: tabular-nums` on every numeral cell.**
5. **Deltas use `.up` `#2E6645`, `.dn` `#9C2F26`, `.fl` olive.** Never raw
   web green or red.

---

## 4. Page skeleton

Follow this order. Each block maps to a rulebook section.

```
skip link (§29)                     first focusable element
site header strip (§6)              sticky, sets --site-header-h via JS
masthead (§7)                       brand eyebrow, H1, byline, doc-orient note
sticky TOC (§8)                     top: var(--site-header-h, 0px)
Part 1 — The Month in One Read
  lede-quote (attributed)           ONLY here, once per document
  glance grid (§10)                 3 to 4 headline figures
  hero box family (§11)             tier cutoffs + counts + volume
Part 2 — Momentum
  transition lede (italic, above the eyebrow)
  watch box family (§12)            month vs 3-month vs 12-month average
  charts (§21)                      monthly series, 24 months minimum
Part 3 — Supply and Absorption
  callout / key takeaway (§13)
  tables (§20)                      .cv-wrap + .cv-table
Part 4 — Neighborhoods
  composition cards (§17) or ranked table with .rank-num
Part 5 — What This Means
  What This Means box (§14)
  recommendation + open item (§15)
bottom line (§24)                   closing statement, single quote mark
footnotes (§25)                     methodology, provisional note, glossary
global footer (§30)                 exact stack, in order
```

**Transition ledes**: italic Jost 18px, `var(--olive)`, line-height 1.55,
`margin-bottom:14px`, sitting **above** the `.sec-label` eyebrow. No
attribution. The centered attributed pull-quote is Part 1 only.

---

## 5. Content rules specific to monthly cadence

- Comparison frame is **month over month, month vs trailing 3-month average,
  and month vs same month last year.** Show all three or say why one is absent.
- Label the month explicitly in the masthead ("July 2026"), never "this month."
- Any figure drawn from fewer than the small-sample floor gets the small-sample
  note. Reuse the logic in `src/lib/sowhat.ts`; do not re-derive thresholds.
- Provisional data carries the standard provisional string until the month is
  fully recorded. Same wording as the weekly and neighborhood reports.
- Structure every narrative paragraph as Evidence → Action → Why it matters.
- Translate any specialist term in line on first use. Spell out abbreviations
  on first use, for example "Department of Finance (DOF)."
- Include the standard Abbreviations glossary in the footnotes band.

---

## 6. Charts

- Chart.js only. Tier trio for tier series.
- Property type series: Condo rust `#9E5040`, Co-op olive `#75694E`,
  Townhouse ash `#98A0A8`. Legend swatches must match the line colors exactly.
- Grid lines `rgba(28,26,24,.06)`, axis text `--ink-mid` Jost 12px.
- One centered `#EDE9E7` watermark per chart card. Never darker.
- Animate first paint only. No reflow on rebuild.
- Wide charts and tables go inside an `overflow-x: auto` wrapper so mobile can
  swipe.
- Every chart needs a visually hidden data table and an `aria-describedby`
  narrative summary. Charts inside modals must not be hidden by `clip-path`
  during the reveal animation, or the canvas renders blank.

---

## 7. Accessibility (WCAG 2.1 AA, currently zero violations sitewide)

- One `<h1>`. No skipped heading levels.
- 44×44px minimum tap targets on nav, TOC, and menu controls.
- `aria-label` on every icon-only control, alt text on every content image.
- Legal footer font-size floor is 12px.
- Unique `<title>` under 60 characters and meta description under 160, plus
  `og:title`, `og:description`, `og:type`, `twitter:card`.
- Run axe-core before handoff. Zero violations is the bar, not a goal.

---

## 8. Site integration checklist

- [ ] Add `{ label: "Monthly Report", href: "/monthly" }` to
      `src/lib/nav.ts` in cadence order (This Week, Monthly, Quarterly,
      Foundational).
- [ ] Add the URL to `src/routes/sitemap[.]xml.ts`.
- [ ] Add the entry to `src/routes/rss[.]xml.ts` if it is a recurring release.
- [ ] Confirm the route is gated by `src/server.ts` (it is, being a React route
      and not in `public/`).
- [ ] Unique `head()` on the route: title, description, `og:title`,
      `og:description`, `og:type`, `twitter:card`.
- [ ] Header, footer, favicon, analytics and the accessibility panel come from
      `__root.tsx`. Do not duplicate them in the route.
- [ ] Footer renders `src/components/site-footer.tsx` unmodified: wordmark,
      Douglas Elliman logo, legal disclosure, bold copyright plus bold
      `Domi Data™ Luxury Lines`, Marketproof credit, then the citation line.
- [ ] Cross-link to the Quarterly and to This Week with `.xref` pills, using
      `<Link to>` rather than raw anchors.

---

## 9. Review gate

Before merge, diff the new route against `src/routes/this-week.tsx` on: token
usage (no local hexes), type roles, section rhythm (`36px 64px 56px`), mobile
rhythm (`32px 24px`), chart config, and screen-reader table coverage. Compare
the rendered page against `src/reports/quarterly-brief.html` for visual
rhythm. Any divergence is a bug in the new file, not a variation.

