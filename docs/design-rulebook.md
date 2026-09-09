# Domi Data — Design Rulebook

Canonical visual system for every page on the site. All specs are sourced
verbatim from `public/quarterly-brief.html` (the Quarterly Report), which is
the reference implementation. If a page disagrees with this document, change
the page, not this document.

Rule of thumb: **Ivy Mode for editorial and numbers, Jost for interface and
body copy, olive for eyebrows, rust used sparingly as the single accent.**

Every component section below cites the QR source lines so a drift audit is a
diff between the rulebook block and the file.

---

## 1. Voice and discipline

- Refined, calm, candid, data-driven. Plain English for a lay reader;
  translate specialist terms in line.
- Structure: Evidence → Action → Why it matters. Short, present-tense.
- Brand: **Heather Domi** (never "Heather Domi Team").
- No em dashes (—) or double-hyphen pseudo em dashes (`--`) anywhere in copy.
  Rewrite with periods, commas, semicolons, or parentheses.
- No hype, no FOMO, no exclamation points, no emoji.

---

## 2. Color tokens

Copy verbatim into any new page's `:root`. Never redefine these values.
Source: `public/quarterly-brief.html` lines 8–16.

| Token | Hex | Use |
|---|---|---|
| `--ivory` | `#FBF9F5` | Warm off-white surfaces, secondary bg |
| `--paper` | `#FFFFFF` | Default surface |
| `--paper-2` | `#FBF9F5` | Footnote bands, alternate rows |
| `--taupe` | `#E4DDD3` | Hairline dividers, 1px borders, row rules |
| `--ink` | `#1C1A18` | Headlines, numerals, primary text, hero border |
| `--ink-mid` | `#4A4744` | Body copy, secondary text |
| `--ash` | `#50677A` | Meta text, captions, muted subheads |
| `--olive` | `#75694E` | Eyebrows, section labels, recommendation rule, TOC label |
| `--rust` | `#9E5040` | Single accent: brand mark, callout chip, focus outline, footnote chevron |
| `#BA8C86` | rose-taupe | `.xref` pill border+text; alternate callout label bg |
| `--p90` | `#98A0A8` | **Luxury** tier (canonical) |
| `--p95` | `#918C7E` | **Prime** tier (canonical) |
| `--p99` | `#A37670` | **Trophy** tier (canonical) |
| `--p90-text` | `#6C7881` | Luxury tier **as text** (AA, 4.52:1) |
| `--p95-text` | `#7A7363` | Prime tier **as text** (AA, 4.71:1) |
| `--p99-text` | `#A45A58` | Trophy tier **as text** (AA, 5.02:1 on white, 4.54:1 on tinted rows) |
| `--up-strong` | `#2E6645` | Positive delta (`.up`) |
| `--down-strong` | `#9C2F26` | Negative delta (`.dn`) |
| `--rec-bg` | `rgba(135,128,110,.07)` | Recommendation surface tint |
| `--rust-bg` | `rgba(172,98,96,.08)` | Rust surface tint (top-rank rows) |

**Tier soft tints** (used on top-rank card + row fills):
`rgba(171,115,110,.10)` for Trophy card highlight; `rgba(172,98,96,.05)` on
current-quarter table cells.

**Ink translucency** (hero/watch internal dividers): `rgba(28,26,24,.18)`.

**Table hover**: `rgba(0,0,0,.02)`.

**Non-lux composition segment**: `rgba(110,74,92,.70)` (plum, 70% opacity).

The tier trio is canonical and locked: **Luxury `#98A0A8` · Prime `#918C7E` · Trophy `#A37670`**. Never use any other hexes for Luxury / Prime / Trophy: not in charts, not in tables, not in chips, not in eyebrows, not in stat figures.

One exception, for accessibility only: when a tier name or tier figure is rendered as **type on a light background**, use the brand-derived text shades (`--p90-text` `#6C7881`, `--p95-text` `#7A7363`, `--p99-text` `#A45A58`). The canonical hexes stay untouched for fills, bars, rules, chips, and swatches.

### Transition ledes

Italic short sentences that bridge one section into the next. Body sans (Jost), **18px**, italic, color `var(--olive)`, line-height 1.55, `margin-bottom:14px`. They sit **above** the section eyebrow (`.sec-label`), which is followed by the `.sec-title`. Never below the title. No "HEATHER DOMI" attribution. The centered pull-quote (`.lede-quote`) with attribution is reserved for the opening statement of Part 1 only.

```html
<p style="font-size:18px;color:var(--olive);font-style:italic;line-height:1.55;margin-bottom:14px;">Transition sentence.</p>
<div class="sec-label">Part N &middot; Title</div>
<h2 class="sec-title">Heading.</h2>
```

---

## 3. Typography stack

- **Display / editorial**: `Ivy Mode`, `Cormorant Garamond`, `Times New Roman`,
  Georgia, serif. Default weight 400.
- **Body / UI**: `Jost`, `Helvetica Neue`, Helvetica, Arial, sans-serif.
- **Monospace** (rank numerals only): `Courier New`.
- Body defaults: `17.5px / 1.68` on `--ink-mid` desktop; `16px` on ≤640px.
- Every numeral cell: `font-variant-numeric: tabular-nums`.
- `-webkit-font-smoothing: antialiased` globally on body.

**Loading:**
- Ivy Mode is embedded as a base64 `@font-face` at the top of
  `public/quarterly-brief.html` (line 5) with `font-display: swap`. React
  routes load Ivy Mode + Jost via a `<link>` in the root route head.
- Never `@import` a font URL in `src/styles.css` (Lightning CSS resolves
  `@import` from the filesystem, not the network).

---

## 4. Type roles (exact specs)

Source: `public/quarterly-brief.html` lines 19–65.

