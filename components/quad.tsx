"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AXES, PRESETS, QUAD_KEYS, axisOf, column, quadNames, quadOf, type AxisKey } from "@/lib/quad";
import { loadLite, loadPosters, posterSrc, ttId, type Lite } from "@/lib/lite";

export type QuadInitial = { x: AxisKey; y: AxisKey; decade: number; genre: string; votes: number; quad: number; film: string };

type View = { x0: number; x1: number; y0: number; y1: number };
const FULL: View = { x0: -12, x1: 1012, y0: -12, y1: 1012 };
const VOTE_STEPS = [
  { v: 0, label: "Any number of ratings" },
  { v: 1000, label: "1,000+ IMDb ratings" },
  { v: 5000, label: "5,000+ IMDb ratings" },
  { v: 25000, label: "25,000+ IMDb ratings" },
  { v: 100000, label: "100,000+ IMDb ratings" },
];
const SORTS = [
  { key: "known", label: "Most known" },
  { key: "gap", label: "Biggest gap" },
  { key: "score", label: "Highest score" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const QUAD_VARS = ["--quad-canon", "--quad-ydarling", "--quad-xdarling", "--quad-bomb"];
const QUAD_CLASS = ["border-[var(--quad-canon)]", "border-[var(--quad-ydarling)]", "border-[var(--quad-xdarling)]", "border-[var(--quad-bomb)]"];
const fmtN = (n: number) => n.toLocaleString("en-US");
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Palette = { bg: string; text: string; text2: string; text3: string; line: string; quads: string[]; font: string };
function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return {
    bg: v("--surface", "#1a1a19"),
    text: v("--text", "#f4f3ee"),
    text2: v("--text-2", "#c3c2b7"),
    text3: v("--text-3", "#8a897f"),
    line: v("--line", "#2e2e2b"),
    quads: QUAD_VARS.map((n, i) => v(n, ["#27a577", "#8a7ae0", "#cc8a1c", "#e0527a"][i])),
    font: getComputedStyle(document.body).fontFamily || "system-ui, sans-serif",
  };
}

/** Deterministic ±0.6-point nudge per film, drawing only: ratings come in whole numbers, so ties would stack into stripes. */
const jitter = (n: number, salt: number) => {
  const out = new Int8Array(n);
  for (let i = 0; i < n; i++) out[i] = (Math.imul(i + salt, 2654435761) >>> 24) % 13 - 6;
  return out;
};

type Plot = {
  lite: Lite;
  jx: Int8Array;
  jy: Int8Array;
  xs: Int16Array;
  ys: Int16Array;
  pass: Uint8Array;
  lists: Int32Array[];
  names: ReturnType<typeof quadNames>;
};

type RenderOpts = {
  w: number;
  h: number;
  dpr: number;
  s: number; // type/mark scale (1 on screen, bigger for the exported image)
  view: View;
  activeQuad: number;
  selected: number;
  labelCap: number;
  xLabel: string;
  yLabel: string;
  pal: Palette;
};

/** Plot rectangle inside the canvas, in CSS pixels. */
const margins = (s: number) => ({ l: 38 * s, r: 10 * s, t: 10 * s, b: 34 * s });

function render(ctx: CanvasRenderingContext2D, plot: Plot, o: RenderOpts) {
  const { w, h, s, view, pal } = o;
  const m = margins(s);
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const px = (x: number) => m.l + ((x - view.x0) / (view.x1 - view.x0)) * pw;
  const py = (y: number) => m.t + (1 - (y - view.y0) / (view.y1 - view.y0)) * ph;
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, w, h);

  // Plot clip
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.l, m.t, pw, ph);
  ctx.clip();

  // Quadrant tints, split at the 50th percentile.
  const cx = px(500);
  const cy = py(500);
  const tint = [
    [cx, m.t, m.l + pw - cx, cy - m.t], // canon: right, top
    [m.l, m.t, cx - m.l, cy - m.t], // y-darling: left, top
    [cx, cy, m.l + pw - cx, m.t + ph - cy], // x-darling: right, bottom
    [m.l, cy, cx - m.l, m.t + ph - cy], // bomb: left, bottom
  ];
  for (let q = 0; q < 4; q++) {
    ctx.globalAlpha = o.activeQuad === q ? 0.16 : 0.07;
    ctx.fillStyle = pal.quads[q];
    ctx.fillRect(tint[q][0], tint[q][1], tint[q][2], tint[q][3]);
  }
  ctx.globalAlpha = 1;

  // Dots, one pass per quadrant so the fill color changes four times, not 35,000.
  const zoom = 1024 / (view.x1 - view.x0);
  const side = Math.max(1.1, (1.15 + Math.min(zoom, 14) * 0.5) * (pw < 480 ? 0.85 : 1)) * s;
  const round = side >= 4 * s;
  const { xs, ys, jx, jy } = plot;
  const kx = pw / (view.x1 - view.x0);
  const ky = ph / (view.y1 - view.y0);
  for (let q = 0; q < 4; q++) {
    const dim = o.activeQuad >= 0 && o.activeQuad !== q;
    ctx.globalAlpha = dim ? 0.1 : zoom > 3 ? 0.8 : 0.55;
    ctx.fillStyle = pal.quads[q];
    const list = plot.lists[q];
    if (round) ctx.beginPath();
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      const x = m.l + (xs[i] + jx[i] - view.x0) * kx;
      const y = m.t + (view.y1 - ys[i] - jy[i]) * ky;
      if (x < m.l - side || x > m.l + pw + side || y < m.t - side || y > m.t + ph + side) continue;
      if (round) {
        ctx.moveTo(x + side / 2, y);
        ctx.arc(x, y, side / 2, 0, 6.2832);
      } else ctx.fillRect(x - side / 2, y - side / 2, side, side);
    }
    if (round) ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Crosshair at the 50th percentile.
  ctx.strokeStyle = pal.text3;
  ctx.lineWidth = 1 * s;
  ctx.setLineDash([4 * s, 4 * s]);
  ctx.beginPath();
  ctx.moveTo(cx, m.t);
  ctx.lineTo(cx, m.t + ph);
  ctx.moveTo(m.l, cy);
  ctx.lineTo(m.l + pw, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Landmark labels: the most-rated films still in view, as long as they don't collide.
  if (o.labelCap > 0) {
    ctx.font = `${11 * s}px ${pal.font}`;
    ctx.textBaseline = "middle";
    const boxes: [number, number, number, number][] = [];
    let placed = 0;
    let scanned = 0;
    for (let i = 0; i < plot.lite.n && placed < o.labelCap && scanned < 90; i++) {
      if (!plot.pass[i]) continue;
      const x = px(xs[i]);
      const y = py(ys[i]);
      if (x < m.l + 4 || x > m.l + pw - 4 || y < m.t + 18 * s || y > m.t + ph - 4) continue;
      scanned++;
      let title = plot.lite.t[i];
      if (title.length > 26) title = title.slice(0, 25) + "…";
      const tw = ctx.measureText(title).width;
      const flip = x + tw + 12 * s > m.l + pw;
      const bx = flip ? x - tw - 8 * s : x + 5 * s;
      const box: [number, number, number, number] = [bx - 2 * s, y - 8 * s, tw + 4 * s, 16 * s];
      // Keep clear of the corner captions too.
      if (box[1] < m.t + 34 * s && (box[0] < m.l + 150 * s || box[0] + box[2] > m.l + pw - 150 * s)) continue;
      if (box[1] + box[3] > m.t + ph - 34 * s && (box[0] < m.l + 150 * s || box[0] + box[2] > m.l + pw - 150 * s)) continue;
      if (boxes.some((b) => box[0] < b[0] + b[2] && box[0] + box[2] > b[0] && box[1] < b[1] + b[3] && box[1] + box[3] > b[1])) continue;
      boxes.push(box);
      placed++;
      ctx.lineWidth = 3 * s;
      ctx.strokeStyle = pal.bg;
      ctx.lineJoin = "round";
      ctx.strokeText(title, bx, y);
      ctx.fillStyle = pal.text;
      ctx.fillText(title, bx, y);
      ctx.beginPath();
      ctx.arc(x, y, 2.4 * s, 0, 6.2832);
      ctx.lineWidth = 1.2 * s;
      ctx.strokeStyle = pal.text;
      ctx.stroke();
    }
  }

  // Selected film
  if (o.selected >= 0) {
    const x = px(xs[o.selected]);
    const y = py(ys[o.selected]);
    ctx.beginPath();
    ctx.arc(x, y, 7 * s, 0, 6.2832);
    ctx.lineWidth = 2.5 * s;
    ctx.strokeStyle = pal.bg;
    ctx.stroke();
    ctx.lineWidth = 1.8 * s;
    ctx.strokeStyle = pal.text;
    ctx.stroke();
  }
  ctx.restore();

  // Corner captions: the four boxes, with live counts.
  const counts = plot.lists.map((l) => l.length);
  const total = counts[0] + counts[1] + counts[2] + counts[3];
  const corners: { q: number; x: number; y: number; align: CanvasTextAlign }[] = [
    { q: 0, x: m.l + pw - 8 * s, y: m.t + 8 * s, align: "right" },
    { q: 1, x: m.l + 8 * s, y: m.t + 8 * s, align: "left" },
    { q: 2, x: m.l + pw - 8 * s, y: m.t + ph - 8 * s - 28 * s, align: "right" },
    { q: 3, x: m.l + 8 * s, y: m.t + ph - 8 * s - 28 * s, align: "left" },
  ];
  const keys = QUAD_KEYS;
  for (const c of corners) {
    const nm = plot.names[keys[c.q]];
    ctx.textAlign = c.align;
    ctx.textBaseline = "top";
    ctx.font = `700 ${12 * s}px ${pal.font}`;
    ctx.lineJoin = "round";
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = pal.bg;
    ctx.strokeText(nm.name.toUpperCase(), c.x, c.y);
    ctx.fillStyle = pal.quads[c.q];
    ctx.fillText(nm.name.toUpperCase(), c.x, c.y);
    ctx.font = `${11 * s}px ${pal.font}`;
    const line = `${fmtN(counts[c.q])} · ${total ? Math.round((counts[c.q] / total) * 100) : 0}%`;
    ctx.strokeText(line, c.x, c.y + 16 * s);
    ctx.fillStyle = pal.text2;
    ctx.fillText(line, c.x, c.y + 16 * s);
  }

  // Axes
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 1 * s;
  ctx.strokeRect(m.l, m.t, pw, ph);
  ctx.font = `${10.5 * s}px ${pal.font}`;
  ctx.fillStyle = pal.text3;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const t of [0, 25, 50, 75, 100]) {
    const x = px(t * 10);
    if (x >= m.l - 1 && x <= m.l + pw + 1) ctx.fillText(String(t), clamp(x, m.l + 6 * s, m.l + pw - 6 * s), m.t + ph + 4 * s);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const t of [0, 25, 50, 75, 100]) {
    const y = py(t * 10);
    if (y >= m.t - 1 && y <= m.t + ph + 1) ctx.fillText(String(t), m.l - 5 * s, clamp(y, m.t + 6 * s, m.t + ph - 6 * s));
  }
  ctx.font = `600 ${11 * s}px ${pal.font}`;
  ctx.fillStyle = pal.text2;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${o.xLabel} →`, m.l + pw / 2, h - 2 * s);
  ctx.save();
  ctx.translate(11 * s, m.t + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "middle";
  ctx.fillText(`${o.yLabel} →`, 0, 0);
  ctx.restore();
}

export function Quad({ initial, asOf, totalFilms }: { initial: QuadInitial; asOf: string; totalFilms: number }) {
  const [lite, setLite] = useState<Lite | null>(null);
  const [posters, setPosters] = useState<string[] | null>(null);
  const [error, setError] = useState(false);
  const [x, setX] = useState<AxisKey>(initial.x);
  const [y, setY] = useState<AxisKey>(initial.y);
  const [decade, setDecade] = useState(initial.decade);
  const [genre, setGenre] = useState(initial.genre);
  const [votes, setVotes] = useState(initial.votes);
  const [activeQuad, setActiveQuad] = useState(initial.quad);
  const [sort, setSort] = useState<SortKey>("known");
  const [view, setView] = useState<View>(FULL);
  const [selId, setSelId] = useState(initial.film);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 360, h: 360 });
  const [status, setStatus] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  useEffect(() => {
    // Phones start with the axis/filter controls folded away so the chart is on screen.
    if (window.innerWidth < 640) setFiltersOpen(false);
  }, []);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pts: Map<number, { x: number; y: number }>; start?: { x: number; y: number; t: number; view: View }; moved: boolean; pinch?: number }>({
    pts: new Map(),
    moved: false,
  });
  const lastTap = useRef(0);

  useEffect(() => {
    let live = true;
    loadLite().then((l) => live && setLite(l), () => live && setError(true));
    loadPosters().then((p) => live && setPosters(p), () => {});
    return () => {
      live = false;
    };
  }, []);

  // Fit the canvas to its box: square, capped so it fits a laptop screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      setSize({ w, h: Math.round(Math.min(w * (w < 520 ? 1.08 : 0.82), 720)) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [paletteTick, setPaletteTick] = useState(0);
  useEffect(() => {
    // Redraw when the site design (data-theme) changes.
    const mo = new MutationObserver(() => setPaletteTick((t) => t + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  const jit = useMemo(() => ({ jx: jitter(lite?.n ?? 0, 1), jy: jitter(lite?.n ?? 0, 7919) }), [lite]);

  // Which films pass the filters and have both axes.
  const plot = useMemo<(Plot & { filtered: number; missingX: number; missingY: number; missingBoth: number }) | null>(() => {
    if (!lite) return null;
    const xs = column(lite, x);
    const ys = column(lite, y);
    const gbit = genre ? lite.genres.indexOf(genre) : -1;
    const pass = new Uint8Array(lite.n);
    const buckets: number[][] = [[], [], [], []];
    let filtered = 0;
    let missingX = 0;
    let missingY = 0;
    let missingBoth = 0;
    for (let i = 0; i < lite.n; i++) {
      if (decade && Math.floor(lite.yr[i] / 10) * 10 !== decade) continue;
      if (gbit >= 0 && !(lite.g[i] & (1 << gbit))) continue;
      if (votes && lite.v[i] < votes) continue;
      filtered++;
      const hx = xs[i] >= 0;
      const hy = ys[i] >= 0;
      if (!hx || !hy) {
        if (!hx && !hy) missingBoth++;
        else if (!hx) missingX++;
        else missingY++;
        continue;
      }
      pass[i] = 1;
      buckets[quadOf(xs[i], ys[i])].push(i);
    }
    return { lite, jx: jit.jx, jy: jit.jy, xs, ys, pass, lists: buckets.map((b) => Int32Array.from(b)), names: quadNames(x, y), filtered, missingX, missingY, missingBoth };
  }, [lite, jit, x, y, decade, genre, votes]);

  const selected = useMemo(() => {
    if (!lite || !selId) return -1;
    const n = Number(selId.slice(2));
    const i = lite.id.indexOf(n);
    return i >= 0 && plot?.pass[i] ? i : -1;
  }, [lite, selId, plot]);

  const labelCap = size.w < 520 ? 7 : 16;
  const xAxis = axisOf(x);
  const yAxis = axisOf(y);

  // Draw
  useEffect(() => {
    const c = canvas.current;
    if (!c || !plot) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const id = requestAnimationFrame(() =>
      render(ctx, plot, { w: size.w, h: size.h, dpr, s: 1, view, activeQuad, selected, labelCap, xLabel: xAxis.label, yLabel: yAxis.label, pal: readPalette() }),
    );
    return () => cancelAnimationFrame(id);
  }, [plot, size, view, activeQuad, selected, labelCap, xAxis.label, yAxis.label, paletteTick]);

  // Keep the URL shareable: every setting lives in the query string.
  useEffect(() => {
    const q = new URLSearchParams();
    if (x !== "audience" || y !== "critics") (q.set("x", x), q.set("y", y));
    if (decade) q.set("decade", String(decade));
    if (genre) q.set("genre", genre);
    if (votes) q.set("votes", String(votes));
    if (activeQuad >= 0) q.set("quad", QUAD_KEYS[activeQuad]);
    if (selId) q.set("film", selId);
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [x, y, decade, genre, votes, activeQuad, selId]);

  const toData = useCallback(
    (cx: number, cy: number) => {
      const m = margins(1);
      const pw = size.w - m.l - m.r;
      const ph = size.h - m.t - m.b;
      return { x: view.x0 + ((cx - m.l) / pw) * (view.x1 - view.x0), y: view.y1 - ((cy - m.t) / ph) * (view.y1 - view.y0) };
    },
    [size, view],
  );

  const pick = useCallback(
    (cx: number, cy: number, radius: number) => {
      if (!plot) return -1;
      const m = margins(1);
      const pw = size.w - m.l - m.r;
      const ph = size.h - m.t - m.b;
      const kx = pw / (view.x1 - view.x0);
      const ky = ph / (view.y1 - view.y0);
      let best = -1;
      let bd = radius * radius;
      for (let q = 0; q < 4; q++) {
        const list = plot.lists[q];
        for (let k = 0; k < list.length; k++) {
          const i = list[k];
          const dx = m.l + (plot.xs[i] - view.x0) * kx - cx;
          if (dx > radius || dx < -radius) continue;
          const dy = m.t + (view.y1 - plot.ys[i]) * ky - cy;
          const d = dx * dx + dy * dy;
          // On a tie the more-rated (lower index) film wins.
          if (d < bd || (d === bd && best >= 0 && i < best)) {
            bd = d;
            best = i;
          }
        }
      }
      return best;
    },
    [plot, size, view],
  );

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      setView((v) => {
        const p = toData(cx, cy);
        const w = clamp((v.x1 - v.x0) / factor, 1024 / 40, 1024);
        const h = w; // axes stay in proportion
        const fx = (p.x - v.x0) / (v.x1 - v.x0);
        const fy = (v.y1 - p.y) / (v.y1 - v.y0);
        let x0 = p.x - fx * w;
        let y1 = p.y + fy * h;
        x0 = clamp(x0, FULL.x0, FULL.x1 - w);
        y1 = clamp(y1, FULL.y0 + h, FULL.y1);
        return { x0, x1: x0 + w, y0: y1 - h, y1 };
      });
    },
    [toData],
  );

  const zoomed = view.x1 - view.x0 < 1000;
  const rel = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onDown(e: React.PointerEvent) {
    const d = drag.current;
    const p = rel(e);
    d.pts.set(e.pointerId, p);
    if (d.pts.size === 1) {
      d.start = { ...p, t: Date.now(), view };
      d.moved = false;
    } else if (d.pts.size === 2) {
      const [a, b] = [...d.pts.values()];
      d.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      d.moved = true;
    }
    if (e.pointerType === "mouse" || zoomed) canvas.current!.setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    const p = rel(e);
    if (!d.pts.has(e.pointerId)) {
      if (e.pointerType === "mouse") {
        const i = pick(p.x, p.y, 12);
        setHover(i >= 0 ? { i, x: p.x, y: p.y } : null);
      }
      return;
    }
    const prev = d.pts.get(e.pointerId)!;
    d.pts.set(e.pointerId, p);
    if (d.pts.size === 2 && d.pinch) {
      const [a, b] = [...d.pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / d.pinch);
      d.pinch = dist;
      return;
    }
    if (!d.start) return;
    if (Math.hypot(p.x - d.start.x, p.y - d.start.y) > 5) d.moved = true;
    if (d.moved && zoomed && d.pts.size === 1) {
      const m = margins(1);
      const pw = size.w - m.l - m.r;
      const ph = size.h - m.t - m.b;
      const w = view.x1 - view.x0;
      const dx = ((p.x - prev.x) / pw) * w;
      const dy = ((p.y - prev.y) / ph) * w;
      setView((v) => {
        const x0 = clamp(v.x0 - dx, FULL.x0, FULL.x1 - w);
        const y0 = clamp(v.y0 + dy, FULL.y0, FULL.y1 - w);
        return { x0, x1: x0 + w, y0, y1: y0 + w };
      });
      setHover(null);
    }
  }

  function onUp(e: React.PointerEvent) {
    const d = drag.current;
    const p = rel(e);
    const wasTap = d.pts.size === 1 && !d.moved && d.start && Date.now() - d.start.t < 600;
    d.pts.delete(e.pointerId);
    if (d.pts.size < 2) d.pinch = undefined;
    if (!wasTap) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      zoomAt(p.x, p.y, 2.2);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    const i = pick(p.x, p.y, e.pointerType === "mouse" ? 12 : 24);
    if (i >= 0 && plot) {
      setSelId(ttId(plot.lite.id[i]));
      setHover(null);
    } else setSelId("");
  }

  // ⌘/Ctrl + scroll (and trackpad pinch) zooms; plain scrolling still scrolls the page.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = c.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Decades with enough films to be worth a chip.
  const decades = useMemo(() => {
    if (!lite) return [] as number[];
    const c = new Map<number, number>();
    for (let i = 0; i < lite.n; i++) if (lite.yr[i] >= 1910) c.set(Math.floor(lite.yr[i] / 10) * 10, (c.get(Math.floor(lite.yr[i] / 10) * 10) ?? 0) + 1);
    return [...c].filter(([, n]) => n >= 50).map(([d]) => d).sort((a, b) => a - b);
  }, [lite]);

  const listed = useMemo(() => {
    if (!plot || activeQuad < 0) return [];
    const l = Array.from(plot.lists[activeQuad]);
    if (sort === "gap") l.sort((a, b) => Math.abs(plot.xs[b] - plot.ys[b]) - Math.abs(plot.xs[a] - plot.ys[a]));
    else if (sort === "score") l.sort((a, b) => plot.lite.sc[b] - plot.lite.sc[a] || a - b);
    return l.slice(0, 30);
  }, [plot, activeQuad, sort]);

  function setAxis(which: "x" | "y", k: AxisKey) {
    if (which === "x") {
      if (k === y) setY(x);
      setX(k);
    } else {
      if (k === x) setX(y);
      setY(k);
    }
    setView(FULL);
  }

  const total = plot ? plot.lists.reduce((s, l) => s + l.length, 0) : 0;
  const filmLine = (i: number) => {
    const l = plot!.lite;
    return { id: ttId(l.id[i]), title: l.t[i], year: l.yr[i], score: l.sc[i], votes: l.v[i], xv: Math.round(plot!.xs[i] / 10), yv: Math.round(plot!.ys[i] / 10), poster: posters?.[i] };
  };

  async function savePng() {
    if (!plot) return;
    setStatus("Rendering…");
    const pal = readPalette();
    const W = 1080;
    const head = 190;
    const plotH = 1000;
    const foot = 74;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = head + plotH + foot;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, c.width, c.height);
    const chart = document.createElement("canvas");
    chart.width = W;
    chart.height = plotH;
    render(chart.getContext("2d")!, plot, { w: W, h: plotH, dpr: 1, s: 1.7, view, activeQuad, selected: -1, labelCap: 22, xLabel: xAxis.label, yLabel: yAxis.label, pal });
    ctx.drawImage(chart, 0, head);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = pal.text;
    ctx.font = `700 60px ${pal.font}`;
    ctx.fillText("The Quad", 40, 82);
    ctx.fillStyle = pal.text2;
    ctx.font = `28px ${pal.font}`;
    const bits = [`${xAxis.label} × ${yAxis.label}`, decade ? `${decade}s` : "", genre, votes ? `${fmtN(votes)}+ IMDb ratings` : ""].filter(Boolean);
    ctx.fillText(bits.join(" · "), 40, 128);
    ctx.fillStyle = pal.text3;
    ctx.font = `24px ${pal.font}`;
    ctx.fillText(`${fmtN(total)} films, each a dot · percentile rank on each site`, 40, 166);
    ctx.fillText(`Consensus · ${window.location.host} · scores as of ${asOf}`, 40, head + plotH + 46);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
    if (!blob) return setStatus("Couldn't render the image");
    const file = new File([blob], "consensus-quad.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "The Quad · Consensus", url: window.location.href });
        return setStatus("");
      } catch {
        /* cancelled: fall through to the download */
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "consensus-quad.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setStatus("Image saved");
    setTimeout(() => setStatus(""), 2500);
  }

  async function copyLink() {
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: "The Quad · Consensus", url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setStatus("Link copied");
        setTimeout(() => setStatus(""), 2000);
      }
    } catch {
      /* cancelled */
    }
  }

  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition ${on ? "border-text bg-text text-bg" : "border-line text-text-2 hover:bg-surface-2 hover:text-text"}`;
  const select = "min-w-0 rounded-full border border-line bg-surface px-3 py-2 text-sm text-text outline-none focus:border-text-3";
  const names = plot?.names;
  const sel = selected >= 0 ? filmLine(selected) : null;
  const hov = hover && plot ? filmLine(hover.i) : null;
  const missingTotal = plot ? plot.missingX + plot.missingY + plot.missingBoth : 0;
  const thatLack = (() => {
    if (!plot) return "";
    const parts: string[] = [];
    if (plot.missingX + plot.missingBoth) parts.push(`${fmtN(plot.missingX + plot.missingBoth)} have no ${xAxis.noun} score`);
    if (plot.missingY + plot.missingBoth) parts.push(`${fmtN(plot.missingY + plot.missingBoth)} have no ${yAxis.noun} score`);
    return parts.join("; ");
  })();

  return (
    <div>
      <div className="scroller -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => ((setX(p.x), setY(p.y), setView(FULL)))} className={chip(x === p.x && y === p.y)}>
            {p.name}
          </button>
        ))}
      </div>

      <details open={filtersOpen} onToggle={(e) => setFiltersOpen(e.currentTarget.open)} className="mt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-full border border-line px-4 py-2 text-sm text-text-2 sm:hidden">
        <span className="truncate">{xAxis.label} × {yAxis.label}{genre ? ` · ${genre}` : ""}{votes ? ` · ${fmtN(votes)}+ ratings` : ""}</span>
        <span aria-hidden>{filtersOpen ? "▴" : "▾ Axes & filters"}</span>
      </summary>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:mt-0 sm:flex sm:flex-wrap">
        <label className="flex min-w-0 items-center gap-2 text-xs text-text-3">
          <span className="shrink-0">X</span>
          <select aria-label="X axis" value={x} onChange={(e) => setAxis("x", e.target.value as AxisKey)} className={`${select} w-full`}>
            {AXES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <button aria-label="Swap axes" onClick={() => (setX(y), setY(x), setView(FULL))} className="h-9 w-9 shrink-0 rounded-full border border-line text-text-2 hover:bg-surface-2">
          ⇄
        </button>
        <label className="flex min-w-0 items-center gap-2 text-xs text-text-3">
          <span className="shrink-0">Y</span>
          <select aria-label="Y axis" value={y} onChange={(e) => setAxis("y", e.target.value as AxisKey)} className={`${select} w-full`}>
            {AXES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <select aria-label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} className={`${select} col-span-1 sm:ml-auto`}>
          <option value="">All genres</option>
          {lite?.genres.filter((g) => !["News", "Talk-Show"].includes(g)).sort().map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select aria-label="Minimum ratings" value={votes} onChange={(e) => setVotes(Number(e.target.value))} className={`${select} col-span-2 sm:col-span-1`}>
          {VOTE_STEPS.map((v) => (
            <option key={v.v} value={v.v}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      </details>

      <div className="scroller -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Decade">
        <button onClick={() => setDecade(0)} className={chip(!decade)}>
          All decades
        </button>
        {decades.map((d) => (
          <button key={d} onClick={() => setDecade(decade === d ? 0 : d)} className={chip(decade === d)}>
            {d}s
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-text-2" aria-live="polite">
        {plot ? (
          <>
            <b className="tabular text-text">{fmtN(total)}</b> films plotted
            {plot.filtered !== totalFilms || missingTotal > 0 ? <> of {fmtN(plot.filtered)} that match</> : null}.
            {missingTotal > 0 && (
              <span className="text-text-3">
                {" "}
                {fmtN(missingTotal)} can&apos;t be placed on this pairing: {thatLack}.
              </span>
            )}
          </>
        ) : error ? (
          "Couldn't load the film data. Refresh to try again."
        ) : (
          "Loading 35,000 films…"
        )}
      </p>

      <div className="relative mt-3 select-none rounded-2xl border border-line bg-surface p-1.5 sm:p-2">
        <div ref={wrap} className="relative w-full" style={{ height: size.h }}>
          <canvas
            ref={canvas}
            role="img"
            aria-label={`Scatter of ${fmtN(total)} films: ${xAxis.label} on the horizontal axis, ${yAxis.label} on the vertical. ${plot ? QUAD_KEYS.map((k, i) => `${plot.names[k].name}: ${fmtN(plot.lists[i].length)}`).join("; ") : ""}.`}
            style={{ width: size.w, height: size.h, touchAction: zoomed ? "none" : "pan-y", cursor: hover ? "pointer" : zoomed ? "grab" : "crosshair" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={(e) => {
              drag.current.pts.delete(e.pointerId);
            }}
            onPointerLeave={() => setHover(null)}
            className="block rounded-xl"
          />
          {!plot && !error && <div className="absolute inset-0 grid place-items-center text-sm text-text-3">Loading…</div>}
          {plot && total === 0 && <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-text-2">No films have both scores under these filters.</div>}
          {hov && (
            <div
              className="pointer-events-none absolute z-10 max-w-[14rem] rounded-lg border border-line bg-bg/95 px-3 py-2 text-xs shadow-xl"
              style={{ left: clamp(hover!.x + 14, 0, size.w - 170), top: clamp(hover!.y - 8, 0, size.h - 70) }}
            >
              <div className="font-semibold text-text">
                {hov.title} <span className="font-normal text-text-3">{hov.year || ""}</span>
              </div>
              <div className="tabular mt-0.5 text-text-2">
                {xAxis.label} {hov.xv} · {yAxis.label} {hov.yv}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pb-1 pt-2 text-[11px] text-text-3">
          <span className="basis-full">Each dot is a film at its percentile rank on each site (50 = the median film), nudged up to half a point so ties don&apos;t stack into stripes. Tap a dot for the film. Scores as of {asOf}.</span>
          <span className="ml-auto flex items-center gap-1">
            <button aria-label="Zoom out" disabled={!zoomed} onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.8)} className="h-8 w-8 rounded-full border border-line text-base leading-none text-text hover:bg-surface-2 disabled:opacity-30">
              −
            </button>
            <button aria-label="Zoom in" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.8)} className="h-8 w-8 rounded-full border border-line text-base leading-none text-text hover:bg-surface-2">
              +
            </button>
            {zoomed && (
              <button onClick={() => setView(FULL)} className="h-8 rounded-full border border-line px-3 text-xs text-text hover:bg-surface-2">
                Reset
              </button>
            )}
          </span>
        </div>
      </div>

      {sel && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          <Thumb src={posterSrc(sel.poster)} title={sel.title} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-xl">
              {sel.title} <span className="font-sans text-sm text-text-3">{sel.year || ""}</span>
            </div>
            <div className="tabular text-xs text-text-2">
              {xAxis.label} {sel.xv} · {yAxis.label} {sel.yv}
              {sel.score >= 0 && <> · Consensus {sel.score}</>} · {sel.votes.toLocaleString()} IMDb ratings
            </div>
          </div>
          <Link href={`/film/${sel.id}`} className="shrink-0 rounded-full bg-text px-4 py-2 text-sm font-semibold text-bg">
            Open →
          </Link>
          <button aria-label="Clear selection" onClick={() => setSelId("")} className="shrink-0 px-1 text-text-3 hover:text-text">
            ✕
          </button>
        </div>
      )}

      {names && plot && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
          {[1, 0, 3, 2].map((q) => {
            const nm = names[QUAD_KEYS[q]];
            const on = activeQuad === q;
            return (
              <button
                key={q}
                aria-pressed={on}
                onClick={() => setActiveQuad(on ? -1 : q)}
                className={`rounded-2xl border-l-4 border-y border-r border-y-line border-r-line bg-surface p-3 text-left transition hover:bg-surface-2 sm:p-4 ${QUAD_CLASS[q]} ${on ? "bg-surface-2 ring-1 ring-[var(--text-3)]" : ""}`}
              >
                <div className="text-sm font-semibold sm:text-base" style={{ color: `var(${QUAD_VARS[q]})` }}>
                  {nm.name}
                </div>
                <div className="tabular font-display text-3xl leading-tight sm:text-4xl">{fmtN(plot.lists[q].length)}</div>
                <div className="text-[11px] text-text-3 sm:text-xs">
                  {total ? Math.round((plot.lists[q].length / total) * 100) : 0}% · {nm.sub}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {plot && activeQuad >= 0 && names && (
        <section className="mt-5 rounded-2xl border border-line bg-surface p-3 sm:p-5" aria-label="Films in this box">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">{names[QUAD_KEYS[activeQuad]].name}</h2>
            <div className="flex gap-1.5" role="group" aria-label="Sort films">
              {SORTS.map((s) => (
                <button key={s.key} onClick={() => setSort(s.key)} className={chip(sort === s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <ol className="grid gap-x-6 sm:grid-cols-2">
            {listed.map((i) => {
              const f = filmLine(i);
              return (
                <li key={f.id}>
                  <Link href={`/film/${f.id}`} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-surface-2">
                    <Thumb src={posterSrc(f.poster, "w92")} title={f.title} small />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{f.title}</div>
                      <div className="tabular text-xs text-text-3">
                        {f.year || "—"} · {xAxis.label} {f.xv} · {yAxis.label} {f.yv}
                      </div>
                    </div>
                    {f.score >= 0 && <div className="tabular text-sm font-semibold">{f.score}</div>}
                  </Link>
                </li>
              );
            })}
          </ol>
          {plot.lists[activeQuad].length > listed.length && (
            <p className="mt-2 text-xs text-text-3">Showing {listed.length} of {fmtN(plot.lists[activeQuad].length)}. Narrow the filters above to dig further.</p>
          )}
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={savePng} disabled={!plot} className="rounded-full bg-text px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-40">
          Save as image
        </button>
        <button onClick={copyLink} className="rounded-full border border-line px-5 py-2.5 text-sm text-text hover:bg-surface-2">
          Share this view
        </button>
        <span className="text-xs text-text-3" aria-live="polite">
          {status}
        </span>
      </div>
    </div>
  );
}

function Thumb({ src, title, small }: { src?: string; title: string; small?: boolean }) {
  return (
    <div className={`${small ? "h-12 w-8" : "h-20 w-14"} shrink-0 overflow-hidden rounded bg-surface-2`}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" title={title} />
      )}
    </div>
  );
}
