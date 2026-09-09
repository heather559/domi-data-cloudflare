/**
 * Shared visual language ported from public/quarterly-brief.html so
 * The Week, Neighborhoods, and the Foundational Report share the same
 * hero chrome, Ivy Mode figures, hd monogram watermarks, sticky TOC,
 * mobile hero scrim, and staggered fade-ins.
 *
 * Each surface pulls what it needs:
 *   - QR_DESIGN_CSS: injected via <style dangerouslySetInnerHTML>.
 *   - QR_MONOGRAM_SVG: inline <symbol id="hd-monogram">; referenced by <use>.
 *   - QR_DESIGN_SCRIPT: runs after the report DOM/canvas mounts to wrap
 *     tables and charts with the .wm-host watermark layer and to attach
 *     the IntersectionObserver reveal.
 *
 * Kept as strings (not JSX) so the same code applies inside
 * dangerouslySetInnerHTML report bodies without React remounting the
 * transient wm-host wrappers on data changes.
 */

export const QR_MONOGRAM_SVG = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <symbol id="hd-monogram" viewBox="0 0 1052.98 1068.79">
    <path d="M996.61,50h-74.44c-3.57,0-6.37,3.06-6.37,6.37v398.99c-53.8-56.6-126.45-86.68-211.35-86.68c-68.84,0-129.51,20.65-177.95,57.11c-48.44-36.46-109.12-57.11-177.95-57.11c-84.9,0-157.56,30.08-211.35,86.68V56.37c0-3.31-2.81-6.37-6.37-6.37H56.37C52.8,50,50,53.06,50,56.37v956.04c0,3.57,2.8,6.37,6.37,6.37h74.44c3.57,0,6.37-2.8,6.37-6.37V474.48c52.26-60.93,124.92-93.06,211.35-93.06c57.36,0,106.82,27.28,143.53,74.95C437.77,514,405.9,596.35,405.9,693.74c0,191.46,122.88,325.06,298.54,325.06c84.9,0,157.55-29.83,211.35-86.43v80.05c0,3.57,2.8,6.37,6.37,6.37h74.44c3.57,0,6.37-2.8,6.37-6.37V56.37C1002.98,53.06,1000.17,50,996.61,50z M559.89,929.82c-42.07-55.32-66.8-137.67-66.8-236.08c0-68.33,11.98-129,33.4-178.46c21.41,49.46,33.4,110.14,33.4,178.46V929.82z M915.79,913.24c-52.26,60.93-124.93,92.8-211.35,92.8c-20.14,0-39.52-3.31-57.36-9.94V693.74c0-97.39-31.87-179.74-86.17-237.35c36.72-47.67,86.17-74.95,143.54-74.95c86.42,0,159.09,32.12,211.35,93.06V913.24z"/>
  </symbol>
</svg>`;

export const QR_DESIGN_CSS = `
/* ── The Quarterly shared design language ────────────────────────── */

/* Ivy Mode statistical figures — apply the class to any hero/section stat. */
.qr-fig{font-family:'Ivy Mode','Times New Roman',Georgia,serif;font-weight:400;font-variant-numeric:tabular-nums;letter-spacing:-.005em;}
.qr-fig-bold{font-family:'Ivy Mode','Times New Roman',Georgia,serif;font-weight:700;font-variant-numeric:tabular-nums;}