| Role | Class | Family | Size | Weight | Case / Tracking | Color |
|---|---|---|---|---|---|---|
| Report brand eyebrow | `.brand` | Ivy Mode | 14px | 400 | uppercase, .22em | `--rust` |
| H1 report title | `.report-title` | Ivy Mode | `clamp(28px,4vw,44px)` | 400 | 1.12 leading, `text-wrap: balance` | `--ink` |
| Masthead byline | `.masthead-byline` | Jost | 14.5px | 400 | 1.9 leading | `--olive` |
| Masthead byline strong | `.masthead-byline strong` | Jost | 14.5px | 600 | .04em, block | `--ink-mid` |
| Section eyebrow | `.sec-label` | Jost | 12.5px | 700 | uppercase, .2em, trailing 1px `--taupe` rule via `::after` | `--olive` |
| Section title | `.sec-title` | Ivy Mode | `clamp(22px,3.2vw,32px)` | 400 | balanced, 22px bottom margin | `--ink` |
| Subhead | `.subhead` | Ivy Mode | 20px | 400 | .04em, 1px `--taupe` underline, 36/16 vertical rhythm | `--ink` |
| Doc orient note | `.doc-orient` | Jost | 15px | 400 | none | `--olive` |
| Hero tier label | `.hero-tier` | Ivy Mode | 16px | 900 | uppercase, .18em, `-webkit-text-stroke: .4px currentColor` | tier color |
| Hero benchmark floor | `.hero-floor` | Ivy Mode | 1.5rem | 500 | tabular-nums, 1px hairline underline | `--ink` |
| Hero floor label | `.hero-floor-lbl` | Jost | 12px | 400 | uppercase, .1em, `margin-left: 10px` | `--ash` |
| Hero number | `.hero-num` | Ivy Mode | 2.2rem | 400 | tabular-nums, line-height 1 | tier or `--ink` |
| Hero sub | `.hero-sub` | Jost | 14px | 400 | none | `--ash` |
| Watch label | `.watch-cell-label` | Ivy Mode | 20px | 400 | .02em | `--ink` |
| Watch value | `.watch-cell-val` | Ivy Mode | 2.2rem | 700 | tabular-nums | `--ink` (or `--p99`) |
| Watch eyebrow | `.watch-cell-eyebrow` | Jost | 12px | 700 | uppercase, .18em | tier or `--ink` |
| Table header | `th` (`.cv-table`) | Jost | 12px | 700 | uppercase, .10em, 2px `--taupe` bottom | `--olive` |
| Table cell | `td` (`.cv-table`) | Jost | 15.5px | 400 | 1px `--taupe` bottom, `padding: 12px 12px` | `--ink-mid` |
| Rank numeral | `.rank-num` | Courier New | 14px | 400 | tabular-nums | `--ink-mid` |
| Neighborhood name | `.nbhd-name` | Ivy Mode | 19px | 400 | 1.25 leading | `--ink` |
| Composition name | `.comp-name` | Ivy Mode | 20px | 400 | .02em | `--ink` |
| Reading item label | `.reading-item-label` | Ivy Mode | 18px | 400 | .01em | `--ink` |
| Callout body | `.callout p` | Jost | 17.5px | 400 | 1.62 leading | `--ink` |
| Callout label chip | `.callout-label` | Jost | 12px | 700 | uppercase, .14em, white on `--rust` `#9E5040` (never `#BA8C86`: white on it is 2.92:1 and fails AA) | white |
| WTM header bar | `.wtm-header` | Jost | 13px | 700 | uppercase, .14em, white on `--ink` | white |
| WTM row label | `.wtm-row-label` | Jost | 13px | 700 | uppercase, .1em | `--ink` |
| WTM row text | `.wtm-row-text` | Jost | 15.5px | 400 | 1.65 leading | `--ink-mid` |
| WTM closer | `.wtm-close` | Ivy Mode | 16.5px | 400 | 1.6 leading, 1px taupe top rule | `--ink` |
| Recommendation tag | `.rec-tag` | Ivy Mode | 20px | 400 | .02em | `--olive` |
| Recommendation body | `.rec-body` | Jost | 15px | 400 | 1.72 leading | `--ink-mid` |
| Open-item badge | `.open-item-badge` | Jost | 12px | 700 | uppercase, .14em, olive outline | `--olive` |
| Bottom-line quote | `.bl-quote` | Ivy Mode | 23px | 400 | 1.55 leading, max-width 680px, balanced | `--ink` |
| Bottom-line mark | `.bl-mark` | Ivy Mode | 56px | 400 | opacity `.35` | `--rust` |
| Bottom-line signature | `.bl-sig` | Jost | 14px | 700 | uppercase, .14em | `--olive` |
| Bottom-line sig sub | `.bl-sig span` | Jost | 12px | 600 | uppercase, .18em | `--ash` |
| Chip base | `.chip` | Jost | 13.5px | 700 | uppercase, .06em, 3px radius, `4px 10px` padding | varies |
| Cross-reference pill | `.xref` | Jost | 13px | 700 | .04em, 1px `#BA8C86` border, 3px radius, `2px 9px` | `#BA8C86` |

---

## 5. Grid, spacing, and vertical rhythm

- Horizontal page padding: `64px` desktop; `24px` at ≤700px; `20px` for grid
  interiors at ≤640px.
- Section rhythm: `padding: 36px 64px 56px; border-bottom: 1px solid --taupe;`
  (line 29). Last section drops the bottom rule.
- Masthead rhythm: `64px 64px 44px` (line 22).
- Mobile section: `padding: 32px 24px` (line 149). Section title collapses to
  26px, section eyebrow to 11.5px.
- Standard component gap: `40px` between columns, `12px` between rows in hero
  grids; `24px` between section blocks; `20px` between chart rows.
- Max content width: none imposed at container level. Editorial blocks
  constrain via `text-wrap: balance` and inline `max-width` (680px for the
  bottom-line quote) where reading comfort matters.

**Sticky-offset variable**: `--site-header-h` is set by JS at load and on
resize (`ResizeObserver` on the header wrap, lines 512–531). Every sticky
element uses `top: var(--site-header-h, 0px)`.

---

## 6. Site header + mobile nav strip

Source: lines 466–483, 344–360.

