"use client";

import { useState } from "react";
import Link from "next/link";
import { SOURCES } from "@/lib/sources";

type Point = { id: string; title: string; year: number | null; score: number | null; p: Record<string, number>; raw: Record<string, string> };

/** One line per source across a career (films in release order), on the shared 0–100 rank scale. */
export function Filmography({ films }: { films: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const sources = SOURCES.filter((s) => films.some((f) => f.p[s.key] !== undefined));
  const W = 800;
  const H = 260;
  const pad = { l: 32, r: 12, t: 12, b: 28 };
  const x = (i: number) => pad.l + (films.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (films.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const step = films.length > 1 ? (W - pad.l - pad.r) / (films.length - 1) : W;
  const labelEvery = Math.ceil(films.length / 8);
  const hf = hover !== null ? films[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-2">
        {sources.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--text-3)] text-[11px]">
                {t}
              </text>
            </g>
          ))}
          {films.map((f, i) =>
            i % labelEvery === 0 ? (
              <text key={f.id} x={x(i)} y={H - 8} textAnchor="middle" className="fill-[var(--text-3)] text-[11px]">
                {f.year}
              </text>
            ) : null,
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--text-3)" strokeWidth={1} />}
          {sources.map((s) => {
            const pts = films.flatMap((f, i) => (f.p[s.key] !== undefined ? [[x(i), y(f.p[s.key])] as const] : []));
            return (
              <g key={s.key}>
                <polyline
                  points={pts.map((p) => p.join(",")).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  opacity={hover === null ? 1 : 0.6}
                />
                {pts.map(([px, py], j) => (
                  <circle key={j} cx={px} cy={py} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                ))}
              </g>
            );
          })}
          {films.map((f, i) => (
            <rect
              key={f.id}
              x={x(i) - step / 2}
              y={0}
              width={step}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
        </svg>
        {hf && hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-56 rounded-xl border border-line bg-bg/95 p-3 text-xs shadow-xl"
            style={{ left: `${Math.min(Math.max((x(hover) / W) * 100, 15), 70)}%` }}
          >
            <div className="text-sm text-text">{hf.title}</div>
            <div className="mb-2 text-text-3">
              {hf.year} · balanced {hf.score ?? "—"}
            </div>
            {sources.map((s) =>
              hf.p[s.key] !== undefined ? (
                <div key={s.key} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="flex items-center gap-1.5 text-text-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="tabular text-text">
                    {hf.raw[s.key]} <span className="text-text-3">({hf.p[s.key]})</span>
                  </span>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>
      {hf && (
        <Link href={`/film/${hf.id}`} className="mt-2 inline-block text-xs text-text-2 underline sm:hidden">
          Open {hf.title}
        </Link>
      )}
    </div>
  );
}