/* Hero-box chrome (paper background, 5px rust top rule). */
.qr-hero-box{background:var(--paper,#F0EDE8);border-top:5px solid var(--rust,#AC6260);padding:44px 44px 40px;position:relative;}
@media(max-width:640px){ .qr-hero-box{padding:28px 20px 26px;} }

/* Ivy Mode tier titles (Luxury / Prime / Trophy). */
.qr-hero-tier{font-family:'Ivy Mode','Cormorant Garamond',serif;font-size:15px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:var(--ink,#1C1A18);-webkit-text-stroke:.4px currentColor;margin-bottom:8px;}
.qr-hero-num{font-family:'Ivy Mode','Times New Roman',Georgia,serif;font-size:2.2rem;font-weight:400;line-height:1;margin-bottom:6px;font-variant-numeric:tabular-nums;}
.qr-hero-floor-lbl{font-size:12px;color:var(--ash,#A37670);text-transform:uppercase;letter-spacing:.1em;font-weight:400;font-family:'Jost',system-ui,sans-serif;}

/* Sticky TOC. Height token comes from the site header; falls back to 0. */
.qr-toc-sticky{position:sticky;top:calc(var(--site-header-h,0px) - 1px);z-index:40;box-shadow:0 1px 0 rgba(28,26,24,.04);background:var(--paper,#F0EDE8);}

/* Shared TOC pattern — one slim horizontal scrolling bar at every width, matching The Month. */
.toc{display:block;padding:0;background:var(--paper,#F0EDE8);border-bottom:1px solid var(--taupe,#D8D2C6);height:44px;min-height:44px;max-height:44px;line-height:1;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
.toc[open]{height:44px;min-height:44px;max-height:44px;overflow-x:auto;overflow-y:hidden;}
.toc::-webkit-scrollbar{display:none;}
.toc-panel{min-width:0;height:44px;overflow:visible;}
.toc-panel::-webkit-scrollbar{display:none;}
.toc-label{display:none;}
.toc-items{display:flex;gap:4px;flex-wrap:nowrap;align-items:center;width:max-content;height:44px;padding:0 56px;}
.toc-item{display:flex;align-items:center;height:44px;min-height:44px;padding:0 14px;font-family:'Jost',system-ui,sans-serif;font-size:12px;font-weight:400;line-height:1;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mid,#3A3733);white-space:nowrap;text-decoration:none;border-right:none;}
.toc-items a{text-decoration:none;color:inherit;display:inline-flex;align-items:center;}
.toc-items a:hover .toc-item,.toc-item:hover,.toc-item:focus-visible{color:var(--ink,#1C1A18);text-decoration:underline;}
.toc-summary{display:none;}
.toc-chevron{display:none;}
@media(max-width:640px){
  .toc-items{padding:0 24px;}
}


/* Mobile hero scrim: keeps overlaid copy legible on small screens. */
@media(max-width:640px){
  .qr-scrim{position:relative;}
  .qr-scrim::before{content:"";position:absolute;left:0;right:0;bottom:0;height:160px;pointer-events:none;background:linear-gradient(to top,rgba(240,237,232,.92),rgba(240,237,232,0));z-index:1;}
  .qr-scrim > *{position:relative;z-index:2;}
}

/* HD monogram watermark host. */
.wm-host{position:relative;isolation:isolate;overflow:hidden;}
.wm-host > .wm-layer{position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;z-index:0;overflow:hidden;}
.wm-host > .wm-layer > svg{width:min(60%,220px);height:min(80%,140px);max-width:80%;max-height:80%;opacity:1;fill:#EDE9E7;}
.wm-host > :not(.wm-layer):not(.wm-diag):not(.sr-only){position:relative;z-index:1;}
@media print{ .wm-host > .wm-layer > svg{opacity:1;} }

/* Diagonal DOMI DATA text watermark — rendered alongside the monogram inside .wm-host. */
.wm-host > .wm-diag{position:absolute;top:50%;left:50%;width:230%;transform:translate(-50%,-50%) rotate(-28deg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;font-weight:600;letter-spacing:.28em;line-height:4.4;text-align:center;text-transform:uppercase;white-space:normal;word-spacing:8px;color:rgba(146,140,124,.11);pointer-events:none;user-select:none;z-index:0;}


/* Staggered fade-ins. Sections opt-in via class "qr-reveal-scope". */
@media (prefers-reduced-motion: no-preference){
  html.qr-anim-ready .qr-reveal{opacity:0;transform:translateY(18px);transition:opacity .7s ease-out, transform .7s ease-out;will-change:opacity,transform;}
  html.qr-anim-ready .qr-reveal.qr-in{opacity:1;transform:none;}
}

/* Mobile: horizontally scroll wide charts/tables. */
@media(max-width:640px){
  .qr-hscroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
  .qr-hscroll::-webkit-scrollbar{display:none;}
}
`;

/**
 * Watermark + reveal script. Runs safely multiple times: wrap() guards against
 * re-wrapping an element that already has a .wm-host parent.
 *
 * Selectors passed in `wmSel` are queried inside the scope element (defaults
 * to document). Charts often mount after the initial pass, so the script runs
 * once immediately and once on window `load`.
 */
export function buildQrDesignScript(opts: {
  scopeSelector?: string;
  wmSel?: string;
  revealSel?: string;
} = {}): string {
  const scope = opts.scopeSelector ? JSON.stringify(opts.scopeSelector) : "null";
  const wm = JSON.stringify(opts.wmSel ?? "table, canvas");
  const reveal = JSON.stringify(opts.revealSel ?? "section, .section, .qr-hero-box, .tbl-wrap, .chart-container, .stat-grid, canvas");
  return `
(function(){
  var root = document.documentElement;
  root.classList.add('qr-anim-ready');
  var scopeEl = ${scope} ? document.querySelector(${scope}) : document;
  if(!scopeEl) return;

  // ── HD monogram watermark ──
  function wrap(el){
    if(!el || !el.parentNode) return;
    if(el.parentNode.classList && el.parentNode.classList.contains('wm-host')) return;
    // Skip elements inside cards that already draw their own centered mark.
    if(el.classList && el.classList.contains('sr-only')) return;
    if(el.closest && (el.closest('.sr-only') || el.closest('.comp-card') || el.closest('.qr-no-wm'))) return;
    var host = document.createElement('div');
    host.className = 'wm-host';
    var layer = document.createElement('div');
    layer.className = 'wm-layer';
    layer.innerHTML = '<svg viewBox="0 0 1052.98 1068.79" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><use href="#hd-monogram"/></svg>';
    var diag = document.createElement('div');
    diag.className = 'wm-diag';
    diag.setAttribute('aria-hidden','true');
    diag.textContent = 'DOMI DATA\u2122   HEATHER DOMI   \u00b7   DOMI DATA\u2122   HEATHER DOMI   \u00b7   DOMI DATA\u2122   HEATHER DOMI';
    el.parentNode.insertBefore(host, el);
    host.appendChild(layer);
    host.appendChild(diag);
    host.appendChild(el);
  }
  function applyWM(){ scopeEl.querySelectorAll(${wm}).forEach(wrap); }

  applyWM();
  if(document.readyState !== 'complete'){ window.addEventListener('load', applyWM); }

  // ── Staggered fade-in ──
  var prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(prefersReduce || !('IntersectionObserver' in window)) return;
  var targets = scopeEl.querySelectorAll(${reveal});
  targets.forEach(function(t){ t.classList.add('qr-reveal'); });
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('qr-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
  targets.forEach(function(t){
    var r = t.getBoundingClientRect();
    if(r.top < window.innerHeight * 0.95){
      requestAnimationFrame(function(){ t.classList.add('qr-in'); });
    } else {
      io.observe(t);
    }
  });
})();
`;
}