- Sticky wrapper: `position: sticky; top: 0; z-index: 100;`.
- Marketproof strip: `#FAF5EC` bg, `padding: 6px 24px 0`, right-aligned,
  `font-size: 10px`, `letter-spacing: .18em`, uppercase, gap `8px`, logo
  height `16px`, color `#0a0a0a`. This is the canonical Marketproof credit
  and must render identically on every page.
- Site header row: `#FAF5EC` bg, `padding: 5px 48px`, three-column grid
  `auto 1fr auto`, gap `48px`, `font-family: Jost`, `font-size: 12.5px`,
  `letter-spacing: .24em`, uppercase, `border-bottom: 1px solid #d9d5cf`.
- Logo (Domi Data lockup): `height: 115px`.
- Nav links: `font-size: 12px`, weight 400.
- Phone link: `font-size: 12.5px`, letter-spacing `.18em`.
- Mobile (≤960px): hide `.static-site-nav`, `.static-site-phone`,
  `.static-mp-strip`; show `.static-mobile-menu` (`<details>` hamburger).
  Header padding collapses to `3px 22px`, gap `12px`, logo `76px`. Mobile
  panel `#FAF5EC` bg, `padding: 12px 22px 20px`, row height 44px, uppercase
  `font-size: 12px`, `letter-spacing: .24em`.

---

## 7. Masthead

Source: lines 22–26, 487–494, and 143–147 (mobile).

```css
.masthead{padding:64px 64px 44px;}
.brand{font-family:'Ivy Mode',serif;font-size:14px;letter-spacing:.22em;text-transform:uppercase;color:var(--rust);margin-bottom:14px;}
.report-title{font-family:'Ivy Mode',serif;font-size:clamp(28px,4vw,44px);font-weight:400;line-height:1.12;text-wrap:balance;}
.masthead-byline{margin-top:26px;font-size:14.5px;color:var(--olive);line-height:1.9;}
.masthead-byline strong{color:var(--ink-mid);display:block;font-weight:600;letter-spacing:.04em;margin-bottom:2px;}
```

Structure:
1. `.brand` eyebrow (`Domi Data™ Luxury Lines`) in rust caps.
2. `.report-title` in Ivy Mode with a `<br>` line break for the two-line
   masthead ("Manhattan Luxury:" / "Quarterly Report").
3. `.masthead-byline` containing a block-level `<strong>` label
   (`Quarterly Report · Q2 2026`) then the meta line
   (`April 1 – June 30, 2026 · TTM Window: …`).

Mobile (≤640px): `.masthead { padding: 36px 24px 28px; }`,
`.masthead-byline { line-height: 1.7; }`, `.report-title { line-height: 1.1; }`.

---

## 8. Sticky Table of Contents

Source: lines 205–228, 497–531.

```css
.toc{padding:22px 64px;background:var(--paper);border-bottom:1px solid var(--taupe);display:flex;gap:32px;flex-wrap:wrap;align-items:center;position:sticky;top:var(--site-header-h,0px);z-index:40;box-shadow:0 1px 0 rgba(28,26,24,.04);}
.toc-label{font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--olive);white-space:nowrap;}
.toc-items{display:flex;gap:0;flex-wrap:wrap;}
.toc-item{font-size:14px;color:var(--ink-mid);padding:4px 16px;border-right:1px solid var(--taupe);white-space:nowrap;}
.toc-item:last-child{border-right:none;}
.toc-items a{text-decoration:none;color:inherit;}
.toc-items a:hover .toc-item{color:var(--rust);}
```

Behavior:
- Rendered as `<details open class="toc">`. On mobile (≤700px) JS toggles
  `toc.open = false` and clicking a nav item closes the panel.
- Chevron `.toc-chevron` and `.toc-summary` are hidden on desktop
  (`display: none`) and shown on mobile.
- Sticks under the sticky site-header wrap; the offset is computed live.
- **No vertical dividers in the rulebook variant applied to the Foundational
  Report homepage** (see §8a) — the QR still shows dividers via
  `border-right`, but the report page removes them for a lighter feel. When
  emulating on a non-report page, follow whichever variant the visual target
  requires and document the choice.
- Hover: `--rust`. No underline.

Mobile (≤700px):
- Panel wraps to full-width rows.
- `.toc-item` becomes a full-width row separated by 1px `--taupe`.
- Summary chevron rotates 90° when `open`.

---

## 9. Section shell

Source: lines 29–34.

```css
.section{padding:36px 64px 56px;border-bottom:1px solid var(--taupe);}
.section:last-child{border-bottom:none;}
.sec-label{font-size:12.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--olive);margin-bottom:12px;display:flex;align-items:center;gap:12px;}
.sec-label::after{content:'';flex:1;height:1px;background:var(--taupe);}
.sec-title{font-family:'Ivy Mode',serif;font-size:clamp(22px,3.2vw,32px);font-weight:400;margin-bottom:22px;text-wrap:balance;}
```

Structure inside every `.section`:
1. `.sec-label` — "Section N · Label" with the auto-generated 1px `--taupe`
   rule trailing right via `::after`.
2. `.sec-title` — Ivy Mode section title.
3. Optional `.glance-grid` (see §10) for the section overview.
4. Body components (hero, tables, WTM, callouts).
5. Optional `.callout` or `.wtm-box` at the section close.

`.doc-orient` (line 208): 16px vertical padding, 64px horizontal, `--olive`
copy on `--paper`, 1px `--taupe` bottom rule. Used once, directly under the
TOC, to orient the reader.

---

## 10. Glance grid (section overview)

Source: lines 232–237 and 240.

```css
.glance-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:28px 0 40px;border:1px solid var(--taupe);}
.glance-item{font-size:16px;line-height:1.6;color:var(--ink-mid);padding:22px 26px;border-right:1px solid var(--taupe);border-bottom:1px solid var(--taupe);}
.glance-item:nth-child(2n){border-right:none;}
.glance-item:nth-last-child(-n+2){border-bottom:none;}
.glance-item strong{color:var(--ink);}
```

