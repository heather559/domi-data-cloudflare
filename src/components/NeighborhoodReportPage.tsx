import { useEffect, useRef } from "react";
import { LeadForm } from "@/components/lead-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPeriodEndDate, type NeighborhoodReport, type NeighborhoodPayload } from "@/lib/neighborhood-report.functions";
import reportCss from "@/lib/neighborhood-report.css?raw";
import { NEIGHBORHOOD_BANNERS } from "@/lib/neighborhood-banners";



import { QR_DESIGN_CSS, QR_MONOGRAM_SVG, buildQrDesignScript } from "@/lib/qr-design";
import { srTable, zipSeries, srSummary, describeSeries, describeParts, SR_ONLY_STYLE } from "@/lib/sr-table";


// Brand palette — used across every chart on this page.
const BRAND = {
  accent: "#98A0A8",
  gold: "#918C7E",
  rust: "#9E5040",
  textMid: "#8796A1",
  ash: "#A37670",
} as const;

const TIER_COLORS = {
  Luxury: "#98A0A8",
  Prime: "#918C7E",
  Trophy: "#A37670",
} as const;

// Original Domi Data donut: colors, bedroom ordering and radiating labels
// carried over verbatim from The Week's canvas renderer.
const DONUT_COLORS = ["#969FA8", "#AA8B84", "#8A8179", "#9A9280", "#C0BAB0"];

function donutBedIndex(label: unknown): number {
  const l = String(label || "").toLowerCase();
  if (l.indexOf("studio") === 0) return 0;
  if (l.indexOf("4") === 0) return 4;
  if (l.indexOf("3") === 0) return 3;
  if (l.indexOf("2") === 0) return 2;
  if (l.indexOf("1") === 0) return 1;
  return 5;
}

function BedroomDonut({ id, data, center, label }: { id: string; data: Array<{ label: string; value?: number; fmt: string }>; center: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ordered = [...(data || [])].sort((a, b) => donutBedIndex(a.label) - donutBedIndex(b.label));
    const positive = ordered.filter((item) => Number(item.value) > 0);
    const total = positive.reduce((sum, item) => sum + Number(item.value), 0);
    const context = canvas.getContext("2d");
    if (!context || !total) return;

    const size = 360;
    // Extra vertical room so a fully-nudged label stack (Studio + 4+ Beds +
    // 1-Bed) clears the card edge and the heading above the donut.
    const height = 430;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = height * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size, height);

    const cx = size / 2;
    const cy = height / 2;
    const outerR = 96;
    const innerR = outerR * 0.58;
    const gap = 0.014;
    let angle = -Math.PI / 2;
    const slices: Array<{ mid: number; color: string; label: string; fmt: string }> = [];
    const zeroCount = ordered.length - positive.length;
    const zeroSweep = 0.045;
    const drawableSweep = Math.PI * 2 - gap * ordered.length - zeroSweep * zeroCount;

    ordered.forEach((item) => {
      const color = DONUT_COLORS[donutBedIndex(item.label) % DONUT_COLORS.length];
      const value = Number(item.value);
      const sweep = value > 0 ? (value / total) * drawableSweep : zeroSweep;
      context.beginPath();
      context.arc(cx, cy, outerR, angle + gap / 2, angle + gap / 2 + sweep, false);
      context.arc(cx, cy, innerR, angle + gap / 2 + sweep, angle + gap / 2, true);
      context.closePath();
      context.fillStyle = color;
      context.fill();
      slices.push({ mid: angle + gap / 2 + sweep / 2, color, label: item.label, fmt: item.fmt });
      angle += sweep + gap;
    });

    const numericCenter = ordered.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const safeCenter = center && center !== "undefined"
      ? center
      : label.toLowerCase().includes("dollar volume")
        ? `$${(numericCenter / 1_000_000).toFixed(numericCenter >= 100_000_000 ? 0 : 2)}M`
        : String(Math.round(numericCenter));
    context.fillStyle = "#1B1714";
    context.font = "bold 18px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(safeCenter, cx, cy);

    // Keep the five labels in stable positions around the ring. The Week's
    // source data usually has five non-zero slices, while neighborhood months
    // can contain zero-value Studio or 4+ segments that have no arc midpoint.
    const labelAngles = [-Math.PI / 2, -0.75, 0.75, 2.5, -2.5];
    const labels = ordered.map((item) => {
      const slice = slices.find((s) => s.label === item.label);
      return {
        ...(slice ?? {
          color: DONUT_COLORS[donutBedIndex(item.label) % DONUT_COLORS.length],
        }),
        mid: slice ? slice.mid : (labelAngles[donutBedIndex(item.label)] ?? 1.57),
        label: item.label,
        fmt: item.fmt,
      };
    });
    const labelR = outerR + 22;

    // Collision avoidance: resolve measured two-line text boxes against every
    // other label, regardless of which side of the donut each label occupies.
    const placed = labels.map((l) => {
      const naturalLx = cx + Math.cos(l.mid) * labelR;
      const naturalLy = cy + Math.sin(l.mid) * labelR;
      context.font = "11px system-ui";
      const labelWidth = context.measureText(l.label).width;
      context.font = "bold 12px Georgia, serif";
      const valueWidth = context.measureText(l.fmt).width;
      return {
        ...l,
        naturalLx,
        naturalLy,
        lx: naturalLx,
        ly: naturalLy,
        boxWidth: Math.max(labelWidth, valueWidth) + 8,
        boxHeight: 26,
      };
    });
    const LABEL_PADDING = 14;
    const boxesOverlap = (a: typeof placed[number], b: typeof placed[number]) =>
      Math.abs(a.lx - b.lx) < (a.boxWidth + b.boxWidth) / 2 + LABEL_PADDING &&
      Math.abs(a.ly - b.ly) < (a.boxHeight + b.boxHeight) / 2 + LABEL_PADDING;
    const clampLabel = (item: typeof placed[number]) => {
      const halfHeight = item.boxHeight / 2;
      item.ly = Math.max(18 + halfHeight, Math.min(height - 14 - halfHeight, item.ly));
    };
    // Keep a label clear of the ring itself: if it sits within the donut's
    // vertical band, push it horizontally past the outer radius.
    const clearRing = (item: typeof placed[number]) => {
      const half = item.boxWidth / 2;
      const halfH = item.boxHeight / 2;
      const nearX = Math.abs(item.lx - cx) < outerR + 8 + half;
      const nearY = Math.abs(item.ly - cy) < outerR + 8 + halfH;
      if (nearX && nearY) {
        if (Math.abs(Math.cos(item.mid)) > 0.35) {
          const dir = Math.cos(item.mid) >= 0 ? 1 : -1;
          item.lx = cx + dir * (outerR + 8 + half);
        } else {
          const dir = Math.sin(item.mid) >= 0 ? 1 : -1;
          item.ly = cy + dir * (outerR + 10 + halfH);
        }
      }
      item.lx = Math.max(half + 4, Math.min(size - half - 4, item.lx));
      item.ly = Math.max(18 + halfH, Math.min(height - 14 - halfH, item.ly));
    };

    // Cluster mutually-colliding labels (transitively), then fan each cluster of
    // 2+ out at diverging angles instead of stacking them in one vertical column.
    const fanned = new Set<number>();
    const parent = placed.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        if (boxesOverlap(placed[i], placed[j])) parent[find(i)] = find(j);
      }
    }
    const clusters = new Map<number, number[]>();
    placed.forEach((_, i) => {
      const root = find(i);
      const list = clusters.get(root) ?? [];
      list.push(i);
      clusters.set(root, list);
    });
    const FAN_STEP = (14 * Math.PI) / 180;
    const FAN_R = labelR + 24;
    clusters.forEach((members) => {
      if (members.length < 2) return;
      // Unwrap angles around the first member so averaging survives the -PI/PI seam.
      const base = placed[members[0]].mid;
      const unwrapped = members.map((idx) => {
        let a = placed[idx].mid;
        while (a - base > Math.PI) a -= Math.PI * 2;
        while (a - base < -Math.PI) a += Math.PI * 2;
        return { idx, a };
      });
      unwrapped.sort((p, q) => p.a - q.a);
      const avg = unwrapped.reduce((sum, p) => sum + p.a, 0) / unwrapped.length;
      const mid = (unwrapped.length - 1) / 2;
      unwrapped.forEach((p, order) => {
        const target = avg + (order - mid) * FAN_STEP;
        const item = placed[p.idx];
        item.lx = cx + Math.cos(target) * FAN_R;
        item.ly = cy + Math.sin(target) * FAN_R;
        fanned.add(p.idx);
        clampLabel(item);
        clearRing(item);
      });
    });

    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i];
          const b = placed[j];
          if (!boxesOverlap(a, b)) continue;
          moved = true;
          const overlapY =
            (a.boxHeight + b.boxHeight) / 2 + LABEL_PADDING - Math.abs(a.ly - b.ly);
          const separation = overlapY / 2 + 1;
          if (a.ly <= b.ly) {
            a.ly -= separation;
            b.ly += separation;
          } else {
            a.ly += separation;
            b.ly -= separation;
          }
          clampLabel(a);
          clampLabel(b);
          clearRing(a);
          clearRing(b);
        }
      }
      if (!moved) break;
    }

    placed.forEach((slice, idx) => {
      const { lx, ly } = slice;
      if (fanned.has(idx) || Math.hypot(lx - slice.naturalLx, ly - slice.naturalLy) > 8) {
        const LINE_END_GAP = 14;
        const startX = cx + Math.cos(slice.mid) * (outerR + 4);
        const startY = cy + Math.sin(slice.mid) * (outerR + 4);
        const dx = lx - startX;
        const dy = ly - startY;
        const dist = Math.hypot(dx, dy);
        const endX = dist > LINE_END_GAP ? lx - (dx / dist) * LINE_END_GAP : lx;
        const endY = dist > LINE_END_GAP ? ly - (dy / dist) * LINE_END_GAP : ly;
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.lineWidth = 1;
        context.strokeStyle = "rgba(27,23,20,0.25)";
        context.stroke();
      }

      const cosA = Math.cos(slice.mid);
      context.textAlign = cosA > 0.15 ? "left" : cosA < -0.15 ? "right" : "center";
      context.fillStyle = "#6B6560";
      context.font = "11px system-ui";
      context.fillText(slice.label, lx, ly - 7);
      context.fillStyle = slice.color;
      context.font = "bold 12px Georgia, serif";
      context.fillText(slice.fmt, lx, ly + 8);
    });


  }, [center, data]);

  return (
    <div className="bedroom-donut wm-host">
      <div className="wm-layer" aria-hidden="true">
        <svg viewBox="0 0 1052.98 1068.79" preserveAspectRatio="xMidYMid meet">
          <use href="#hd-monogram" />
        </svg>
      </div>
      <canvas ref={canvasRef} id={id} role="img" aria-label={label} />
    </div>
  );
}

const TYPE_COLORS = { condo: "#9E5040", coop: "#75694E", townhouse: "#98A0A8" } as const;


