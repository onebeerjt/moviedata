"use client";

import Link from "next/link";
import { useState } from "react";
import { ScoreBadge } from "./score-badge";

export type WeekFilm = {
  id: string;
  title: string;
  year?: number | null;
  poster?: string;
  score: number | null;
  releaseDate: string;
};

export type WeekBucket = {
  /** Monday of the week, YYYY-MM-DD. */
  start: string;
  /** Sunday of the week, YYYY-MM-DD. */
  end: string;
  current: boolean;
  films: WeekFilm[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(iso: string) {
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) };
}

function fmtRange(start: string, end: string) {
  const s = parts(start);
  const e = parts(end);
  if (s.y === e.y && s.m === e.m) return `${MONTHS[s.m - 1]} ${s.d} – ${e.d}`;
  if (s.y === e.y) return `${MONTHS[s.m - 1]} ${s.d} – ${MONTHS[e.m - 1]} ${e.d}`;
  return `${MONTHS[s.m - 1]} ${s.d}, ${s.y} – ${MONTHS[e.m - 1]} ${e.d}, ${e.y}`;
}

function fmtDay(iso: string) {
  const { y, m, d } = parts(iso);
  const dow = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow} ${MONTHS[m - 1]} ${d}`;
}

function WeekCard({ film }: { film: WeekFilm }) {
  const src = film.poster ? `https://image.tmdb.org/t/p/w342${film.poster}` : undefined;
  const hue = [...film.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return (
    <Link href={`/film/${film.id}`} className="group block w-36 shrink-0 sm:w-40">
      <div className="relative">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={`${film.title} poster`}
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:brightness-110"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col justify-end p-3"
              style={{ background: `linear-gradient(160deg, hsl(${hue} 25% 22%), hsl(${(hue + 40) % 360} 20% 10%))` }}
            >
              <div className="font-display text-lg leading-tight text-text">{film.title}</div>
              <div className="mt-1 text-xs text-text-2">{film.year}</div>
            </div>
          )}
        </div>
        <div className="absolute bottom-2 right-2 rounded-full bg-bg/90 p-0.5">
          <ScoreBadge score={film.score} size="sm" />
        </div>
      </div>
      <div className="mt-2 truncate text-sm">{film.title}</div>
      <div className="text-xs text-text-3">
        {film.year} · {fmtDay(film.releaseDate)}
      </div>
    </Link>
  );
}

/** "New this week": theatrical releases bucketed by week, ‹ › steps one week at a time. */
export function WeeklyRail({ weeks }: { weeks: WeekBucket[] }) {
  const [idx, setIdx] = useState(0);
  if (weeks.length === 0) return null;
  const week = weeks[Math.min(idx, weeks.length - 1)];
  const canOlder = idx < weeks.length - 1;
  const canNewer = idx > 0;
  const arrow =
    "flex h-10 w-10 items-center justify-center rounded-full border border-line text-xl leading-none text-text transition enabled:hover:bg-surface-2 disabled:opacity-30";
  return (
    <section aria-label="New this week">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl">New this week</h2>
          <div className="mt-1 text-xs text-text-3">
            {week.current ? "This week" : "Week of"} · {fmtRange(week.start, week.end)} · {week.films.length}{" "}
            {week.films.length === 1 ? "release" : "releases"}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" aria-label="Previous week" disabled={!canOlder} onClick={() => setIdx(idx + 1)} className={arrow}>
            ‹
          </button>
          <button type="button" aria-label="Next week" disabled={!canNewer} onClick={() => setIdx(idx - 1)} className={arrow}>
            ›
          </button>
        </div>
      </div>
      <div key={week.start} className="scroller -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
        {week.films.map((f) => (
          <WeekCard key={f.id} film={f} />
        ))}
      </div>
    </section>
  );
}