Four cells in a 2×2 grid, taupe hairline outline, hairline interior dividers.
`<strong>` promotes the topic sentence to `--ink`.

Mobile (≤700px): `grid-template-columns: 1fr`. Mobile (≤640px):
`padding: 18px 20px; font-size: 15px;`.

---

## 11. Hero box family

Signature of the report. Source: lines 37, 53–66, and 162–171 (mobile).

```css
.hero-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
  gap:12px 40px;
  background:var(--paper);
  border:2px solid var(--ink);
  border-top-width:5px;                 /* SIGNATURE 5px top rule */
  border-radius:3px;
  margin-bottom:40px;
  padding:40px 36px;
}
.hero-cell{background:transparent;border:none;padding:0;text-align:center;}
.hero-cell:nth-child(1),.hero-cell:nth-child(2){border-right:1px solid rgba(28,26,24,.18);}
.hero-cell[style*="grid-column"]{border-top:1px solid rgba(28,26,24,.18);padding-top:24px;}
.hero-tier{font-family:'Ivy Mode',serif;font-size:16px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;margin-bottom:8px;color:var(--ink);-webkit-text-stroke:.4px currentColor;}
.hero-tier.p90,.hero-floor.p90{color:var(--p90);}
.hero-tier.p95,.hero-floor.p95{color:var(--p95);}
.hero-tier.p99,.hero-floor.p99{color:var(--p99);}
.hero-floor{display:inline-block;font-family:'Ivy Mode',serif;font-size:1.5rem;font-weight:500;line-height:1;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid rgba(28,26,24,.18);font-variant-numeric:tabular-nums;color:var(--ink);}
.hero-floor.p90{border-bottom-color:color-mix(in oklab,var(--p90) 45%,transparent);}
.hero-floor.p95{border-bottom-color:color-mix(in oklab,var(--p95) 45%,transparent);}
.hero-floor.p99{border-bottom-color:color-mix(in oklab,var(--p99) 45%,transparent);}
.hero-floor-lbl{font-size:12px;color:var(--ash);text-transform:uppercase;letter-spacing:.1em;font-weight:400;font-family:'Jost',sans-serif;margin-left:10px;}
.hero-num{font-family:'Ivy Mode',serif;font-size:2.2rem;font-weight:400;line-height:1;margin-bottom:6px;font-variant-numeric:tabular-nums;}
.hero-sub{font-size:14px;color:var(--ash);}
```

**Non-negotiable:** the 5px ink top rule is the signature. Every
hero-class panel gets it. Never soften it, never colorize it.

**Per-tier internal use**: apply `.p90` / `.p95` / `.p99` to `.hero-tier`
and `.hero-floor` and set `.hero-num`'s `color` inline to the same token.

Mobile (≤640px):
```css
.hero-grid{grid-template-columns:1fr !important;padding:24px 20px;gap:0;margin-bottom:28px;}
.hero-cell:nth-child(1),.hero-cell:nth-child(2){border-right:none;}
.hero-cell + .hero-cell{border-top:1px solid rgba(28,26,24,.18);padding-top:20px;margin-top:20px;}
.hero-num{font-size:1.9rem;}
.hero-floor{font-size:1.25rem;margin-bottom:14px;padding-bottom:12px;}
```

---

## 12. Watch box family

Variant of hero chrome. Source: lines 187–197.

```css
.watch-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px 40px;background:var(--paper);border:2px solid var(--ink);border-top-width:5px;border-radius:3px;margin:24px 0 24px;padding:40px 36px;}
.watch-cell{background:transparent;border:none;padding:0;text-align:center;}
.watch-cell:nth-child(1),.watch-cell:nth-child(2){border-right:1px solid rgba(28,26,24,.18);}
.watch-cell-eyebrow{font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--ink);margin-bottom:10px;font-family:'Jost',sans-serif;}
.watch-cell-eyebrow.p90{color:var(--p90);}
.watch-cell-eyebrow.p95{color:var(--p95);}
.watch-cell-eyebrow.p99{color:var(--p99);}
.watch-cell-label{font-family:'Ivy Mode',serif;font-size:20px;color:var(--ink);margin-bottom:8px;letter-spacing:.02em;font-weight:400;}
.watch-cell-val{font-family:'Ivy Mode',serif;font-size:2.2rem;font-weight:700;color:var(--ink);line-height:1;font-variant-numeric:tabular-nums;}
.watch-cell-val.p99{color:var(--p99);}
.watch-cell-sub{font-size:13.5px;color:var(--ink);margin-top:8px;line-height:1.55;}
.watch-threshold{background:var(--paper);padding:20px 24px;border:1px solid var(--taupe);border-radius:2px;font-size:15.5px;color:var(--ink-mid);line-height:1.75;}
```

**Active Inventory 2-on-top-1-centered mobile pattern** (`.inv-mini-grid`,
line 153):
```css
.inv-mini-grid{grid-template-columns:1fr 1fr !important;gap:24px 20px !important;}
.inv-mini-grid > .watch-cell:nth-child(1),
.inv-mini-grid > .watch-cell:nth-child(2){border-top:none !important;margin-top:0 !important;padding-top:0 !important;}
.inv-mini-grid > .watch-cell:nth-child(3){grid-column:1 / -1;max-width:60%;justify-self:center;border-top:1px solid rgba(28,26,24,.18);padding-top:20px;margin-top:4px;}
```

Mobile (≤640px) also stacks `.watch-grid` to a single column and reduces
`.watch-cell-val` to `1.9rem`, `.watch-cell-label` to 18px.

---

## 13. Callout / Key Takeaway

Source: lines 149–152.

```css
.callout{border:1px solid var(--ink);padding:26px 30px;background:var(--paper);margin:36px 0;border-radius:2px;}
.callout p{font-size:17.5px;line-height:1.62;color:var(--ink);}
.callout p+p{margin-top:16px;}
.callout-label{font-family:'Jost',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:var(--rust);display:inline-block;padding:5px 11px;border-radius:2px;margin-bottom:14px;}
```