// ── Shared hand-rolled canvas engine (verbatim from The Week) ──
// Returned as a string, appended into the inline <script> for this page.
function buildChartEngine(): string {
  return `
function setupCanvas(canvas, h) {
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
  var W = Math.max(canvas.clientWidth || 0, rect && rect.width ? rect.width : 0, 320);
  canvas.style.width = '100%';
  canvas.width = W * dpr; canvas.height = h * dpr;
  canvas.style.height = h + 'px';
  var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  return { ctx: ctx, W: W, H: h };
}
function hexToRgb(hex) {
  var m = hex.replace('#','');
  if (m.length === 3) m = m.split('').map(function(c){return c+c;}).join('');
  return { r: parseInt(m.slice(0,2),16), g: parseInt(m.slice(2,4),16), b: parseInt(m.slice(4,6),16) };
}
function softenColor(hex) {
  return hex;
}
function niceLog125(minV, maxV) {
  var steps = [1, 2, 5];
  function floorFor(v) {
    if (v <= 0) v = 1;
    var k = Math.floor(Math.log(v) / Math.LN10);
    var best = Math.pow(10, k);
    for (var i = 0; i < steps.length; i++) {
      var cand = steps[i] * Math.pow(10, k);
      if (cand <= v) best = cand;
    }
    return best;
  }
  function ceilFor(v) {
    if (v <= 0) v = 1;
    var k = Math.floor(Math.log(v) / Math.LN10);
    var options = [1,2,5,10];
    for (var i = 0; i < options.length; i++) {
      var cand = options[i] * Math.pow(10, k);
      if (cand >= v) return cand;
    }
    return Math.pow(10, k + 1);
  }
  var lo = floorFor(minV);
  var hi = ceilFor(maxV);
  if (hi <= lo) hi = lo * 10;
  return { min: lo, max: hi };
}
function niceLinear(minV, maxV, padPct) {
  padPct = padPct == null ? 0.1 : padPct;
  var range = Math.max(maxV - minV, Math.abs(maxV) * 0.02, 1);
  return { min: minV - range * padPct, max: maxV + range * padPct };
}
function fmtTickShort(v) {
  var a = Math.abs(v);
  if (a >= 1e9) return (v/1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (v/1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
  if (a >= 1e3) return (v/1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
  if (a >= 10)  return Math.round(v).toString();
  if (a >= 1)   return v.toFixed(1);
  return v.toFixed(2);
}
var __chartModal = null;
function getChartModal() {
  if (__chartModal) return __chartModal;
  var overlay = document.createElement('div');
  overlay.className = 'chart-modal neighborhood-report-scope';
  overlay.setAttribute('hidden', '');
  overlay.innerHTML =
    '<div class="chart-modal__backdrop"></div>' +
    '<div class="chart-modal__panel">' +
      '<button class="chart-modal__close" aria-label="Close">×</button>' +
      '<div class="chart-modal__eyebrow"></div>' +
      '<div class="chart-modal__title"></div>' +
      '<div class="chart-modal__subtitle"></div>' +
      '<div class="wm-host chart-modal__canvas-wrap">' +
        '<div class="wm-layer"><svg viewBox="0 0 1052.98 1068.79" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><use href="#hd-monogram"/></svg></div>' +
        '<canvas class="chart-modal__canvas"></canvas>' +
      '</div>' +
      '<div class="chart-modal__legend"></div>' +
    '</div>';
  document.body.appendChild(overlay);
  var state = {
    overlay: overlay,
    canvas: overlay.querySelector('.chart-modal__canvas'),
    eyebrow: overlay.querySelector('.chart-modal__eyebrow'),
    title: overlay.querySelector('.chart-modal__title'),
    subtitle: overlay.querySelector('.chart-modal__subtitle'),
    legend: overlay.querySelector('.chart-modal__legend'),
    currentOpts: null
  };
  function close(){ overlay.setAttribute('hidden',''); state.currentOpts = null; }
  overlay.querySelector('.chart-modal__backdrop').addEventListener('click', close);
  overlay.querySelector('.chart-modal__close').addEventListener('click', close);
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) close();
  });
  window.addEventListener('resize', function(){
    if (state.currentOpts) (state.currentRender || drawLineChart)(state.canvas, state.currentOpts);
  });
  __chartModal = state;
  return state;
}
function openChartModal(opts, title, renderFn) {
  var m = getChartModal();
  m.overlay.removeAttribute('hidden');
  m.title.textContent = title || '';
  if (m.eyebrow) { m.eyebrow.textContent = opts.eyebrow || ''; m.eyebrow.style.display = opts.eyebrow ? '' : 'none'; }
  if (m.subtitle) { m.subtitle.textContent = opts.subtitle || ''; m.subtitle.style.display = opts.subtitle ? '' : 'none'; }
  var big = {};
  for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts,k)) big[k] = opts[k];
  big.height = 360;
  big.interactive = true;
  big.pad = { t: 20, r: 24, b: 34, l: 60 };
  m.currentOpts = big;
  m.currentRender = renderFn || drawLineChart;
  var lg = '';
  (opts.series || []).forEach(function(s){
    if (!s.label) return;
    lg += '<span class="chart-modal__legitem"><span class="chart-modal__sw" style="background:' + s.color + '"></span>' + s.label + '</span>';
  });
  m.legend.innerHTML = lg;
  requestAnimationFrame(function(){ m.currentRender(m.canvas, big); });
}
function ensureChartHolder(canvas, opts) {
  var parent = canvas.parentElement;
  if (!parent) return null;
  if (!parent.classList.contains('chart-holder')) {
    parent.classList.add('chart-holder');
    parent.style.position = 'relative';
  }
  try {
    canvas.setAttribute('role', 'img');
    var lbl = (opts && opts.ariaLabel) || (opts && opts.title) || 'Data chart';
    canvas.setAttribute('aria-label', String(lbl));
  } catch (e) {}

  if (!canvas._tipEl) {
    var tip = document.createElement('div'); tip.className = 'chart-tip';
    tip.style.position = 'absolute';
    var cross = document.createElement('div'); cross.className = 'chart-crosshair';
    cross.style.position = 'absolute';
    parent.appendChild(cross); parent.appendChild(tip);
    canvas._tipEl = tip; canvas._crossEl = cross;
  }
  if (!canvas._expandBtn && opts.interactive !== false) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chart-expand';
    btn.setAttribute('aria-label', 'Expand chart');
    btn.title = 'Expand';
    btn.innerHTML = '⤢';
    parent.appendChild(btn);
    btn.addEventListener('click', function(){
      openChartModal(canvas._chartOpts || opts, (canvas._chartOpts && canvas._chartOpts.title) || opts.title || '', canvas._renderFn || null);
    });
    canvas._expandBtn = btn;
  }
  return parent;
}
function bindChartInteraction(canvas) {
  if (canvas._interactBound) return;
  canvas._interactBound = true;
  function onMove(e) {
    var meta = canvas._chartMeta; var opts = canvas._chartOpts;
    if (!meta || !opts) return;
    var rect = canvas.getBoundingClientRect();
    var liveW = rect.width || meta.W;
    var scale = (liveW > 0) ? (meta.W / liveW) : 1;
    var xAdj = (e.clientX - rect.left) * scale;
    if (xAdj < meta.pad.l || xAdj > meta.pad.l + meta.cW) { onLeave(); return; }
    var frac = (xAdj - meta.pad.l) / meta.cW;
    var idx = Math.round(frac * Math.max(meta.n - 1, 1));
    if (idx < 0) idx = 0; if (idx > meta.n - 1) idx = meta.n - 1;
    var xPix = meta.xp(idx) / scale;
    var oxL = canvas.offsetLeft || 0;
    var oxT = canvas.offsetTop || 0;
    var cross = canvas._crossEl;
    cross.style.display = 'block';
    cross.style.left = (xPix + oxL) + 'px';
    cross.style.top = (meta.pad.t + oxT) + 'px';
    cross.style.height = meta.cH + 'px';
    var tip = canvas._tipEl;
    var yFmt = opts.yFmt || fmtTickShort;
    var lbl = '';
    if (opts.xLabels && opts.xLabels.length) {
      var raw = opts.xLabels[Math.min(idx, opts.xLabels.length - 1)] || '';
      if (opts.xLabelsAreDates !== false) {
        var d = new Date(String(raw));
        lbl = (!isNaN(d.getTime())) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : String(raw);
      } else {
        lbl = String(raw);
      }
    } else {
      lbl = 'Point ' + (idx + 1);
    }
    var html = '<div class="chart-tip__date">' + lbl + '</div>';
    (opts.series || []).forEach(function(s){
      var v = s.data[idx];
      var valTxt = (typeof v === 'number' && isFinite(v)) ? yFmt(v) : '—';
      html += '<div class="chart-tip__row">' +
        '<span class="chart-tip__sw" style="background:' + s.color + '"></span>' +
        '<span class="chart-tip__lab">' + (s.label || '') + '</span>' +
        '<span class="chart-tip__val">' + valTxt + '</span>' +
        '</div>';
    });
    tip.innerHTML = html;
    tip.style.display = 'block';
    var tipW = tip.offsetWidth || 160;
    var leftLocal = xPix + 12;
    if (leftLocal + tipW > meta.W - 4) leftLocal = xPix - tipW - 12;
    if (leftLocal < 4) leftLocal = 4;
    tip.style.left = (leftLocal + oxL) + 'px';
    tip.style.top = (meta.pad.t + 4 + oxT) + 'px';
  }
  function onLeave() {
    if (canvas._crossEl) canvas._crossEl.style.display = 'none';
    if (canvas._tipEl) canvas._tipEl.style.display = 'none';
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
}
function drawLineChart(canvas, opts) {
  if (!canvas) return;
  var series = (opts.series || []).filter(function(s){ return s.data && s.data.length; });
  if (!series.length) return;
  var n = 0;
  series.forEach(function(s){ if (s.data.length > n) n = s.data.length; });
  var pad = opts.pad || { t: 14, r: 32, b: 22, l: 40 };
  if (opts.endLabels) pad = { t: pad.t, r: Math.max(pad.r, 130), b: pad.b, l: pad.l };
  var height = opts.height || 160;
  var st = setupCanvas(canvas, height);
  var ctx = st.ctx, W = st.W, H = st.H;
  var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var allV = [];
  series.forEach(function(s){ s.data.forEach(function(v){ if (typeof v === 'number' && isFinite(v)) allV.push(v); }); });
  if (!allV.length) return;
  var minV = Math.min.apply(null, allV), maxV = Math.max.apply(null, allV);
  var scale, isLog = (opts.scaleType === 'log');
  if (isLog) {
    var pos = allV.filter(function(v){return v > 0;});
    if (!pos.length) return;
    scale = niceLog125(Math.min.apply(null, pos), Math.max.apply(null, pos));
  } else {
    scale = niceLinear(minV, maxV, 0.12);
  }
  ctx.clearRect(0, 0, W, H);
  var ticks;
  if (isLog) {
    ticks = [];
    var lo = scale.min, hi = scale.max;
    var kLo = Math.floor(Math.log(lo) / Math.LN10), kHi = Math.ceil(Math.log(hi) / Math.LN10);
    for (var k = kLo; k <= kHi; k++) {
      [1,2,5].forEach(function(m){
        var val = m * Math.pow(10, k);
        if (val >= lo && val <= hi) ticks.push(val);
      });
    }
    if (ticks.length > 6) ticks = ticks.filter(function(_,idx){ return idx % 2 === 0; });
  } else {
    var span = scale.max - scale.min;
    var step = span / 4;
    ticks = [scale.min, scale.min + step, scale.min + 2*step, scale.min + 3*step, scale.max];
  }
  function xp(i) { return pad.l + (i / Math.max(n - 1, 1)) * cW; }
  function yp(v) {
    if (isLog) {
      if (v <= 0) return pad.t + cH;
      var t = (Math.log(v) - Math.log(scale.min)) / (Math.log(scale.max) - Math.log(scale.min));
      return pad.t + cH - t * cH;
    }
    return pad.t + cH - ((v - scale.min) / (scale.max - scale.min)) * cH;
  }
  ctx.strokeStyle = 'rgba(27,23,20,0.16)'; ctx.lineWidth = 1;
  ctx.font = '11px system-ui'; ctx.textAlign = 'right';
  ticks.forEach(function(v){
    var y = yp(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
    ctx.fillStyle = 'rgba(27,23,20,0.7)';
    ctx.fillText((opts.yFmt || fmtTickShort)(v), pad.l - 4, y + 3);
  });
  if (opts.xLabels && opts.xLabels.length) {
    var labs = opts.xLabels;
    var picks = 4;
    ctx.fillStyle = 'rgba(27,23,20,0.7)'; ctx.textAlign = 'center';
    for (var p = 0; p < picks; p++) {
      var idxL = Math.round((labs.length - 1) * (p / (picks - 1)));
      var lbl = labs[idxL] || '';
      var text = String(lbl);
      if (opts.xLabelsAreDates !== false) {
        var d = new Date(String(lbl));
        if (!isNaN(d.getTime())) text = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
      ctx.fillText(text, xp(idxL), H - pad.b + 12);
    }
  }
  var markStep = 1;
  if (n > 20) markStep = Math.max(1, Math.round(n / 14));
  var pendingEndLabels = [];
  function drawMarker(cx, cy, shape, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.25;
    var r = 3.6;
    if (shape === 'square') {
      ctx.beginPath(); ctx.rect(cx - r, cy - r, r*2, r*2); ctx.fill(); ctx.stroke();
    } else if (shape === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (shape !== 'none') {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  series.forEach(function(s){
    var soft = softenColor(s.color);
    ctx.save();
    if (s.dash && s.dash.length) ctx.setLineDash(s.dash);
    ctx.beginPath();
    var started = false;
    for (var i = 0; i < s.data.length; i++) {
      var v = s.data[i];
      if (typeof v !== 'number' || !isFinite(v) || (isLog && v <= 0)) { started = false; continue; }
      var x = xp(i), y = yp(v);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = soft; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
    var firstValid = -1, lastValid = -1;
    for (var fi = 0; fi < s.data.length; fi++) {
      var fv = s.data[fi];
      if (typeof fv === 'number' && isFinite(fv) && (!isLog || fv > 0)) { if (firstValid < 0) firstValid = fi; lastValid = fi; }
    }
    var isValid = function(idx) {
      if (idx < 0 || idx >= s.data.length) return false;
      var vv = s.data[idx];
      return typeof vv === 'number' && isFinite(vv) && (!isLog || vv > 0);
    };
    var shape = s.marker || 'circle';
    for (var m2 = 0; m2 < s.data.length; m2++) {
      var mv = s.data[m2];
      if (typeof mv !== 'number' || !isFinite(mv) || (isLog && mv <= 0)) continue;
      var prevValid = isValid(m2 - 1), nextValid = isValid(m2 + 1);
      var atRunEdge = !prevValid || !nextValid;
      var show = atRunEdge || (m2 === firstValid) || (m2 === lastValid) || (m2 % markStep === 0);
      if (!show) continue;
      drawMarker(xp(m2), yp(mv), shape, s.color);
    }

    if (opts.endLabels && lastValid >= 0 && s.label) {
      pendingEndLabels.push({ text: s.label, color: s.color, x: xp(lastValid) + 6, y: yp(s.data[lastValid]) + 3 });
    }
  });
  if (pendingEndLabels.length) {
    pendingEndLabels.sort(function(a, b) { return a.y - b.y; });
    for (var pl = 1; pl < pendingEndLabels.length; pl++) {
      var prev = pendingEndLabels[pl - 1], cur = pendingEndLabels[pl];
      if (cur.y - prev.y < 12) cur.y = prev.y + 12;
    }
    ctx.font = 'bold 11.5px system-ui';
    ctx.textAlign = 'left';
    pendingEndLabels.forEach(function(lbl) {
      ctx.fillStyle = lbl.color;
      ctx.fillText(lbl.text, lbl.x, lbl.y);
    });
  }
  if (opts.interactive !== false) {
    ensureChartHolder(canvas, opts);
    canvas._chartOpts = opts;
    canvas._chartMeta = { pad: pad, cW: cW, cH: cH, W: W, H: H, n: n, isLog: isLog, scale: scale, xp: xp, yp: yp };
    bindChartInteraction(canvas);
  }
}
function drawDemand(canvas, d) {
  if (!canvas || !d || !Array.isArray(d.counts) || !d.counts.length) return;
  var counts = d.counts;
  // Some payloads omit rolling3 / lastIndex / short labels. Derive them here so
  // the bar-and-line chart never blanks out on an incomplete snapshot.
  var rolling = (Array.isArray(d.rolling3) && d.rolling3.length === counts.length)
    ? d.rolling3
    : counts.map(function (_, i) {
        var win = counts.slice(Math.max(0, i - 2), i + 1);
        var sum = win.reduce(function (s, v) { return s + (typeof v === 'number' ? v : 0); }, 0);
        return Math.round((sum / win.length) * 10) / 10;
      });
  var labels = Array.isArray(d.labels) ? d.labels : [];
  var lastIdx = (typeof d.lastIndex === 'number') ? d.lastIndex : counts.length - 1;
  var n = counts.length;

  var pad = { t: 14, r: 12, b: 22, l: 40 };
  var height = 240;
  var st = setupCanvas(canvas, height);
  var ctx = st.ctx, W = st.W, H = st.H;
  var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var allV = counts.slice();
  rolling.forEach(function(v){ if (typeof v==='number' && isFinite(v)) allV.push(v); });
  var rawMax = Math.max.apply(null, allV.length ? allV : [1]);
  function niceMaxDemand(v) {
    if (!isFinite(v) || v <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var norm = v / mag;
    var step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * mag;
  }
  var scale = { min: 0, max: niceMaxDemand(rawMax) };
  ctx.clearRect(0,0,W,H);
  var span = scale.max - scale.min;
  var ticks = [0, span/4, span/2, 3*span/4, span];
  ctx.strokeStyle='rgba(27,23,20,0.16)'; ctx.lineWidth=1;
  ctx.font='11px system-ui'; ctx.textAlign='right';
  function yp(v){ return pad.t + cH - ((v - scale.min)/(scale.max - scale.min)) * cH; }
  function xp(i){ return pad.l + (i + 0.5) * (cW / n); }
  ticks.forEach(function(v){
    var y=yp(v);
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cW,y); ctx.stroke();
    ctx.fillStyle='rgba(27,23,20,0.7)';
    ctx.fillText(fmtTickShort(v), pad.l-4, y+3);
  });
  var barW = (cW / n) * 0.62;
  counts.forEach(function(v, i){
    var x = xp(i) - barW/2;
    var y = yp(v);
    ctx.fillStyle = (i === lastIdx) ? '#AC6260' : '#C9ABA6';
    ctx.fillRect(x, y, barW, pad.t + cH - y);
  });
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([4, 3]);
  var started = false;
  for (var i = 0; i < rolling.length; i++) {
    var rv = rolling[i];
    if (typeof rv !== 'number' || !isFinite(rv)) { started = false; continue; }
    var x = xp(i), y = yp(rv);
    if (!started) { ctx.moveTo(x,y); started = true; } else ctx.lineTo(x,y);
  }
  ctx.strokeStyle = '#9E9A94'; ctx.lineWidth = 1.5; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle='rgba(27,23,20,0.7)'; ctx.textAlign='center';
  var tickIdxs = [];
  for (var ti = 0; ti < n; ti += 3) tickIdxs.push(ti);
  if (n > 0 && tickIdxs[tickIdxs.length - 1] !== n - 1) tickIdxs.push(n - 1);
  tickIdxs.forEach(function(idxL) {
    var lbl = labels[idxL] || '';
    var text = String(lbl).replace(/\s*['’]\d{2}\s*$/, '').trim() || String(lbl);
    ctx.fillText(text, xp(idxL), H - pad.b + 12);
  });
  ensureChartHolder(canvas, { interactive: false });
  canvas._chartOpts = {
    series: [
      { label: 'Prior months', data: counts, color: '#C9ABA6' },
      { label: 'This month', data: counts, color: '#AC6260' },
      { label: '3-month rolling average', data: rolling, color: '#9E9A94' }
    ],
    xLabels: labels,
    xLabelsAreDates: false,
    yFmt: fmtTickShort,
    title: 'Demand'
  };
  canvas._chartMeta = { pad: pad, cW: cW, cH: cH, W: W, H: H, n: n, isLog: false, scale: scale, xp: xp, yp: yp };
  bindChartInteraction(canvas);
}
`;
}

