"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SOURCES } from "@/lib/sources";
import type { SourceKey } from "@/lib/types";

export type ScatterFilm = {
  id: string;
  t: string; // title
  y: number; // year
  g: number[]; // genre indexes
  p: (number | null)[]; // percentile per source, in SOURCES order
  v: (number | null)[]; // raw value per source
};

const W = 720;
const H = 720;
const PAD = { l: 44, r: 16, t: 16, b: 44 };
const GAP = 20; // percentile points off the diagonal before a dot counts as "disagreeing"

export function Scatter({ films, genres, available }: { films: ScatterFilm[]; genres: string[]; available: SourceKey[] }) {
  const router = useRouter();
  const [xKey, setX] = useState<SourceKey>(available.includes("imdb") ? "imdb" : available[0]);
  const [yKey, setY] = useState<SourceKey>(available.includes("letterboxd") ? "letterboxd" : available.find((k) => k !== xKey)!);
  const [mode, setMode] = useState<"rank" | "raw">("rank");
  const [genre, setGenre] = useState(-1);
  const [decade, setDecade] = useState(0);
  const [hover, setHover] = useState<ScatterFilm | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const xi = SOURCES.findIndex((s) => s.key === xKey);
  const yi = SOURCES.findIndex((s) => s.key === yKey);
  const xs = SOURCES[xi];
  const ys = SOURCES[yi];
  const field = mode === "rank" ? "p" : "v";

  const decades = useMemo(() => [...new Set(films.map((f) => Math.floor(f.y / 10) * 10))].filter(Boolean).sort(), [films]);

  const shown = useMemo(
    () =>
      films.filter(
        (f) =>
          f.p[xi] !== null &&
          f.p[yi] !== null &&
          (genre < 0 || f.g.includes(genre)) &&
          (!decade || Math.floor(f.y / 10) * 10 === decade),
      ),
    [films, xi, yi, genre, decade],
  );

  const [xMin, xMax, yMin, yMax] = useMemo(() => {
    if (mode === "rank") return [0, 100, 0, 100];
    const xv = shown.map((f) => f.v[xi]!);
    const yv = shown.map((f) => f.v[yi]!);
    const pad = (lo: number, hi: number) => [lo - (hi - lo) * 0.04, hi + (hi - lo) * 0.04];
    return [...pad(Math.min(...xv), Math.max(...xv)), ...pad(Math.min(...yv), Math.max(...yv))];
  }, [mode, shown, xi, yi]);

  const sx = (v: number) => PAD.l + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD.l - PAD.r);
  const sy = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b);

  const counts = useMemo(() => {
    let above = 0;
    let below = 0;
    for (const f of shown) {
      const d = f.p[yi]! - f.p[xi]!;
      if (d >= GAP) above++;
      else if (d <= -GAP) below++;
    }
    return { above, below };
  }, [shown, xi, yi]);

  function nearest(e: React.PointerEvent): ScatterFilm | null {
    const rect = svg.current!.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    let best: ScatterFilm | null = null;
    let bestD = 14 * 14;
    for (const f of shown) {
      const dx = sx(f[field][xi]!) - mx;
      const dy = sy(f[field][yi]!) - my;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  // Mouse: hover previews, click opens. Touch: first tap previews, tapping the same dot again opens.
  function onUp(e: React.PointerEvent) {
    const hit = nearest(e);
    if (hit && (e.pointerType === "mouse" || hit.id === hover?.id)) router.push(`/film/${hit.id}`);
    else setHover(hit);
  }

  const ticks = (lo: number, hi: number) => {
    if (mode === "rank") return [0, 25, 50, 75, 100];
    const step = (hi - lo) / 4;
    return [0, 1, 2, 3, 4].map((i) => lo + step * i);
  };
  const fmt = (v: number) => (mode === "rank" ? String(Math.round(v)) : v >= 20 ? String(Math.round(v)) : v.toFixed(1));

  const select = "rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-text";

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-text-2">
          Across
          <select className={select} value={xKey} onChange={(e) => setX(e.target.value as SourceKey)}>
            {available.map((k) => (
              <option key={k} value={k} disabled={k === yKey}>
                {SOURCES.find((s) => s.key === k)!.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-text-2">
          Up
          <select className={select} value={yKey} onChange={(e) => setY(e.target.value as SourceKey)}>
            {available.map((k) => (
              <option key={k} value={k} disabled={k === xKey}>
                {SOURCES.find((s) => s.key === k)!.name}
              </option>
            ))}
          </select>
        </label>
        <select className={select} value={genre} onChange={(e) => setGenre(Number(e.target.value))} aria-label="Genre">
          <option value={-1}>All genres</option>
          {genres.map((g, i) => (
            <option key={g} value={i}>
              {g}
            </option>
          ))}
        </select>
        <select className={select} value={decade} onChange={(e) => setDecade(Number(e.target.value))} aria-label="Decade">
          <option value={0}>All decades</option>
          {decades.map((d) => (
            <option key={d} value={d}>
              {d}s
            </option>
          ))}
        </select>
        <div className="ml-auto flex rounded-full border border-line p-0.5 text-sm">
          {(["rank", "raw"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 ${mode === m ? "bg-text text-bg" : "text-text-2"}`}
            >
              {m === "rank" ? "Rank" : "Raw scores"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-2">
        <span>{shown.length.toLocaleString()} films</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: ys.color }} /> {ys.name} ranks {GAP}+ pts higher ({counts.above})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: xs.color }} /> {xs.name} ranks {GAP}+ pts higher ({counts.below})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-3)]" /> Roughly agree
        </span>
      </div>

      <div className="relative mt-4 rounded-2xl border border-line bg-surface p-2">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          onPointerMove={(e) => e.pointerType === "mouse" && setHover(nearest(e))}
          onPointerUp={onUp}
          onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
          style={{ cursor: hover ? "pointer" : "default" }}
        >
          {ticks(xMin, xMax).map((t) => (
            <g key={`x${t}`}>
              <line x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={H - PAD.b} stroke="var(--line)" />
              <text x={sx(t)} y={H - PAD.b + 18} textAnchor="middle" className="fill-[var(--text-3)] text-[12px]">
                {fmt(t)}
              </text>
            </g>
          ))}
          {ticks(yMin, yMax).map((t) => (
            <g key={`y${t}`}>
              <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
              <text x={PAD.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-[var(--text-3)] text-[12px]">
                {fmt(t)}
              </text>
            </g>
          ))}
          <text x={(W + PAD.l) / 2} y={H - 6} textAnchor="middle" className="fill-[var(--text-2)] text-[13px]">
            {xs.name} {mode === "rank" ? "rank" : "rating"} →
          </text>
          <text
            transform={`translate(14 ${(H - PAD.b) / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-[var(--text-2)] text-[13px]"
          >
            {ys.name} {mode === "rank" ? "rank" : "rating"} →
          </text>
          {mode === "rank" && (
            <line x1={sx(0)} y1={sy(0)} x2={sx(100)} y2={sy(100)} stroke="var(--text-3)" strokeDasharray="4 4" />
          )}
          {shown.map((f) => {
            const d = f.p[yi]! - f.p[xi]!;
            const color = d >= GAP ? ys.color : d <= -GAP ? xs.color : "var(--text-3)";
            return (
              <circle
                key={f.id}
                cx={sx(f[field][xi]!)}
                cy={sy(f[field][yi]!)}
                r={2.6}
                fill={color}
                opacity={Math.abs(d) >= GAP ? 0.85 : 0.35}
              />
            );
          })}
          {hover && (
            <circle
              cx={sx(hover[field][xi]!)}
              cy={sy(hover[field][yi]!)}
              r={7}
              fill="var(--text)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          )}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute left-4 top-4 w-60 rounded-xl border border-line bg-bg/95 p-3 text-xs shadow-xl">
            <div className="text-sm text-text">{hover.t}</div>
            <div className="mb-2 text-text-3">{hover.y}</div>
            {[xs, ys].map((s) => {
              const i = SOURCES.indexOf(s);
              return (
                <div key={s.key} className="flex items-center justify-between py-0.5">
                  <span className="flex items-center gap-1.5 text-text-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="tabular text-text">
                    {s.format(hover.v[i]!)} <span className="text-text-3">(rank {Math.round(hover.p[i]!)})</span>
                  </span>
                </div>
              );
            })}
            <div className="mt-2 text-text-3 sm:hidden">Tap again to open</div>
          </div>
        )}
      </div>
    </div>
  );
}