Structure:
```html
<div class="callout">
  <div class="callout-label">Key Takeaway</div>
  <p>Body copy…</p>
  <p>Optional second paragraph.</p>
</div>
```

**Label chip color variants**:
- Default: white on `--rust` (`#9E5040`).
- **Blush variant** (used on Quarterly Report Key Takeaways):
  `<div class="callout-label" style="background:#9E5040;">`. Same type
  scale, softer hue.
- Reading-the-chart chip: same class, blush background.

**Do not**:
- Add a left rust rule (`border-left: 3px solid --rust`) — that was an old
  Foundational Report pattern and has been removed.
- Shrink body copy below 17.5px on desktop (Jost 15.5px on ≤640px only).
- Use rust on the frame itself.

Mobile (≤640px): callout inherits body defaults; label chip stays 12px.

---

## 14. What This Means box

Source: lines 247–255, 331–335.

```css
.wtm-box{border:1px solid var(--taupe);background:var(--paper);margin-top:32px;border-radius:2px;}
.wtm-header{padding:16px 22px;border-bottom:1px solid var(--taupe);font-family:'Jost',sans-serif;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:var(--ink);}
.wtm-body{padding:10px 22px 22px;}
.wtm-rows{padding:4px 0;margin:0;}
.wtm-row{padding:14px 0;border-bottom:1px solid var(--taupe);}
.wtm-row:last-child{border-bottom:none;}
.wtm-row-label{font-family:'Jost',sans-serif;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);margin-bottom:8px;}
.wtm-row-text{font-size:15.5px;color:var(--ink-mid);line-height:1.65;}
.wtm-close{font-family:'Ivy Mode',serif;font-size:16.5px;line-height:1.6;color:var(--ink);margin-top:18px;padding-top:16px;border-top:1px solid var(--taupe);}
```

Structure:
```html
<div class="wtm-box">
  <div class="wtm-header">What This Means</div>
  <div class="wtm-body">
    <ul class="wtm-rows">
      <li class="wtm-row">
        <div class="wtm-row-label">For Sellers</div>
        <div class="wtm-row-text">…</div>
      </li>
      <li class="wtm-row">
        <div class="wtm-row-label">For Buyers</div>
        <div class="wtm-row-text">…</div>
      </li>
      <li class="wtm-row">
        <div class="wtm-row-label">For Developers</div>
        <div class="wtm-row-text">…</div>
      </li>
    </ul>
    <p class="wtm-close">Closer paragraph in Ivy Mode over a taupe top rule.</p>
  </div>
</div>
```

**Cadence:** one WTM per section maximum, always after the data blocks.
Row labels are audience segments (Sellers / Buyers / Developers / Owners).

Mobile (≤640px): header padding `14px 16px`, header text 12.5px; body
`10px 16px 18px`; row label 12.5px; row text and closer 15px.

---

## 15. Recommendation and Open item

Source: lines 176–179, 182–184.

```css
.rec{border-left:3px solid var(--olive);background:var(--rec-bg);padding:18px 22px;margin:20px 0;border-radius:0 2px 2px 0;}
.rec-tag{font-family:'Ivy Mode',serif;font-size:20px;font-weight:400;letter-spacing:.02em;color:var(--olive);margin-bottom:8px;}
.rec-body{font-size:15px;color:var(--ink-mid);line-height:1.72;}

.open-item{border:1px dashed var(--olive);background:var(--paper);padding:18px 22px;margin:20px 0;border-radius:2px;}
.open-item-badge{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--olive);border:1px solid var(--olive);border-radius:3px;padding:4px 9px;margin-bottom:10px;}
.open-item p{font-size:15px;color:var(--ink-mid);line-height:1.72;}
```

**Recommendation**: 3px olive left rule, olive-tinted surface, Ivy Mode tag
in olive. Reserved for editorial advice inside a section.

**Open item**: dashed olive frame, "OPEN QUESTION" badge. Used to flag data
gaps or upcoming research — the visual dashes signal "not final".

---

## 16. Reading box (scatter companion)

Source: lines 94–99.

```css
.cv-scatter-layout{display:grid;grid-template-columns:1.5fr 1fr;gap:40px;align-items:start;}
.reading-box{border:1px solid var(--taupe);background:var(--paper);padding:26px 28px;border-radius:2px;}
.reading-item{display:grid;grid-template-columns:120px 1fr;gap:16px;margin-bottom:20px;}
.reading-item:last-child{margin-bottom:0;}
.reading-item-label{font-family:'Ivy Mode',serif;font-size:18px;font-weight:400;letter-spacing:.01em;color:var(--ink);line-height:1.4;padding-top:1px;}
.reading-item-body{font-size:15.5px;color:var(--ink-mid);line-height:1.68;}
@media(max-width:800px){.cv-scatter-layout{grid-template-columns:1fr;} .reading-item{grid-template-columns:1fr;gap:6px;}}
```

Sits next to a scatter/current-view chart at 1.5:1 desktop; collapses to
single column at ≤800px.

---

## 17. Composition cards (tier bars)

Source: lines 102–139.