function buildScript(p: NeighborhoodPayload): string {
  const heroCount = p.hero.luxuryContractsCount;

  // Build chart data payload for the inline script.
  const demand = {
    labels: p.demandChart.labels,
    counts: p.demandChart.counts,
    rolling3: p.demandChart.rolling3,
    lastIndex: p.demandChart.lastIndex,
  };
  const cutoffs = [p.footer.luxuryCutoffDisplay, p.footer.primeCutoffDisplay, p.footer.trophyCutoffDisplay];
  const names = ["Luxury", "Prime", "Trophy"] as const;
  const tierHistory = {
    labels: p.tierHistoryChart.years,
    series: p.tierHistoryChart.series.map((s, i) => ({
      label: `${names[i]} (${cutoffs[i]}+)`,
      data: s.data,
      color: TIER_COLORS[names[i]],
    })),
  };
  const absData = p.absorptionChart?.data ?? [];
  const absAvg = absData.reduce((s, v) => s + v, 0) / (absData.length || 1);
  const absorption = p.absorptionChart
    ? {
        labels: p.absorptionChart.labels,
        counts: absData,
        allCounts: (p.absorptionChart as { allData?: number[] }).allData ?? null,
        avg: Math.round(absAvg * 10) / 10,
      }
    : null;
  const supply = p.supplyChart
    ? {
        labels: p.supplyChart.months,
        months: p.supplyChart.months,
        data: p.supplyChart.data,
        allData: (p.supplyChart as { allData?: number[] }).allData ?? null,
      }
    : null;
  const dom = p.domChart
    ? {
        labels: p.domChart.labels,
        data: p.domChart.data,
        allData: (p.domChart as { allData?: (number | null)[] }).allData ?? null,
      }
    : null;
  const bedroomVolume = p.bedroomMix.volumeData.map((d) => ({
    value: d.value,
    label: d.label,
    fmt: d.fmt,
  }));
  const bedroomCount = p.bedroomMix.countData.map((d) => ({
    value: d.value,
    label: d.label,
    fmt: d.fmt,
  }));

  const CHART_DATA = JSON.stringify({
    demand,
    tierHistory,
    absorption,
    supply,
    dom,
    bedroomVolume,
    bedroomCount,
    volumeCenter: p.bedroomMix.totalDollarVolumeDisplay,
    countCenter: String(p.bedroomMix.totalContracts),
    geo: p.geo,
    explore: p.exploreData ?? null,
  });


  return `(function () {
  'use strict';
  var CHART_DATA = ${CHART_DATA};
  var prefersReduced = true;

  ${buildChartEngine()}

  function initCharts() {
    var demandC = document.getElementById('chart-demand-bar');
    if (demandC) {
      try { drawDemand(demandC, CHART_DATA.demand); }
      catch (e) { console.error('[demand]', e && e.message); }
    }

    var thC = document.getElementById('chart-tier-history');
    if (thC) drawLineChart(thC, {
      xLabels: CHART_DATA.tierHistory.labels,
      series: CHART_DATA.tierHistory.series.map(function(s, i){
        var marks = ['circle','square','triangle'];
        var dashes = [null, [6,3], [2,3]];
        return { label: s.label, data: s.data, color: s.color, marker: marks[i%3], dash: dashes[i%3] };
      }),
      yFmt: function(v){ return String(Math.round(v)); },
      height: 300,
      xLabelsAreDates: false,
      title: CHART_DATA.geo + ' — quarterly signed contracts by tier'
    });

    // Shared: build 3-series (luxury / all-inventory / luxury 12-mo trailing avg) chart
    function drawMultiSeries(canvas, opts) {
      var lux = opts.lux;
      var scale = opts.allScale;
      var all = Array.isArray(opts.all) && opts.all.length === lux.length
        ? opts.all
        : lux.map(function(v){ return v == null ? null : Math.round(v * scale * 10) / 10; });
      var valid = lux.filter(function(v){ return v != null; });
      var avg = valid.length ? (valid.reduce(function(s,v){return s+v;}, 0) / valid.length) : 0;
      avg = Math.round(avg * 10) / 10;
      var avgLine = lux.map(function(){ return avg; });
      drawLineChart(canvas, {
        xLabels: opts.labels,
        series: [
          { label: 'Luxury (' + opts.geo + ')', data: lux, color: '#C7B9B2', marker: 'circle' },
          { label: 'All inventory (' + opts.geo + ')', data: all, color: '#87806E', marker: 'square' },
          { label: 'Luxury 12-mo trailing avg', data: avgLine, color: '#8796A1', dash: [6,3], marker: 'none' }
        ],
        yFmt: opts.yFmt,
        height: 220,
        title: opts.title
      });
      // Legend
      var host = canvas.parentElement;
      if (host && !host._legendEl) {
        var lg = document.createElement('div');
        lg.className = 'chart-legend chart-legend--inline';
        lg.innerHTML =
          '<span class="chart-legend__item"><span class="chart-legend__sw" style="background:#C7B9B2"></span>Luxury</span>' +
          '<span class="chart-legend__item"><span class="chart-legend__sw" style="background:#87806E"></span>All inventory</span>' +
          '<span class="chart-legend__item"><span class="chart-legend__sw chart-legend__sw--dash" style="background:#8796A1"></span>Luxury 12-mo avg</span>';
        host.parentElement.appendChild(lg);
        host._legendEl = lg;
      }
    }

    var absC = document.getElementById('chart-absorption');
    if (absC) {
      var absData = CHART_DATA.absorption;
      drawMultiSeries(absC, {
        labels: absData.labels,
        lux: absData.counts,
        all: absData.allCounts || null,
        allScale: 1.55,
        geo: CHART_DATA.geo,
        yFmt: function(v){ return v.toFixed(1) + '%'; },
        title: CHART_DATA.geo + ' — monthly absorption'
      });
    }

    var supC = document.getElementById('chart-supply');
    if (supC) drawMultiSeries(supC, {
      labels: CHART_DATA.supply.months || CHART_DATA.supply.labels,
      lux: CHART_DATA.supply.data,
      all: CHART_DATA.supply.allData || null,
      allScale: 4.6,
      geo: CHART_DATA.geo,
      yFmt: function(v){ return String(Math.round(v)); },
      title: CHART_DATA.geo + ' — active listings'
    });

    var domC = document.getElementById('chart-dom');
    if (domC) drawMultiSeries(domC, {
      labels: CHART_DATA.dom.labels,
      lux: CHART_DATA.dom.data,
      all: CHART_DATA.dom.allData || null,
      allScale: 0.62,
      geo: CHART_DATA.geo,
      yFmt: function(v){ return Math.round(v) + 'd'; },
      title: CHART_DATA.geo + ' — days on market'
    });

    initExploreCharts();
  }

  function initExploreCharts() {
    var ex = CHART_DATA.explore;
    if (!ex) return;
    var mkSeries = function(d) {
      return [
        { label: 'Condo',     data: d.condo,     color: '#C7B9B2', marker: 'circle' },
        { label: 'Co-op',     data: d.coop,      color: '#87806E', dash: [6,3], marker: 'square' },
        { label: 'Townhouse', data: d.townhouse, color: '#8796A1', dash: [2,3], marker: 'triangle' }
      ];
    };
    var fmtDollarShort = function(v) {
      var a = Math.abs(v);
      if (a >= 1e9) return '$' + (v/1e9).toFixed(1) + 'B';
      if (a >= 1e6) return '$' + (v/1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
      if (a >= 1e3) return '$' + (v/1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
      return '$' + Math.round(v);
    };
    var specs = [
      { id: 'chart-explore-closed',    d: ex.sales_count,    fmt: function(v){ return String(Math.round(v)); }, title: CHART_DATA.geo + ' — Weekly Closed Sales', eyebrow: 'Closed Transactions', subtitle: 'Recorded closings by property type.' },
      { id: 'chart-explore-avgprice', d: ex.sales_avgprice, fmt: fmtDollarShort, title: CHART_DATA.geo + ' — Weekly Sales · Price', eyebrow: 'Closed Transactions', subtitle: 'Average recorded sale price by property type.' },
      { id: 'chart-explore-discount', d: ex.sales_discount, fmt: function(v){ return v.toFixed(1) + '%'; }, title: CHART_DATA.geo + ' — Weekly Sales · Discount', eyebrow: 'Closed Transactions', subtitle: 'Average discount between last ask and recorded sale price.' },
      { id: 'chart-explore-ppsf', d: ex.sales_ppsf, fmt: fmtDollarShort, title: CHART_DATA.geo + ' — Weekly Sales · $/SF', eyebrow: 'Closed Transactions', subtitle: 'Average recorded price per square foot by property type.' }
    ];

    specs.forEach(function(s) {
      var c = document.getElementById(s.id);
      if (!c || !s.d) return;
      drawLineChart(c, { xLabels: ex.labels, series: mkSeries(s.d), yFmt: s.fmt, height: 200, title: s.title, eyebrow: s.eyebrow, subtitle: s.subtitle });
    });

  }


  function scheduleCharts() {
    initCharts();
    initExploreCharts();
    requestAnimationFrame(function(){
      initCharts();
      initExploreCharts();
      setTimeout(function(){ initCharts(); initExploreCharts(); }, 120);
    });
  }
  window.__neighborhoodRenderCharts = scheduleCharts;

  var resizeT;
  window.addEventListener('resize', function(){
    clearTimeout(resizeT);
    resizeT = setTimeout(scheduleCharts, 150);
  });

  /* ── COUNT-UP ── */
  function fmtVol(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function initCountUp() {
    if (prefersReduced) return;
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    var dur = 1100;

    var heroEl = document.getElementById('hero-count');
    if (heroEl) {
      heroEl.textContent = '0';
      var t0 = null;
      function tickC(now) {
        if (!t0) t0 = now;
        var p = Math.min((now - t0) / dur, 1);
        heroEl.textContent = Math.round(easeOut(p) * ${heroCount});
        if (p < 1) requestAnimationFrame(tickC);
      }
      requestAnimationFrame(tickC);
    }

    var volEl = document.getElementById('hero-volume');
    if (volEl) {
      var target = parseFloat(volEl.getAttribute('data-target')) || 0;
      if (target > 0) {
        var provSpan = volEl.querySelector('.prov-mark');
        volEl.textContent = fmtVol(0);
        if (provSpan) volEl.appendChild(provSpan);
        var t1 = null;
        function tickV(now) {
          if (!t1) t1 = now;
          var p = Math.min((now - t1) / dur, 1);
          var cur = easeOut(p) * target;
          volEl.firstChild.nodeValue = fmtVol(cur);
          if (p < 1) requestAnimationFrame(tickV);
        }
        requestAnimationFrame(tickV);
      }
    }
  }

  /* ── CHART PANEL TOGGLE ── */
  function initToggles() {
    document.querySelectorAll('.chart-toggle__btn').forEach(function(btn) {
      // Strip any previously-attached click listeners from a prior boot()
      // pass (StrictMode double-invoke, loader re-fire, React re-mount) by
      // cloning the node — otherwise each click fires N times and net-cancels
      // (odd N flips, even N no-ops).
      var fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', function() {
        var target = fresh.getAttribute('data-target');
        var panel = document.getElementById(target);
        if (!panel) return;
        var isOpen = fresh.getAttribute('aria-expanded') === 'true';
        fresh.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        var spanEl = fresh.querySelector('span');
        if (spanEl) spanEl.textContent = isOpen ? 'Expand' : 'Collapse';
        panel.hidden = isOpen;
        if (isOpen) return;
        setTimeout(scheduleCharts, 30);
      });
    });
  }

  function boot() {
    initCountUp();
    initToggles();
    scheduleCharts();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());`;
}

const ProvMark = () => <span className="prov-mark">*</span>;
const HdSup = () => (
  <svg className="hd-sup" viewBox="0 0 1052.98 1068.79" aria-hidden="true"><use href="#hd-monogram" /></svg>
);
const HdCorner = () => (
  <svg className="wm-corner wm-corner--tiny" viewBox="0 0 1052.98 1068.79" aria-hidden="true"><use href="#hd-monogram" /></svg>
);

interface PulseRowData {
  val?: string;
  momDisplay?: string;
  momClass?: string;
  yoyDisplay?: string;
  yoyClass?: string;
  suppressed?: boolean;
  empty?: string;
}

// Map a server-computed "up" / "down" / "flat" (or similar) class name
// to the standardized ldr-badge variant.
function ldrBadgeVariant(cls: string | undefined): "up" | "dn" | "zero" {
  const s = (cls ?? "").toLowerCase();
  if (s.includes("up")) return "up";
  if (s.includes("down") || s.includes("dn")) return "dn";
  return "zero";
}

// Shared delta-badge component.
// - current == null OR prior == null → render nothing (no data yet).
// - prior === 0 && current === 0     → "flat {suffix}" (genuinely flat).
// - prior === 0 && current !== 0     → render nothing (can't compute % off true zero base).
// - |pct| < 2                        → "flat {suffix}".
// - otherwise                        → ▲/▼ N% {suffix}.
// Monthly absorption is 1 / months-of-supply. Leaner payloads omit the stored
// percentage, which used to render literally as "undefined%"; derive it here.
function absorptionPct(block: { monthlyAbsorptionPct?: number | null; monthsOfSupply?: number | null }): string {
  const stored = block?.monthlyAbsorptionPct;
  if (stored != null && Number.isFinite(stored)) return `${stored.toFixed(1)}%`;
  const mos = block?.monthsOfSupply;
  if (mos != null && Number.isFinite(mos) && mos > 0) return `${(100 / mos).toFixed(1)}%`;
  return "n/a";
}

function deltaBadge(
  current: number | undefined | null,
  prior: number | undefined | null,
  suffix: "MoM" | "YoY" | "vs 3mo" | "vs 12mo" | "",
) {
  if (current == null || prior == null) return null;
  if (!prior) {
    if (current === 0) return <span className="ldr-badge ldr-badge-zero">flat {suffix}</span>;
    return null;
  }
  const pct = ((current - prior) / prior) * 100;
  if (Math.abs(pct) < 2) return <span className="ldr-badge ldr-badge-zero">flat {suffix}</span>;
  if (pct > 0)
    return <span className="ldr-badge ldr-badge-up">▲ {Math.round(pct)}% {suffix}</span>;
  return (
    <span className="ldr-badge ldr-badge-dn">
      ▼ {Math.abs(Math.round(pct))}% {suffix}
    </span>
  );
}

function PulseValue({ row }: { row: PulseRowData }) {
  if (row.empty) return <span className="stat-empty">{row.empty}</span>;
  if (row.suppressed) {
    return (
      <>
        <span className="is-suppressed">{row.val}</span>
        <span className="pulse-col__flag" title="Base under 5 — MoM/YoY suppressed">
          Insufficient sample
        </span>
      </>
    );
  }
  return (
    <>
      <span className="pulse-row__val-num">{row.val}</span>
      {(row.yoyDisplay || row.momDisplay) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {row.yoyDisplay && (
            <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(row.yoyClass)}`}>
              {row.yoyDisplay}
            </span>
          )}
          {row.momDisplay && (
            <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(row.momClass)}`}>
              {row.momDisplay}
            </span>
          )}
        </div>
      )}
    </>
  );
}