```css
.comp-card{border:1px solid var(--taupe);background:var(--paper);padding:22px 24px;margin-bottom:14px;border-radius:2px;position:relative;overflow:hidden;}
.comp-card > *{position:relative;z-index:1;}
.comp-card::before{                    /* centered #EDE9E7 hd monogram */
  content:"";position:absolute;inset:0;
  background:url("data:image/svg+xml;utf8,<svg …fill='%23EDE9E7'…/></svg>") center/auto 39% no-repeat;
  pointer-events:none;z-index:0;
}
.comp-card-top{background:rgba(171,115,110,.10);border-color:var(--p99);}
.comp-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;gap:12px;flex-wrap:wrap;}
.comp-name{font-family:'Ivy Mode',serif;font-size:20px;font-weight:400;color:var(--ink);}
.comp-total{font-size:15.5px;color:var(--ash);margin-left:9px;}
.comp-badge{font-size:16.5px;color:var(--ink-mid);text-align:right;}
.comp-badge strong{color:var(--rust);font-variant-numeric:tabular-nums;font-size:18px;}
.comp-labels{display:flex;margin-bottom:4px;}
.comp-labels span{text-align:center;font-size:13px;font-weight:700;color:var(--ink-mid);white-space:nowrap;font-variant-numeric:tabular-nums;}
.comp-bar-outer{height:13px;border-radius:2px;overflow:hidden;display:flex;background:var(--taupe);}
.comp-seg{height:13px;}
.seg-nonlux{background:rgba(110,74,92,.70);}   /* plum, 70% */
.seg-p90{background:#98A0A8;}                  /* Luxury */
.seg-p95{background:#918C7E;}                  /* Prime */
.seg-p99{background:#A37670;}                  /* Trophy */
.comp-key{display:flex;gap:18px;margin:16px 0 18px;font-size:14px;color:var(--ink-mid);flex-wrap:wrap;}
.comp-intensity{margin-top:14px;padding-top:13px;border-top:1px dashed var(--taupe);}
.comp-int-row{display:grid;grid-template-columns:100px 1fr 40px;align-items:center;gap:10px;}
.comp-int-label{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--olive);}
.comp-int-outer{height:8px;background:var(--taupe);border-radius:2px;}
.comp-int-fill{height:8px;border-radius:2px;background:var(--olive);}
.comp-int-pct{font-size:14px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums;color:var(--olive);}
```

**Watermark rule:** every `.comp-card` renders a centered `#EDE9E7` "hd"
monogram at 39% of the card height via `::before`. No container-level
watermark on the wrapping grid.

Mobile (≤640px): `.comp-card { padding: 18px 18px; }`; `.comp-top` stacks;
`.comp-name` 18px; badge 15px; `.comp-int-row` collapses to
`grid-template-columns: minmax(0,1fr) auto;` with the outer bar spanning
both columns.

---

## 18. Term / definition strip

Source: lines 128–131.

```css
.terms-strip{display:flex;flex-direction:column;gap:14px;margin:20px 0 28px;}
.term-row{background:var(--paper);border:1px solid var(--taupe);border-radius:2px;padding:16px 20px;display:grid;grid-template-columns:170px 1fr;gap:16px;align-items:baseline;}
.term-name{font-size:15.5px;font-weight:700;color:var(--ink);}
.term-def{font-size:15.5px;color:var(--ink-mid);line-height:1.55;}
```

Fixed 170px label column, definition fills remaining space. Mobile (≤640px)
collapses to single column with 6px gap and `padding: 14px 16px`.

---

## 19. Chips and pills

Source: lines 169–173.

```css
.chip{display:inline-block;padding:4px 10px;font-size:13.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:3px;}
.chip-soft{background:#E7E9EB;color:#455B69;}
.chip-stable{background:var(--paper);color:var(--olive);border:1px solid var(--taupe);}
.chip-newdev{background:#E2EBE5;color:#2E6645;}
.xref{display:inline-block;font-size:13px;font-weight:700;letter-spacing:.04em;color:#BA8C86;border:1px solid #BA8C86;border-radius:3px;padding:2px 9px;margin-left:3px;white-space:nowrap;text-decoration:none;}
```

- `.chip-soft` — neutral status (ash blue on cool gray).
- `.chip-stable` — "stable" or "flat" indicator.
- `.chip-newdev` — new-development flag.
- `.xref` — cross-reference pill inline in prose.

---

## 20. Tables

Base: standard section tables use `.cv-wrap` + `.cv-table`. Source: lines
72–87.

```css
.cv-wrap{overflow-x:auto;margin-top:24px;}
.cv-table{width:100%;border-collapse:collapse;min-width:960px;font-size:15.5px;}
.cv-table th{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--olive);padding:11px 12px;text-align:left;background:var(--paper);white-space:nowrap;}
.cv-table th.c{text-align:center;}
.cv-yr-row th{border-bottom:1px solid var(--taupe);}
.cv-sub-row th{border-bottom:2px solid var(--ink);font-size:11.5px;}
.cv-table td{padding:12px 12px;border-bottom:1px solid var(--taupe);vertical-align:top;}
.cv-table tr:hover td{background:rgba(0,0,0,.02);}
.cv-table td.cur-q{background:rgba(172,98,96,.05);}
```

Row-level accents:
- `.top-rank-row td { background: rgba(171,115,110,.10); }` — Trophy card
  highlight.
- `.top-rank-star { color: var(--p99); font-size: 14px; }` — inline mark.
- Ranks use `.rank-num` in `Courier New`.

Neighborhood cells (`.nbhd-name`, `.nbhd-tag`, `.nbhd-vol`): Ivy Mode 19px
name; italic ash 13px tag; 12.5px ash meta with `<strong>` promoted to
`--ink-mid`.

**Quarterly-cadence cells** in trend tables:
```css
.q-cell{min-width:80px;text-align:right;}
.q-ct{font-size:15px;color:var(--ink);line-height:1.25;}
.q-vol{font-size:15px;font-weight:700;color:var(--ink);}
.q-delta{font-size:13px;}
.q-delta .tag{color:var(--ash);font-size:12px;margin-right:2px;}
```

**PPSF trend variant** (`.ppsf-trend-tbl`, lines 38–52) — narrower, no
`min-width`, right-aligned, per-tier coloring:
```css
.ppsf-trend-tbl{font-size:15px;font-variant-numeric:tabular-nums;}
.ppsf-trend-tbl th,.ppsf-trend-tbl td{padding:11px 12px;text-align:right;}
.ppsf-trend-tbl th:first-child,.ppsf-trend-tbl td:first-child,.ppsf-trend-tbl td.tier-cell{text-align:left;}
.ppsf-trend-tbl th{font-size:12px;color:var(--olive);border-bottom:1px solid var(--taupe);}
.ppsf-trend-tbl td.tier-cell{font-weight:600;}
.ppsf-trend-tbl td.tier-cell.p90{color:var(--p90);}
.ppsf-trend-tbl td.tier-cell.p95{color:var(--p95);}
.ppsf-trend-tbl td.tier-cell.p99{color:var(--p99);}
.ppsf-trend-tbl .grp-b{border-left:1px solid var(--taupe);}
.ppsf-trend-tbl .yoy-ref{background:rgba(135,128,110,.06);}
.ppsf-trend-tbl .delta-ref{font-size:14.5px;color:var(--ink);margin-bottom:2px;}
.ppsf-trend-tbl .up,.ppsf-trend-tbl .dn{font-size:13px;}
```

Wrap wide tables in `.cv-wrap` / `.tbl-wrap` (`overflow-x: auto`) so mobile
swipes. On mobile (≤640px) reduce cell padding to `9px 10px` and body font
to 14px.

---

## 21. Charts

Chart.js render tokens:
- Tier bar/line/point fill: `--p90`, `--p95`, `--p99`.
- Grid lines: `rgba(28,26,24,.06)`.
- Axis text: `--ink-mid`, Jost 12px.
- Positive/negative shading: `--up-strong` / `--down-strong` at .12 alpha.

**Watermarks on canvas**:
- Single centered `#EDE9E7` mark on every chart card.
- Optional per-bar mini-marks in chart empty space; mini-mark opacity ≤
  card watermark opacity. Never exceed.

**Months of Supply — mobile horizontal scroll** (lines 199–201):
```css
.mos-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -20px;padding:0 20px 8px;scrollbar-width:thin;}
.mos-scroll-inner{min-width:640px;}
```

Charts render once. Animate first paint only; no reflow on rebuild.

---

## 22. Subheads

Source: line 138.

```css
.subhead{font-family:'Ivy Mode',serif;font-size:20px;font-weight:400;letter-spacing:.04em;color:var(--ink);margin:36px 0 16px;padding-bottom:10px;border-bottom:1px solid var(--taupe);}
.subhead:first-of-type{margin-top:10px;}
```

One-line, sentence case, taupe underline. Used to break long sections into
named passages ("The Velocity Paradox", "The Threshold Shift").

---

## 23. Numeric direction cues

```css
.up{color:var(--up-strong);font-weight:600;}   /* #2E6645 */
.dn{color:var(--down-strong);font-weight:600;} /* #9C2F26 */
.fl{color:var(--olive);}                       /* #75694E */
```

Never use raw web green or red. Never introduce a fourth direction color.
Deltas that are neither positive nor negative use `.fl` (flat).

---

## 24. Bottom line (closing statement)

Source: lines 155–159.

```css
.bottom-line{margin-top:72px;padding-top:56px;border-top:1px solid var(--taupe);text-align:center;}
.bl-mark{font-family:'Ivy Mode',serif;font-size:56px;line-height:1;color:var(--rust);opacity:.35;margin-bottom:6px;}
.bl-quote{font-family:'Ivy Mode',serif;font-size:23px;line-height:1.55;color:var(--ink);max-width:680px;margin:0 auto;text-wrap:balance;}
.bl-sig{margin-top:28px;font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:var(--olive);font-weight:700;}
.bl-sig span{display:block;font-size:12px;letter-spacing:.18em;color:var(--ash);font-weight:600;margin-top:5px;}
```

Placement: last block before the footer. `.bl-mark` renders a large rust
glyph (typically `❝` or `§`) at 35% opacity as the visual seal.

---

## 25. Footnotes

Source: lines 200–207.

```css
.footnotes{padding:36px 64px 44px;background:var(--paper);border-top:1px solid var(--taupe);}
.footnotes + .footnotes{border-top:none;padding-top:0;}
.footnotes-title{font-family:'Ivy Mode',serif;font-size:21px;font-weight:400;letter-spacing:.02em;color:var(--ink);margin-bottom:14px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;}
.footnotes-title::-webkit-details-marker{display:none;}
.footnotes-title::before{content:'\25B8';color:var(--rust);font-size:12px;transition:transform .15s ease;}
.footnotes[open] .footnotes-title::before{transform:rotate(90deg);}
.footnotes ul{padding-left:18px;font-size:14px;color:var(--ash);line-height:1.85;}
```

Rendered as `<details class="footnotes">`. Rust chevron rotates 90° when
open. Multiple back-to-back footnotes drop the interior top rule.

---

## 26. Watermark system

- Monogram color: `#EDE9E7`. Solid fill, full opacity. Never darker.
- Placement:
  - **Per card / per table**: centered background at
    `background-size: auto 39%`. Applied to `.comp-card` via `::before`
    (see §17). Extend the same pattern to any card-style container.
  - **Chart canvases**: single centered mark plus optional per-bar
    mini-marks in chart empty space. Mini-marks never exceed the card
    watermark opacity.
- **Never** apply a container-level mark on full-page grids or the
  document body — that reads as noise on the whitespace between cards.
- SVG source: the `hd` monogram path (see line 104 for the exact path
  data). Reuse via `src/lib/qr-design.ts` on React routes.

---

## 27. Motion system

Guarded by `prefers-reduced-motion: no-preference` (source lines 373–461).
The `<html>` gets `class="anim-ready"` at parse time so first paint stays
still; an IntersectionObserver toggles `is-visible` on each `.section` as
it scrolls in.

**Section-level fade**:
```css
html.anim-ready section.section{
  opacity:0;transform:translateY(28px);
  transition:opacity .85s ease-out, transform .85s ease-out;
  will-change:opacity,transform;
}
html.anim-ready section.section.is-visible{opacity:1;transform:none;}
```

**Child-level fade** — applied to `.hero-cell`, `.glance-item`,
`.watch-cell`, `.reading-item`, `.rec`, `.wtm-row`, `.comp-int-row`,
`.cv-yr-row`, `.term-row`, `.tbl-wrap`, `.cv-wrap`, `.reading-box`,
`.callout`, `.bottom-line`, `canvas`, `svg`:
```css
opacity:0;transform:translateY(16px);
transition:opacity .7s ease-out, transform .7s ease-out;
```