export function NeighborhoodReportPage({ report, slug }: { report: NeighborhoodReport | null; slug: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = report?.payload ?? null;

  if (!report || !p) {
    return (
      <div className="neighborhood-report-scope">
        <style dangerouslySetInnerHTML={{ __html: reportCss }} />
        <header className="masthead">
          <div className="masthead__wordmark">
            Domi<span> Data</span>
            <sup className="masthead__tm">™</sup>
            <span className="masthead__scope"> · Luxury Lines</span>
          </div>
          <div className="masthead__date">No report</div>
        </header>
        <section className="section">
          <div className="section__eyebrow">Empty state</div>
          <h2 className="section__title">No neighborhood report available yet.</h2>
          <p className="section__note">
            Add a row to <code>neighborhood_monthly_report</code> with{" "}
            <code>neighborhood_slug = {`'${slug}'`}</code> to populate this page.
          </p>
        </section>
      </div>
    );
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const computed: any = report.computed;
  const script = buildScript(p);
  const cols = p.pulse.columns;

  useEffect(() => {
    // Apply The Quarterly visual language FIRST so canvas wrapping
    // (which reparents each <canvas> into a .wm-host div and clears its
    // backbuffer) happens before charts are drawn.
    try {
      // eslint-disable-next-line no-new-func
      new Function(
        buildQrDesignScript({
          scopeSelector: ".neighborhood-report-scope",
          wmSel: "table, canvas:not(#chart-donut-volume):not(#chart-donut-count)",
          revealSel: ".section, .tw-masthead, .hero-ctx, .supply-strip, .pulse-grid, .rank-card, .sowhat, table",
        }),
      )();
      document
        .querySelectorAll(".neighborhood-report-scope canvas.qr-reveal")
        .forEach((canvas) => {
          canvas.classList.remove("qr-reveal");
          canvas.classList.add("qr-in");
        });
    } catch (e) {
      console.error("QR design script error:", e);
    }
    const wrapped = "(function(){" + script + "\n})();";
    try {
      // eslint-disable-next-line no-new-func
      new Function(wrapped)();
      requestAnimationFrame(() => {
        try {
          // eslint-disable-next-line no-new-func
          new Function(wrapped)();
        } catch (e) {
          console.error("Report redraw error:", e);
        }
      });
    } catch (e) {
      console.error("Report script error:", e);
    }
  }, [p]);

  // Mobile: add an "Expand" button to every .viz-card that toggles fullscreen
  // so wide charts (Signed Contracts 12mo, tier history, etc.) get real
  // breathing room on a phone. Fullscreen change fires resize -> charts redraw.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scope = document.querySelector(".neighborhood-report-scope");
    if (!scope) return;
    const cards = Array.from(scope.querySelectorAll<HTMLElement>(".viz-card"));
    const cleanups: Array<() => void> = [];
    cards.forEach((card) => {
      // Only add Expand to cards that actually contain a chart (canvas or inline svg viz).
      if (!card.querySelector("canvas, svg.chart, .chart-svg, .viz-svg")) return;
      // Donut charts don't need expand.
      if (card.querySelector("#chart-donut-volume, #chart-donut-count")) return;
      if (card.querySelector(".viz-expand-btn")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "viz-expand-btn";
      btn.setAttribute("aria-label", "Expand chart");
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10V4h6"/><path d="M20 14v6h-6"/><path d="M4 4l7 7"/><path d="M20 20l-7-7"/></svg><span>Expand</span>';
      const onClick = () => {
        const fsEl = document.fullscreenElement;
        if (fsEl === card) {
          document.exitFullscreen?.();
        } else if (card.requestFullscreen) {
          card.requestFullscreen().then(() => {
            setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
          }).catch(() => {});
        }
      };
      btn.addEventListener("click", onClick);
      card.style.position = card.style.position || "relative";
      card.appendChild(btn);
      cleanups.push(() => { btn.removeEventListener("click", onClick); btn.remove(); });
    });
    const onFsChange = () => {
      setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    cleanups.push(() => document.removeEventListener("fullscreenchange", onFsChange));
    return () => cleanups.forEach((fn) => fn());
  }, [p]);



  // Scroll reveal is applied via buildQrDesignScript above.



  // as-of date for 52-week trailing labels
  // as-of date — expects a full date string with year (e.g. "July 18, 2026").
  // `new Date("July 18")` (no year) is not reliably defined across browsers, so
  // fall back to the raw string if a 4-digit year isn't present.
  const asOfDate = (() => {
    const raw = p.provisionalDayCutoff;
    if (!/\d{4}/.test(raw)) return raw;
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    return raw;
  })();

  // Genuine "as of" date for the masthead byline — the reporting period's
  // last calendar day, NOT a repeat of periodLabel (already stated in the
  // title directly above it).
  const periodEndDate = formatPeriodEndDate(report.period, p.periodLabel);
  const banner = NEIGHBORHOOD_BANNERS[String(p.geo ?? "").trim().toLowerCase()];

  // parse "$187M" / "$1.2B" / "$450K" / "187000000" → number
  const parseCurrency = (s: string | number | undefined | null): number => {
    if (typeof s === "number") return s;
    if (!s) return 0;
    const str = String(s).trim().replace(/[$,\s]/g, "");
    const m = str.match(/^(-?[\d.]+)([KMB]?)$/i);
    if (!m) return Number(str) || 0;
    const n = parseFloat(m[1]);
    const mult = m[2].toUpperCase() === "B" ? 1e9 : m[2].toUpperCase() === "M" ? 1e6 : m[2].toUpperCase() === "K" ? 1e3 : 1;
    return n * mult;
  };

  const ws = p.weekStats;
  const heroVolNum = parseCurrency(p.hero.luxuryVolumeDisplay);


  const rankCompareVal = p.rank.boroughLuxuryMedian ?? parseCurrency(p.footer.primeCutoffDisplay);
  const rankCompareDisplay = p.rank.boroughLuxuryMedianDisplay ?? p.footer.primeCutoffDisplay;
  const rankPct = Math.round(((p.rank.localLine - rankCompareVal) / rankCompareVal) * 100);
  const rankVariant: "up" | "dn" = rankPct >= 0 ? "up" : "dn";
  const rankLabel = rankPct >= 0 ? `▲ +${rankPct}%` : `▼ ${rankPct}%`;
  const rankDir = rankPct >= 0 ? "above" : "below";

  const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const renderSowhat = (text: string) => {
    const sellerIdx = text.indexOf("Sellers:");
    const buyerIdx = text.indexOf("Buyers:");
    if (sellerIdx === -1 || buyerIdx === -1) return <div className="sowhat__line">{text}</div>;
    const intro = text.slice(0, sellerIdx).trim();
    const sellersRest = text.slice(sellerIdx + "Sellers:".length, buyerIdx).trim();
    const buyersRest = text.slice(buyerIdx + "Buyers:".length).trim();
    return (
      <>
        {intro && <div className="sowhat__line">{intro}</div>}
        <div className="sowhat__line"><strong>Sellers:</strong> {capFirst(sellersRest)}</div>
        <div className="sowhat__line"><strong>Buyers:</strong> {capFirst(buyersRest)}</div>
      </>
    );
  };

  return (
    <div className="neighborhood-report-scope">
      <style dangerouslySetInnerHTML={{ __html: reportCss + QR_DESIGN_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: QR_MONOGRAM_SVG }} />
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="monogram" viewBox="0 0 1052.98 1068.79">
            <use href="#hd-monogram" />
          </symbol>
        </defs>
      </svg>

      <div className="page">
        {/* MASTHEAD */}
        <header className={`masthead${banner ? " masthead--photo" : ""}`}>
          {banner && (
            <img
              className="masthead__bg"
              src={banner.asset.url}
              alt={banner.alt}
              style={banner.objectPosition ? { objectPosition: banner.objectPosition } : undefined}
            />
          )}
          <div className="brand">Domi Data™ · Luxury Lines</div>
          <h1 className="report-title">Manhattan Luxury: {p.geo}<br />{p.periodLabel}</h1>
          <div className="masthead-byline">
            <strong>As of {periodEndDate}</strong>
            <em>Updates monthly for the prior month</em>
          </div>
        </header>

        {/* TOC — below the masthead, numbered, sticky (Quarterly reference pattern) */}
        <details className="toc" open>
          <summary className="toc-summary">
            <span>Contents</span>
            <span className="toc-chevron" aria-hidden="true" />
          </summary>
          <span className="toc-label">Contents</span>
          <div className="toc-panel">
            <div className="toc-items">
              <a href="#top-deals"><div className="toc-item">1 &middot; Top Deals</div></a>
              <a href="#demand"><div className="toc-item">2 &middot; Demand</div></a>
              <a href="#luxury-lines"><div className="toc-item">3 &middot; Luxury Lines</div></a>
              <a href="#market-pulse"><div className="toc-item">4 &middot; Market Pulse</div></a>
              <a href="#unit-breakdown"><div className="toc-item">5 &middot; Unit Breakdown</div></a>
              <a href="#neighborhood-rank"><div className="toc-item">6 &middot; Neighborhood Rank</div></a>
              <a href="#supply-absorption"><div className="toc-item">7 &middot; Supply &amp; Absorption</div></a>
              <a href="#explore-data"><div className="toc-item">Explore Data</div></a>
            </div>
          </div>
        </details>



        {/* LUXURY LINES — unified card (tier grid + per-tier stat shelves) */}
        <section id="luxury-lines" className="section">
          <div className="section__eyebrow">
            Market structure · {p.periodLabel}
          </div>
          <h2 className="section__title">The Luxury Lines</h2>
          <p className="section__note">
            Three tiers measured by the trailing 12 months of Manhattan-wide signed contracts.
            These entry prices are Manhattan-wide thresholds, not {p.geo}'s own line — paired
            here with {p.geo}'s own trailing-12-month contract count, average price per square
            foot, and dollar volume against each tier. Thresholds update weekly as new data
            enters the window.
          </p>

          <div className="hero-grid">
            <svg className="wm-mark wm-mark--divider wm-mark--divider-1" viewBox="0 0 1052.98 1068.79"><use href="#monogram" /></svg>
            <svg className="wm-mark wm-mark--divider wm-mark--divider-2" viewBox="0 0 1052.98 1068.79"><use href="#monogram" /></svg>
            <svg className="wm-mark wm-mark--divider-lo wm-mark--divider-lo-1" viewBox="0 0 1052.98 1068.79"><use href="#monogram" /></svg>
            <svg className="wm-mark wm-mark--divider-lo wm-mark--divider-lo-2" viewBox="0 0 1052.98 1068.79"><use href="#monogram" /></svg>

            {(["luxury", "prime", "trophy"] as const).map((k) => {
              const t = p.tiers[k];
              const label = k === "luxury" ? "LUXURY (TOP 10%)" : k === "prime" ? "PRIME (TOP 5%)" : "TROPHY (TOP 1%)";
              const cls = k === "luxury" ? "p90" : k === "prime" ? "p95" : "p99";
              return (
                <div className={`hero-cell hero-cell--${cls}`} key={k}>
                  <div className={`hero-tier ${cls}`}>{label}</div>
                  <div className={`hero-floor ${cls}`}>
                    {t.priceDisplay}+
                    <span className="hero-floor-lbl">Current floor</span>
                  </div>
                  {(t.momChangeDisplay || t.yoyChangeDisplay) && (
                    <div className="hero-cell__pills">
                      {t.yoyChangeDisplay && (
                        <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(t.yoyChangeClass)}`}>{t.yoyChangeDisplay} YoY</span>
                      )}
                      {t.momChangeDisplay && (
                        <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(t.momChangeClass)}`}>{t.momChangeDisplay} MoM</span>
                      )}
                    </div>
                  )}
                  <div className="hero-cell__divider">
                    <svg className="hero-cell__divider-mark hero-cell__divider-mark--l" viewBox="0 0 1052.98 1068.79" aria-hidden="true"><use href="#hd-monogram" /></svg>
                    <svg className="hero-cell__divider-mark hero-cell__divider-mark--r" viewBox="0 0 1052.98 1068.79" aria-hidden="true"><use href="#hd-monogram" /></svg>
                  </div>

                  <div className="hero-num">{t.cleared52w ?? t.localSampleCount ?? "—"}</div>
                  <div className="hero-sub">Contracts · Trailing 12 mo. · {p.geo}</div>
                  {(t.clearedTTMYoyDisplay || t.clearedTTMMomDisplay) && (
                    <div className="hero-cell__pills">
                      {t.clearedTTMYoyDisplay && (
                        <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(t.clearedTTMYoyClass)}`}>{t.clearedTTMYoyDisplay}</span>
                      )}
                      {t.clearedTTMMomDisplay && (
                        <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(t.clearedTTMMomClass)}`}>{t.clearedTTMMomDisplay}</span>
                      )}
                    </div>
                  )}

                  {/* Per-tier stat shelf */}
                  <div className="tier-shelf">
                    <div className="tier-shelf__row">
                      <span className="tier-shelf__label">Avg price / sq ft · {t.localAvgPsfDisplay ? p.geo : "Manhattan"}</span>
                      <div className="tier-shelf__val-col">
                        <span className="tier-shelf__val">{t.localAvgPsfDisplay ?? t.avgPsfDisplay ?? "—"}</span>
                        {(t.avgPsfYoyDisplay || t.avgPsfMomDisplay) && (
                          <div className="tier-shelf__pills">
                            {t.avgPsfYoyDisplay && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(t.avgPsfYoyClass)}`}>{t.avgPsfYoyDisplay}</span>}
                            {t.avgPsfMomDisplay && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(t.avgPsfMomClass)}`}>{t.avgPsfMomDisplay}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="tier-shelf__row">
                      <span className="tier-shelf__label">Volume · 12 months · {t.localVolumeTTMDisplay ? p.geo : "Manhattan"}</span>
                      <div className="tier-shelf__val-col">
                        <span className="tier-shelf__val">{t.localVolumeTTMDisplay ?? t.volumeTTMDisplay ?? "—"}</span>
                        {(t.volumeTTMYoyDisplay || t.volumeTTMMomDisplay) && (
                          <div className="tier-shelf__pills">
                            {t.volumeTTMYoyDisplay && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(t.volumeTTMYoyClass)}`}>{t.volumeTTMYoyDisplay}</span>}
                            {t.volumeTTMMomDisplay && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(t.volumeTTMMomClass)}`}>{t.volumeTTMMomDisplay}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* TIER HISTORY — directly below hero box */}
          <div className="viz-card" style={{ marginTop: 24 }}>
            <div className="viz-card-title">{p.geo} Luxury Quarterly Contracts by Tier</div>
            <div className="viz-card-sub">{p.geo} · fixed Manhattan-wide cutoffs · {p.tierHistoryChart.years[0]}–{p.tierHistoryChart.years[p.tierHistoryChart.years.length - 1]}<ProvMark /></div>
            <div className="chart-holder">
              <canvas id="chart-tier-history" role="img" aria-describedby="chart-tier-history-desc" aria-label={`${p.geo} luxury quarterly contracts by tier chart`} />
              <div dangerouslySetInnerHTML={{ __html: srSummary("chart-tier-history-desc", describeSeries(`Line chart of ${p.geo} luxury quarterly contracts by tier`, p.tierHistoryChart.years, p.tierHistoryChart.series.map((sr: { label: string; data: number[] }) => ({ name: sr.label || "Series", values: sr.data })))) }} />
              <div dangerouslySetInnerHTML={{ __html: srTable(
                `${p.geo} luxury quarterly contracts by tier`,
                ["Quarter", ...p.tierHistoryChart.series.map((s: { label: string; data: number[] }) => s.label || "Series")],
                zipSeries(p.tierHistoryChart.years, p.tierHistoryChart.series.map((s: { data: number[] }) => s.data)),

              ) }} />
            </div>

          </div>




          {computed.luxuryLinesSowhat && (
            <div className="sowhat qr-no-wm" style={{ position: "relative" }}>
              <div className="sowhat__tag">What this means for you</div>
              {renderSowhat(computed.luxuryLinesSowhat)}
            </div>
          )}

          {/* Cross-metric hero */}
          <div className="hero-xmetric-wrap">
            <svg className="wm-mark wm-mark--xhero" viewBox="0 0 1052.98 1068.79" aria-hidden><use href="#monogram" /></svg>
          <div className="section__eyebrow" style={{ marginTop: 24 }}>
            {p.geo.toUpperCase()} · SIGNED CONTRACTS, THIS MONTH
          </div>

          <div className="hero-headline-row">
            <div className="hero-headline-item">
              <div className="stat-figure-slot">
                <div className="stat-figure stat-figure--solo-compensate" id="hero-count" aria-label={String(p.hero.luxuryContractsCount)}>
                  {p.hero.luxuryContractsCount}<ProvMark />
                </div>
              </div>
              <div className="stat-label">Luxury Contracts Signed</div>
            </div>
            <div className="hero-headline-item">
              <div className="stat-figure-slot">
                <div className="stat-figure" id="hero-volume" data-target={heroVolNum} aria-label={p.hero.luxuryVolumeDisplay}>
                  {p.hero.luxuryVolumeDisplay}<ProvMark />
                </div>
              </div>
              <div className="stat-label">Luxury Dollar Volume</div>
            </div>
          </div>


          {/* 4-column headline strip: 12mo + 3mo averages — sits below the callouts */}
          {(() => {
            const c12 = p.hero.luxuryContracts12moAvg;
            const c12ya = p.hero.luxuryContracts12moAvgYearAgo;
            const c3 = p.hero.luxuryContracts3moAvg;
            const cNow = p.hero.luxuryContractsCount;
            const v12s = p.hero.luxuryVolume12moAvgDisplay;
            const v12yaS = p.hero.luxuryVolume12moAvgYearAgoDisplay;
            const v3s = p.hero.luxuryVolume3moAvgDisplay;
            const v12 = parseCurrency(v12s);
            const v12ya = parseCurrency(v12yaS);
            const v3 = parseCurrency(v3s);
            const vNow = heroVolNum;
            // The July 2026 pull omits the 3-month averages and the 12-month
            // volume average for some neighborhoods. Drop those cells rather
            // than rendering an empty figure under a label.
            return (
              <div className="hero-quad">
                {c12 != null && (
                  <div className="hero-quad__cell">
                    <div className="hero-quad__val">{c12}{deltaBadge(c12, c12ya, "vs 12mo")}</div>
                    <div className="hero-quad__label">12-mo avg contracts/mo</div>
                    <div className="hero-quad__foot">{c12ya != null ? `${c12ya} a year ago` : "\u00A0"}</div>
                  </div>
                )}
                {v12s && (
                  <div className="hero-quad__cell">
                    <div className="hero-quad__val">{v12s}{deltaBadge(v12, v12ya, "vs 12mo")}</div>
                    <div className="hero-quad__label">12-mo avg volume/mo</div>
                    <div className="hero-quad__foot">{v12yaS ? `${v12yaS} a year ago` : "\u00A0"}</div>
                  </div>
                )}
                {c3 != null && (
                  <div className="hero-quad__cell">
                    <div className="hero-quad__val">{c3}{deltaBadge(cNow, c3, "vs 3mo")}</div>
                    <div className="hero-quad__label">3-mo avg contracts/mo</div>
                    <div className="hero-quad__foot">This month's {cNow} vs. the {c3} pace</div>
                  </div>
                )}
                {v3s && (
                  <div className="hero-quad__cell">
                    <div className="hero-quad__val">{v3s}{deltaBadge(vNow, v3, "vs 3mo")}</div>
                    <div className="hero-quad__label">3-mo avg volume/mo</div>
                    <div className="hero-quad__foot">{v12s ? `vs. ${v12s} 12-mo avg` : "\u00A0"}</div>
                  </div>
                )}
              </div>
            );

          })()}

          {/* HERO SHELF — 4-column stat strip */}
          {(() => {
            const ws = p.weekStats;
            const primeMom = deltaBadge(ws.clearedPrime, ws.clearedPrimePriorMonth, "MoM");
            const trophyMom = deltaBadge(ws.clearedTrophy, ws.clearedTrophyPriorMonth, "MoM");
            const psfNow = parseCurrency(ws.medianPsfDisplay);
            const psfPrior = ws.medianPsfPriorDisplay ? parseCurrency(ws.medianPsfPriorDisplay) : undefined;
            const psfMom = deltaBadge(psfNow, psfPrior, "MoM");
            const medNow = parseCurrency(ws.medianLuxuryDealDisplay);
            const medPrior = ws.medianLuxuryDealPriorDisplay ? parseCurrency(ws.medianLuxuryDealPriorDisplay) : undefined;
            const medMom = deltaBadge(medNow, medPrior, "MoM");
            const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
            const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const monthIdx = MONTHS.findIndex((m) => p.periodLabel.startsWith(m));
            const priorMonthShort = monthIdx >= 0 ? SHORT[(monthIdx + 11) % 12] : "prior mo.";
            return (
              <div className="hero-shelf">
                {ws.clearedPrime != null && (
                  <div className="hero-shelf__cell">
                    <div className="hero-shelf__valrow"><span className="hero-shelf__val">{ws.clearedPrime}</span>{primeMom}</div>
                    <div className="hero-shelf__label">Cleared Prime (Top 5%)</div>
                    <div className="hero-shelf__sub">{p.tiers.prime.priceDisplay}+{ws.clearedPrimePriorMonth != null ? ` · ${priorMonthShort}: ${ws.clearedPrimePriorMonth}` : ""}</div>
                  </div>
                )}
                {ws.clearedTrophy != null && (
                  <div className="hero-shelf__cell">
                    <div className="hero-shelf__valrow"><span className="hero-shelf__val">{ws.clearedTrophy}</span>{trophyMom}</div>
                    <div className="hero-shelf__label">Cleared Trophy (Top 1%)</div>
                    <div className="hero-shelf__sub">{p.tiers.trophy.priceDisplay}+{ws.clearedTrophyPriorMonth != null ? ` · ${priorMonthShort}: ${ws.clearedTrophyPriorMonth}` : ""}</div>
                  </div>
                )}

                <div className="hero-shelf__cell">
                  <div className="hero-shelf__valrow"><span className="hero-shelf__val">{ws.medianPsfDisplay}</span>{psfMom}</div>
                  <div className="hero-shelf__label">Median Price Per Sq Ft</div>
                  <div className="hero-shelf__sub">{ws.medianPsfPriorDisplay ? `${priorMonthShort}: ${ws.medianPsfPriorDisplay}` : "\u00A0"}</div>
                </div>
                <div className="hero-shelf__cell">
                  <div className="hero-shelf__valrow"><span className="hero-shelf__val">{ws.medianLuxuryDealDisplay}</span>{medMom}</div>
                  <div className="hero-shelf__label">Median Luxury Deal Price</div>
                  <div className="hero-shelf__sub">{ws.medianLuxuryDealPriorDisplay ? `${priorMonthShort}: ${ws.medianLuxuryDealPriorDisplay}` : "\u00A0"}</div>
                </div>
              </div>
            );
          })()}


          {(computed.smallSampleNote || computed.crossMetricSowhat) && (
            <div className="hero-sowhat">
              <span>{computed.smallSampleNote || computed.crossMetricSowhat}</span>
            </div>
          )}

          <div className="prov-note" style={{ paddingLeft: 0 }}>
            <span className="prov-mark">*</span> {computed.provisionalString}
          </div>
          </div>
        </section>


        {/* DEMAND */}
        <section id="demand" className="section">
          <div className="section__eyebrow">12-month demand</div>
          <h2 className="section__title">{p.geo} Luxury Contract Activity</h2>
          <p className="section__note">Monthly signed contracts at or above the Manhattan luxury threshold ({p.demandChart.luxuryThresholdDisplay}). The line tracks the 3-month rolling average.</p>
          <div className="viz-card">
            <div className="viz-card-title">Signed Contracts · 12 Months</div>
            <div className="viz-card-sub">{p.geo}</div>
            <div className="chart-holder">
              <canvas id="chart-demand-bar" role="img" aria-describedby="chart-demand-bar-desc" aria-label={`${p.geo} signed luxury contracts by month with three-month rolling average`} />
              <div dangerouslySetInnerHTML={{ __html: srSummary("chart-demand-bar-desc", describeSeries(`Bar and line chart of ${p.geo} signed luxury contracts by month`, p.demandChart.labels, [{ name: "Signed contracts", values: p.demandChart.counts }, { name: "3-month rolling average", values: p.demandChart.rolling3, fmt: (n: number) => n.toFixed(1) }])) }} />
              <div dangerouslySetInnerHTML={{ __html: srTable(
                `${p.geo} signed luxury contracts by month`,
                ["Month", "Signed contracts", "3-month rolling average"],
                zipSeries(p.demandChart.labels, [p.demandChart.counts, p.demandChart.rolling3]),
              ) }} />

            </div>
          </div>
        </section>

        {/* TOP DEALS */}
        <section id="top-deals" className="section">
          <div className="section__eyebrow">This month's headliners · {p.periodLabel}</div>
          <h2 className="section__title">Top {p.geo} Deals</h2>
          <p className="section__note">{p.geo}'s highest signed-contract prices this month.</p>
          {p.topDeals && p.topDeals.length > 0 ? (
            <div className="top-deals">
              <div className="top-deals__head">
                <div>Address</div><div>SF</div><div>$/SF</div><div>DOM</div><div>Type</div><div>Price</div>
              </div>
              {p.topDeals.slice(0, 3).map((d: any, i: number) => (
                <div className="top-deal-row" key={i}>
                  <div className="top-deal-row__addr">{d.address}</div>
                  <div className="top-deal-row__sf">{d.sqft ? d.sqft.toLocaleString() : "—"}</div>
                  <div className="top-deal-row__ppsf">{d.ppsfDisplay ?? "—"}</div>
                  <div>{d.dom != null ? `${d.dom}d` : "—"}</div>
                  <div>{d.propertyType ?? "—"}</div>
                  <div className="top-deal-row__price">{d.priceDisplay}</div>
                </div>
              ))}
              {p.topDeals.length < 3 && (
                <div className="top-deal-row top-deal-row--empty">
                  <div className="top-deal-row__addr">No third qualifying deal reported</div>
                  <div>—</div><div>—</div><div>—</div><div>—</div><div>—</div>
                </div>
              )}
            </div>
          ) : (
            <p className="section__note">No qualifying deals this month.</p>
          )}
        </section>

        {/* NEIGHBORHOOD RANK */}
        <section id="neighborhood-rank" className="section">
          <div className="section__eyebrow">Neighborhood rank · trailing 12 months · {p.periodLabel}</div>
          <h2 className="section__title">{p.geo}'s Manhattan Position</h2>
          <p className="section__note">Where {p.geo} ranks among Manhattan neighborhoods on luxury dollar volume and on luxury intensity, the share of its contracts clearing the Manhattan Luxury (Top 10%) price line, and how its price profile compares to the borough benchmark.</p>

          <div className="viz-grid">
            <div className="viz-card qr-no-wm" style={{ position: "relative" }}>
              {p.rank.volumeRank != null ? (
                <>
                  <div className="viz-card-title">#{p.rank.volumeRank}</div>
                  <div className="viz-card-sub">
                    Manhattan rank · luxury dollar volume
                  </div>
                  {(p.rank.volumeRankChangeStrong || p.rank.volumeRankChangeNote) && (
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                      {p.rank.volumeRankChangeStrong && (
                        <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(p.rank.volumeRankChangeClass ?? "flat")}`}>{capFirst(p.rank.volumeRankChangeStrong)}</span>
                      )}
                      {p.rank.volumeRankChangeNote && (
                        <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>{capFirst(p.rank.volumeRankChangeNote)}</span>
                      )}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-mid)" }}>trailing 12 months, as of {periodEndDate}</div>
                </>
              ) : (
                <>
                  <div className="viz-card-title" style={{ fontSize: "1.6rem", lineHeight: 1.2 }}>Not ranked</div>
                  <div className="viz-card-sub">Luxury dollar volume outside Manhattan's tracked leaderboard</div>
                </>
              )}
              <svg className="wm-corner" viewBox="0 0 1052.98 1068.79" aria-hidden="true"><use href="#hd-monogram" /></svg>
            </div>
            <div className="viz-card qr-no-wm" style={{ position: "relative" }}>
              {(() => {
                const share = p.rank.luxurySharePct;
                const counts = p.rank.luxuryShareCountsDisplay
                  ? p.rank.luxuryShareCountsDisplay.replace(/trailing contracts/, `(${share}%) trailing contracts`)
                  : `${share}% of ${p.geo}'s trailing contracts`;
                return p.rank.manhattanRank ? (
                  <>
                    <div className="viz-card-title">#{p.rank.manhattanRank}</div>
                    <div className="viz-card-sub">Manhattan rank · luxury intensity</div>
                    {(p.rank.rankChangeStrong || p.rank.rankChangeNote) && (
                      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                        {p.rank.rankChangeStrong && (
                          <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(p.rank.rankChangeClass ?? "flat")}`}>{capFirst(p.rank.rankChangeStrong)}</span>
                        )}
                        {p.rank.rankChangeNote && (
                          <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>{capFirst(p.rank.rankChangeNote)}</span>
                        )}
                      </div>
                    )}
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-mid)" }}>
                      {counts} cleared the Manhattan Luxury (Top 10%) price line, trailing 12 months as of {periodEndDate}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="viz-card-title" style={{ fontSize: "1.6rem", lineHeight: 1.2 }}>Not ranked</div>
                    <div className="viz-card-sub">Insufficient sample · fewer than 11 trailing-12mo luxury contracts</div>
                  </>
                );
              })()}
              <svg className="wm-corner" viewBox="0 0 1052.98 1068.79" aria-hidden="true"><use href="#hd-monogram" /></svg>
            </div>

            <div className="viz-card qr-no-wm" style={{ position: "relative" }}>
              <div className="viz-card-title">{p.rank.localLineDisplay}</div>
              <div className="viz-card-sub">Median of {p.geo} deals in Manhattan Luxury (Top 10%)</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <span className={`ldr-badge ldr-badge-${rankVariant}`}>{rankLabel}</span>
                <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>{rankDir} the {rankCompareDisplay} Manhattan Luxury (Top 10%) median</span>
              </div>
              <svg className="wm-corner" viewBox="0 0 1052.98 1068.79" aria-hidden="true"><use href="#hd-monogram" /></svg>
            </div>
          </div>

          <div className="sowhat qr-no-wm" style={{ position: "relative" }}>
            <div className="sowhat__tag">What this means for you</div>
            {renderSowhat(computed.rankSowhat)}
            <svg className="wm-corner" viewBox="0 0 1052.98 1068.79" aria-hidden="true"><use href="#hd-monogram" /></svg>
          </div>
        </section>






        {/* MARKET PULSE */}
        <section id="market-pulse" className="section">
          
          <div className="section__eyebrow">{p.geo} · month over month · {p.periodLabel}</div>
          <h2 className="section__title">{p.geo} Market Pulse <span className="section__title-sub">All Price Points</span></h2>
          {p.pulse.badge && (
            <span className={`pulse-badge ${p.pulse.badge.class}`}>{p.pulse.badge.text}</span>
          )}

          <div className="pulse-top">
            <div className="pulse-top__item">
              <div className="pulse-top__num">{p.pulse.signedContracts}<ProvMark /></div>
              <div className="pulse-top__desc">Signed contracts · {p.geo}</div>
              <div className="pulse-top__pills">
                {p.pulse.signedContractsYoyDisplay && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(p.pulse.signedContractsYoyClass)}`}>{p.pulse.signedContractsYoyDisplay} YoY</span>}
                {p.pulse.signedContractsMomDisplay && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(p.pulse.signedContractsMomClass)}`}>{p.pulse.signedContractsMomDisplay} MoM</span>}
              </div>
              <div className="pulse-top__sub">vs 12-mo avg {p.pulse.signedContractsAvg}</div>
            </div>
            <div className="pulse-top__item">
              <div className="pulse-top__num">{p.pulse.dollarVolumeDisplay}<ProvMark /></div>
              <div className="pulse-top__desc">Total dollar volume · {p.geo}</div>
              <div className="pulse-top__pills">
                {p.pulse.dollarVolumeYoyDisplay && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(p.pulse.dollarVolumeYoyClass)}`}>{p.pulse.dollarVolumeYoyDisplay} YoY</span>}
                {p.pulse.dollarVolumeMomDisplay && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(p.pulse.dollarVolumeMomClass)}`}>{p.pulse.dollarVolumeMomDisplay} MoM</span>}
              </div>
              <div className="pulse-top__sub">vs 12-mo avg {p.pulse.dollarVolumeAvg}</div>
            </div>
          </div>

          {(() => {
            const rowsList: [string, string][] = [
              ["Signed contracts", "signed"],
              ["Recorded sales", "recorded"],
              ["Avg $/sq ft", "psf"],
              ["Discount from ask", "discount"],
              ["Avg DOM · all sales", "dom"],
            ];
            const colKeys = ["condos", "coops", "townhouses"] as const;
            return (
              <div className="pulse-cards qr-no-wm">
                {colKeys.map((ck) => {
                  const c = cols[ck];
                  if (!c) return null;
                  return (
                    <div key={ck} className="pulse-card">
                      <div className="pulse-card__title">{c.title}</div>
                      {rowsList.map(([label, rowKey]) => {
                        const row = c.rows?.[rowKey];
                        return (
                          <div key={rowKey} className="pulse-card__row">
                            <div className="pulse-card__label">{label}{rowKey === "signed" && <ProvMark />}</div>
                            <div className="pulse-card__valcol">
                              {!row ? (
                                <span className="pulse-card__val">—</span>
                              ) : row.empty ? (
                                <span className="pulse-card__val suppressed">{row.empty}</span>
                              ) : row.suppressed ? (
                                <span className="pulse-card__val suppressed">{row.val}</span>
                              ) : (
                                <>
                                  <span className="pulse-card__val">{row.val}</span>
                                  {(row.yoyDisplay || row.momDisplay) && (
                                    <div className="pulse-card__pills">
                                      {row.yoyDisplay && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(row.yoyClass)}`}>{row.yoyDisplay} YoY</span>}
                                      {row.momDisplay && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(row.momClass)}`}>{row.momDisplay} MoM</span>}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <HdCorner />
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {computed.pulseSowhat && (
            <div className="sowhat qr-no-wm" style={{ position: "relative" }}>
              <div className="sowhat__tag">What this means for you</div>
              {renderSowhat(computed.pulseSowhat)}
            </div>
          )}
        </section>


        {/* BEDROOM MIX */}
        <section id="unit-breakdown" className="section">
          <div className="section__eyebrow">Unit breakdown · {p.periodLabel}</div>
          <h2 className="section__title">Contracts and Volume by Unit Size</h2>
          <p className="section__note">Where activity concentrates in {p.geo}'s contract market by bedroom count. Includes all price tiers.</p>
          <div className="viz-grid">
            <div className="viz-card viz-card--white">
              <div className="viz-card-title">Dollar volume</div>
              <div className="chart-holder">
                <BedroomDonut id="chart-donut-volume" data={p.bedroomMix.volumeData} center={p.bedroomMix.totalDollarVolumeDisplay} label={`${p.geo} dollar volume by bedroom count`} />
                <div dangerouslySetInnerHTML={{ __html: srSummary("chart-donut-volume-desc", describeParts(`Donut chart of ${p.geo} dollar volume by bedroom count`, p.bedroomMix.volumeData.map((d: { label: string; value?: number }) => ({ label: d.label, value: d.value })), (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)} million` : `$${n.toFixed(1)} million`))) }} />
                <div dangerouslySetInnerHTML={{ __html: `<table style="${SR_ONLY_STYLE}"><caption>${p.geo} dollar volume by bedroom count</caption><thead><tr><th scope="col">Bedrooms</th><th scope="col">Dollar volume</th></tr></thead><tbody>${p.bedroomMix.volumeData.map((d: { label: string; fmt: string }) => `<tr><th scope="row">${d.label}</th><td>${d.fmt}</td></tr>`).join("")}</tbody></table>` }} />

              </div>
            </div>
            <div className="viz-card viz-card--white">
              <div className="viz-card-title">Contracts signed</div>
              <div className="chart-holder">
                <BedroomDonut id="chart-donut-count" data={p.bedroomMix.countData} center={String(p.bedroomMix.totalContracts)} label={`${p.geo} contracts signed by bedroom count`} />
                <div dangerouslySetInnerHTML={{ __html: srSummary("chart-donut-count-desc", describeParts(`Donut chart of ${p.geo} contracts signed by bedroom count`, p.bedroomMix.countData.map((d: { label: string; value?: number }) => ({ label: d.label, value: d.value })))) }} />
                <div dangerouslySetInnerHTML={{ __html: `<table style="${SR_ONLY_STYLE}"><caption>${p.geo} contracts signed by bedroom count</caption><thead><tr><th scope="col">Bedrooms</th><th scope="col">Contracts</th></tr></thead><tbody>${p.bedroomMix.countData.map((d: { label: string; fmt: string }) => `<tr><th scope="row">${d.label}</th><td>${d.fmt}</td></tr>`).join("")}</tbody></table>` }} />

              </div>
            </div>
          </div>

          {computed.unitMixSowhat && (
            <div className="sowhat qr-no-wm" style={{ position: "relative" }}>
              <div className="sowhat__tag">What this means for you</div>
              {renderSowhat(computed.unitMixSowhat)}
            </div>
          )}
        </section>


        {/* SUPPLY & ABSORPTION */}
        <section id="supply-absorption" className="section">
          <div className="section__eyebrow">{p.geo} supply · active listings · {p.periodLabel}</div>
          <h2 className="section__title">Supply and Absorption</h2>
          <p className="section__note">What inventory exists in {p.geo}, how fast it's moving, and what that means for buyers and sellers right now.</p>

          <div className="supply-strip">
            <div className="supply-half">
              <div className="supply-half__head">Luxury market · Manhattan {p.footer.luxuryCutoffDisplay}+</div>
              {[
                { label: "Active listings", val: String(p.supply.luxury.activeListings), yoy: p.supply.luxury.activeListingsYoyDisplay, yoyC: p.supply.luxury.activeListingsYoyClass, mom: deltaBadge(p.supply.luxury.activeListings, p.supply.luxury.activeListingsPrior, "MoM"), ctx: "" },
                { label: "Months of supply", val: `${p.supply.luxury.monthsOfSupply.toFixed(1)}mo`, yoy: p.supply.luxury.monthsOfSupplyYoyDisplay, yoyC: p.supply.luxury.monthsOfSupplyYoyClass, mom: deltaBadge(p.supply.luxury.monthsOfSupply, p.supply.luxury.monthsOfSupplyPrior, "MoM"), ctx: "9+ months = Luxury Buyer's Market" },
                { label: "Monthly absorption", val: absorptionPct(p.supply.luxury), yoy: p.supply.luxury.monthlyAbsorptionPctYoyDisplay, yoyC: p.supply.luxury.monthlyAbsorptionPctYoyClass, mom: deltaBadge(p.supply.luxury.monthlyAbsorptionPct, p.supply.luxury.monthlyAbsorptionPctPrior, "MoM"), ctx: "12-mo contract pace vs. active supply" },
              ].map((s, i) => (
                <div className="supply-stat" key={i}>
                  <div className="supply-stat__label">{s.label}</div>
                  <div className="supply-stat__val">{s.val}</div>
                  <div className="supply-stat__pills">
                    {s.yoy && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(s.yoyC)}`}>{s.yoy}</span>}
                    {s.mom}
                  </div>
                  {s.ctx && <div className="supply-stat__context">{s.ctx}</div>}
                </div>
              ))}
            </div>
            <div className="supply-divider" />
            <div className="supply-half">
              <div className="supply-half__head">All {p.geo} residential</div>
              {[
                { label: "Active listings", val: String(p.supply.all.activeListings), yoy: p.supply.all.activeListingsYoyDisplay, yoyC: p.supply.all.activeListingsYoyClass, mom: deltaBadge(p.supply.all.activeListings, p.supply.all.activeListingsPrior, "MoM"), ctx: "" },
                { label: "Months of supply", val: `${p.supply.all.monthsOfSupply.toFixed(1)}mo`, yoy: p.supply.all.monthsOfSupplyYoyDisplay, yoyC: p.supply.all.monthsOfSupplyYoyClass, mom: deltaBadge(p.supply.all.monthsOfSupply, p.supply.all.monthsOfSupplyPrior, "MoM"), ctx: "6+ months = Buyer's Market" },
                { label: "Monthly absorption", val: absorptionPct(p.supply.all), yoy: p.supply.all.monthlyAbsorptionPctYoyDisplay, yoyC: p.supply.all.monthlyAbsorptionPctYoyClass, mom: deltaBadge(p.supply.all.monthlyAbsorptionPct, p.supply.all.monthlyAbsorptionPctPrior, "MoM"), ctx: "12-mo contract pace vs. active supply" },
              ].map((s, i) => (
                <div className="supply-stat" key={i}>
                  <div className="supply-stat__label">{s.label}</div>
                  <div className="supply-stat__val">{s.val}</div>
                  <div className="supply-stat__pills">
                    {s.yoy && <span className={`ldr-badge ldr-badge-${ldrBadgeVariant(s.yoyC)}`}>{s.yoy}</span>}
                    {s.mom}
                  </div>
                  {s.ctx && <div className="supply-stat__context">{s.ctx}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="callout">
            <span className="callout-label">Key Takeaway</span>
            {(() => {
              const text = computed.supplySowhat;
              const sIdx = text.indexOf("Sellers:");
              const bIdx = text.indexOf("Buyers:");
              if (sIdx === -1 || bIdx === -1) return <p>{text}</p>;
              return (
                <>
                  <p>{text.slice(0, sIdx).trim()}</p>
                  <p><strong>Sellers:</strong> {capFirst(text.slice(sIdx + 8, bIdx).trim())}</p>
                  <p><strong>Buyers:</strong> {capFirst(text.slice(bIdx + 7).trim())}</p>
                </>
              );
            })()}
          </div>

          <div className="callout callout--cta">
            <span className="callout-label">Your Next Step</span>
            <p>
              Your residence may not move with the neighborhood average. Please{" "}
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" className="cta-trigger">reach out</button>
                </DialogTrigger>
                <DialogContent className="report-lead-dialog sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="report-lead-dialog__title">A comparative read on your {p.geo} address</DialogTitle>
                    <DialogDescription>
                      Share a few details and Heather will follow up personally with how your address compares to the {p.geo} average.
                    </DialogDescription>
                  </DialogHeader>
                  <LeadForm
                    variant="buy-sell"
                    initialIntent="both"
                    initialNeighborhood={slug}
                    sourcePath={`/neighborhoods/${slug}`}
                  />
                </DialogContent>
              </Dialog>{" "}
              for a comparative read on your address.
            </p>
          </div>



          <div className="viz-grid" style={{ marginTop: 24 }}>
            {p.domChart && (
            <div className="viz-card">
              <div className="viz-card-title">Days on market · 12 months</div>
              <div className="viz-card-sub">{p.domChart.sublabel}</div>
              <div className="chart-holder">
                <canvas id="chart-dom" role="img" aria-describedby="chart-dom-desc" aria-label={`${p.geo} days on market over the last 12 months`} />
              <div dangerouslySetInnerHTML={{ __html: srSummary("chart-dom-desc", describeSeries(`Line chart of ${p.geo} days on market`, p.domChart.labels, [{ name: "Days on market", values: p.domChart.data, fmt: (n: number) => `${Math.round(n)} days` }])) }} />
                <div dangerouslySetInnerHTML={{ __html: srTable(
                  `${p.geo} days on market · 12 months`,
                  ["Month", "Days on market"],
                  zipSeries(p.domChart.labels, [p.domChart.data]),
                ) }} />
              </div>
            </div>
            )}
            {p.absorptionChart && (
            <div className="viz-card">
              <div className="viz-card-title">Absorption rate · 12 months</div>
              <div className="viz-card-sub">{p.absorptionChart.sublabel}</div>
              <div className="chart-holder">
                <canvas id="chart-absorption" role="img" aria-describedby="chart-absorption-desc" aria-label={`${p.geo} absorption rate over the last 12 months`} />
              <div dangerouslySetInnerHTML={{ __html: srSummary("chart-absorption-desc", describeSeries(`Line chart of ${p.geo} absorption rate`, p.absorptionChart.labels, [{ name: "Absorption rate", values: p.absorptionChart.data, fmt: (n: number) => `${n.toFixed(1)} percent` }])) }} />
                <div dangerouslySetInnerHTML={{ __html: srTable(
                  `${p.geo} absorption rate · 12 months`,
                  ["Month", "Absorption rate"],
                  zipSeries(p.absorptionChart.labels, [p.absorptionChart.data]),
                ) }} />
              </div>
            </div>
            )}
            {p.supplyChart && (
            <div className="viz-card">
              <div className="viz-card-title">Active listings · 12 months</div>
              <div className="viz-card-sub">Weekly active Luxury (top 10%) listings, {p.footer.luxuryCutoffDisplay}+ in {p.geo}. Current: {p.supplyChart.current}</div>
              <div className="chart-holder">
                <canvas id="chart-supply" role="img" aria-describedby="chart-supply-desc" aria-label={`${p.geo} active luxury listings over the last 12 months`} />
              <div dangerouslySetInnerHTML={{ __html: srSummary("chart-supply-desc", describeSeries(`Line chart of ${p.geo} active luxury listings`, p.supplyChart.months, [{ name: "Active listings", values: p.supplyChart.data }])) }} />
                <div dangerouslySetInnerHTML={{ __html: srTable(
                  `${p.geo} active luxury listings · 12 months`,
                  ["Month", "Active listings"],
                  zipSeries(p.supplyChart.months, [p.supplyChart.data]),
                ) }} />
              </div>
            </div>
            )}

          </div>

          {computed.domSowhat && (
          <div className="callout">
            <span className="callout-label">DOM Read</span>
            {(() => {
              const text = computed.domSowhat;
              const sIdx = text.indexOf("Sellers:");
              const bIdx = text.indexOf("Buyers:");
              if (sIdx === -1 || bIdx === -1) return <p>{text}</p>;
              return (
                <>
                  <p>{text.slice(0, sIdx).trim()}</p>
                  <p><strong>Sellers:</strong> {capFirst(text.slice(sIdx + 8, bIdx).trim())}</p>
                  <p><strong>Buyers:</strong> {capFirst(text.slice(bIdx + 7).trim())}</p>
                </>
              );
            })()}
          </div>
          )}
        </section>

        {/* EXPLORE THE DATA */}
        <section id="explore-data" className="section">
          <div className="section__eyebrow">The confirmation layer</div>
          <h2 className="section__title">Explore the Data</h2>
          <p className="section__note">Recorded sales, price history, and unit-size breakdowns. The lagging view that confirms the contract signals above.</p>
          <div className="viz-grid">
            {(() => {
              const ex = p.exploreData;
              const hasData = (d?: { condo: (number | null)[]; coop: (number | null)[]; townhouse: (number | null)[] }) => {
                if (!d) return false;
                const anyVal = (arr?: (number | null)[]) => Array.isArray(arr) && arr.some((v) => typeof v === "number" && isFinite(v));
                return anyVal(d.condo) || anyVal(d.coop) || anyVal(d.townhouse);
              };
              const cards = [
                { t: "Weekly Closed Sales", id: "chart-explore-closed", d: ex?.sales_count },
                { t: "Weekly Sales · Price", id: "chart-explore-avgprice", d: ex?.sales_avgprice },
                { t: "Weekly Sales · Discount", id: "chart-explore-discount", d: ex?.sales_discount },
                { t: "Weekly Sales · $/SF", id: "chart-explore-ppsf", d: ex?.sales_ppsf },
              ].filter((c) => hasData(c.d));

              return cards.map((c) => (
                <div key={c.id} className="viz-card">
                  <div className="viz-card-title">{c.t}</div>
                  <div className="viz-card-sub">By property type</div>
                  <div className="chart-holder">
                    <canvas id={c.id} role="img" aria-describedby={`${c.id}-desc`} aria-label={`${p.geo} — ${c.t} by property type`} />
              <div dangerouslySetInnerHTML={{ __html: srSummary(`${c.id}-desc`, describeSeries(`Line chart of ${p.geo} ${c.t} by property type`, ex?.labels ?? [], [{ name: "Condo", values: c.d?.condo ?? [] }, { name: "Co-op", values: c.d?.coop ?? [] }, { name: "Townhouse", values: c.d?.townhouse ?? [] }])) }} />
                    <div dangerouslySetInnerHTML={{ __html: srTable(
                      `${p.geo} — ${c.t} by property type`,
                      ["Week", "Condo", "Co-op", "Townhouse"],
                      zipSeries(ex?.labels ?? [], [c.d?.condo ?? [], c.d?.coop ?? [], c.d?.townhouse ?? []]),
                    ) }} />
                  </div>

                  <div className="viz-footnote">
                    <span style={{ color: "#C7B9B2" }}>■</span> Condo &nbsp;
                    <span style={{ color: "#87806E" }}>■</span> Co-op &nbsp;
                    <span style={{ color: "#8796A1" }}>■</span> Townhouse
                  </div>
                </div>
              ));
            })()}
          </div>
        </section>

        {/* FOOTNOTES / METHODOLOGY */}
        <details id="methodology" className="footnotes" open>
          <summary className="footnotes-title">Methodology &amp; Notes</summary>
          <p>
            {p.geo} residential signed contracts, last asking price, trailing 12 months (TTM). ·{" "}
            Luxury {p.footer.luxuryCutoffDisplay} / Prime {p.footer.primeCutoffDisplay} / Trophy {p.footer.trophyCutoffDisplay} = Manhattan-wide top 10%, 5%, 1% of TTM contracts. Cutoffs update monthly. ·{" "}
            {p.periodLabel} is the latest reporting month (provisional; may revise through {p.provisionalDayCutoff}). ·{" "}
            {p.geo}'s local luxury line is the median of its own contracts that clear the Manhattan Luxury cutoff (top 10%), currently {p.footer.localLineDisplay}. Consumer reference only; every Luxury figure on this page is measured against the Manhattan threshold. ·{" "}
            In each tier card, the contract count is {p.geo}'s own contracts that clear that Manhattan tier. Average price per square foot and 12 month volume are Manhattan-wide totals for the tier, shown as the benchmark {p.geo} is measured against, and are labeled "Manhattan" on the card. ·{" "}
            Metrics based on fewer than 5 contracts are marked "insufficient sample" rather than shown as a percentage change. ·{" "}
            Two rankings appear in this section, refreshed weekly. Both cover only neighborhoods with at least 11 luxury contracts over the trailing 52 weeks, the floor for a stable reading. Luxury dollar volume ranks those neighborhoods by the dollars transacted above the Manhattan Luxury (Top 10%) price line over the trailing 12 months. Luxury intensity ranks them by the share of their trailing-12-month contracts that clear that same price line.
          </p>
        </details>

        <details className="footnotes">
          <summary className="footnotes-title">Abbreviations</summary>
          <p>
            <strong>TTM</strong> · Trailing Twelve Months &nbsp;·&nbsp;{" "}
            <strong>YoY</strong> · Year over Year &nbsp;·&nbsp;{" "}
            <strong>QoQ</strong> · Quarter over Quarter &nbsp;·&nbsp;{" "}
            <strong>MoS</strong> · Months of Supply &nbsp;·&nbsp;{" "}
            <strong>DOF</strong> · Department of Finance
          </p>
        </details>
      </div>
    </div>
  );
}