**Delay ladder** (direct-child stagger inside a visible section):
| nth-child | delay |
|---|---|
| 1 | 0s |
| 2 | .06s |
| 3 | .12s |
| 4 | .18s |
| n+5 | .24s |

**Grid-cell stagger** — hero/watch/wtm/comp rows use their own ladder:
| nth-child | delay |
|---|---|
| 1 | .05s |
| 2 | .13s |
| 3 | .21s |
| 4 | .29s |
| n+5 | .37s |

**Bar-wipe** — `.comp-int-fill`, `.comp-seg`, `.seg-p90/95/99/nonlux`
enter with `transform: scaleX(0); transform-origin: left center;` and
animate to `scaleX(1)` over `1.1s cubic-bezier(.2,.75,.2,1)` with a
`.25s` delay. Preserves the inline width used to encode the value.

**Mobile motion** (≤640px): reduce section rise to `translateY(12px)`,
duration `.55s`.

**Rules**:
- No parallax, no bounce, no auto-carousels, no hover flourish that
  changes layout.
- Charts render once and animate only the first paint.
- Any user setting `prefers-reduced-motion: reduce` disables the whole
  transcript automatically (the block never applies).

---

## 28. Responsive breakpoints

Four widths matter. Everything else scales linearly with `clamp()`.

| Width | Purpose | Rules |
|---|---|---|
| `≤960px` | Site header collapse | Nav, phone, MP strip hide; hamburger appears; header padding `3px 22px`; logo `76px` |
| `≤800px` | Scatter layout | `.cv-scatter-layout` and `.reading-item` collapse to 1 column |
| `≤700px` | Section chrome mobile | `.section { padding: 32px 24px }`, TOC becomes closed `<details>`, glance grid stacks to 1 column, masthead collapses |
| `≤640px` | Full mobile pass | Section title 26px, eyebrow 11.5px, hero+watch stack, active-inv 2+1 pattern, comp cards compress, tables 14px, MOS chart in horizontal scroll wrapper, callout body 15.5px |

Any page with wide content must set
`html, body { overflow-x: hidden; max-width: 100%; }` (line 18).

---

## 29. Accessibility

- Skip link (line 464) is the first focusable element. Style:
  `.skip-link { position:absolute; top:-40px; left:8px; background:#1B1714;
  color:#fff; padding:10px 16px; font-family:Jost; font-size:13.5px;
  letter-spacing:.14em; text-transform:uppercase; border-radius:2px;
  z-index:9999; }`. On focus: `top:8px; outline:2px solid #9E5040;
  outline-offset:2px;`.
- `.sr-only` for visually hidden accessible labels
  (`position:absolute;width:1px;height:1px;clip:rect(0,0,0,0);`).
- Minimum tap target 44×44px on every nav link, TOC link, and mobile
  menu control.
- Body copy uses `--ink-mid` on `--paper` (contrast ≥ 7:1). Reserve
  `--olive` for labels and eyebrows only, never for paragraphs.
- One `<h1>` per page. Semantic `<h2>` / `<h3>` order; do not skip levels.
- Alt text on every content image; `aria-label` on icon-only buttons.
- Each route sets a unique `<title>` (<60 chars) and meta description
  (<160 chars), plus `og:title`, `og:description`, `og:type`,
  `twitter:card`.
- Legal footer font-size floor: 12px.

---

## 30. Global footer

Every page shows the same footer stack, in this order:

1. Heather Domi wordmark.
2. Douglas Elliman logo directly under the Heather Domi wordmark.
3. Legal disclosure paragraph (must match `src/components/site-footer.tsx`).
4. Bold copyright line + bold `Domi Data™ Luxury Lines` line.
5. "Data Powered by Marketproof" with the Marketproof mark: 8.5px sans,
   16px logo height, color `#0a0a0a`, letter-spacing `.18em`, uppercase.
6. Attribution line: **When citing figures from this site, please credit
   "Domi Data by Heather Domi."**

The Marketproof credit is also rendered at the top-right of the site
header strip (see §6) — the two credits are the same spec.

---

## 31. Do / Don't quick list

**Do**
- Use Ivy Mode for numbers and titles, Jost for UI and body.
- Use olive for eyebrows, section labels, TOC label, recommendation rule.
- Reserve rust for the single accent gesture per surface: brand mark,
  callout chip, focus outline, footnote chevron.
- Apply `tabular-nums` on every numeral cell.
- Give every hero-class panel the 5px ink top rule and 2px ink border.
- Wrap wide tables and charts in scroll containers.
- Cite QR line numbers when adding a new component so the next author can
  verify parity.

**Don't**
- Em dashes, double hyphens, exclamation points, emoji.
- Vertical divider bars in the TOC unless the visual target demands them.
- Any tier color other than `--p90`, `--p95`, `--p99`.
- Raw web green or red for deltas.
- Purple, indigo, or neon gradients anywhere.
- Sentence-case eyebrows or lowercase section labels.
- Watermark darker than `#EDE9E7`.
- A left rust rule on `.callout` / `.key-takeaway`.
- Container-level watermarks on full-page grids.

---

## 32. Applying this rulebook

- **Static HTML report pages** (`public/*.html`): duplicate the `:root`
  block and the component CSS from `public/quarterly-brief.html`. Do not
  fork values. When in doubt, diff against the QR file at the line
  numbers cited above.
- **React routes** (`src/routes/*.tsx`, components): import shared tokens
  from `src/styles.css` and shared QR utilities from
  `src/lib/qr-design.ts` (monogram SVG, watermark injector, reveal
  observer). Never re-declare tokens locally.
- **Charts**: use the tier trio directly; do not derive shades.
- **New visual element**: check against §4 (roles), §5 (rhythm), §6–§17
  (components), §20 (tables), §27 (motion). If it doesn't fit an
  existing role, ask before inventing one; the QR either has an answer
  or the answer is deliberate absence.
