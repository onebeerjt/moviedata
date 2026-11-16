// Today's stories for the front page, all computed from the catalog. A section with
// nothing true to say returns an empty list and the page doesn't render it.
import { allFilms } from "./data";
import type { Film } from "./types";

export const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

const caGap = (f: Film) => (f.critics !== null && f.audience !== null ? f.critics - f.audience : 0);
const known = (min: number) => allFilms().filter((f) => (f.s.imdb?.n ?? 0) >= min && f.poster);

/**
 * One Film: a famous film with a big critic/audience split. It rotates daily; a film
 * released on this calendar day in some earlier year wins if there is one.
 */
export function oneFilm(today = todayET()) {
  const pool = known(100_000)
    .filter((f) => f.critics !== null && f.audience !== null && Math.abs(caGap(f)) >= 20)
    .sort((a, b) => Math.abs(caGap(b)) - Math.abs(caGap(a)))
    .slice(0, 60);
  if (!pool.length) return null;
  const md = today.slice(5);
  const anniversary = pool.find((f) => f.releaseDate?.slice(5) === md && f.releaseDate.slice(0, 4) < today.slice(0, 4));
  const day = Math.floor(new Date(`${today}T00:00:00Z`).getTime() / 864e5);
  const film = anniversary ?? pool[day % pool.length];
  return { film, anniversary: !!anniversary, yearsAgo: anniversary ? Number(today.slice(0, 4)) - Number(anniversary.releaseDate!.slice(0, 4)) : 0 };
}

/** Popular films released on this calendar day in earlier years. */
export function onThisDay(today = todayET(), limit = 12) {
  const md = today.slice(5);
  return known(25_000)
    .filter((f) => f.releaseDate?.slice(5) === md && f.releaseDate.slice(0, 4) < today.slice(0, 4) && f.score !== null)
    .sort((a, b) => (b.s.imdb?.n ?? 0) - (a.s.imdb?.n ?? 0))
    .slice(0, limit);
}

export type Mover = { film: Film; delta: number; from: number; to: number; detail: string };

/** Biggest audience-score movers over the daily snapshots we keep for recent releases. */
export function movers(limit = 6) {
  const rows: Mover[] = [];
  let first = "9999";
  let last = "";
  for (const f of allFilms()) {
    const h = f.h;
    if (!h || h.length < 3 || !f.poster) continue;
    const a = h[0];
    const b = h[h.length - 1];
    if ((new Date(b[0]).getTime() - new Date(a[0]).getTime()) / 864e5 < 6) continue;
    if (a[1] === null || b[1] === null || a[2] === null || b[2] === null) continue;
    // Audience move on a /10 scale: Letterboxd (/5, doubled) and IMDb averaged.
    const from = (a[1] * 2 + a[2]) / 2;
    const to = (b[1] * 2 + b[2]) / 2;
    if (a[0] < first) first = a[0];
    if (b[0] > last) last = b[0];
    rows.push({
      film: f,
      delta: to - from,
      from,
      to,
      detail: `Letterboxd ${a[1].toFixed(2)} → ${b[1].toFixed(2)} · IMDb ${a[2].toFixed(1)} → ${b[2].toFixed(1)}`,
    });
  }
  const sorted = rows.filter((r) => Math.abs(r.delta) >= 0.15).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return { rows: sorted.slice(0, limit), first, last };
}

/** High-consensus films hardly anyone has seen: strong on every source, modest vote counts. */
export function hiddenGems(limit = 16) {
  return allFilms()
    .filter(
      (f) =>
        f.poster &&
        f.score !== null &&
        f.score >= 80 &&
        f.critics !== null &&
        f.audience !== null &&
        (f.spread ?? 99) <= 18 &&
        Object.keys(f.s).length >= 4 &&
        (f.s.imdb?.n ?? 0) >= 5_000 &&
        (f.s.imdb?.n ?? 0) <= 40_000,
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.s.imdb?.n ?? 0) - (a.s.imdb?.n ?? 0))
    .slice(0, limit);
}

/** A 24×24 density grid of audience (x) against critics (y), for the Quad teaser. */
export function quadDensity(bins = 24) {
  const cells = new Array<number>(bins * bins).fill(0);
  const counts = [0, 0, 0, 0]; // canon, critics' darlings, crowd pleasers, bomb
  let total = 0;
  for (const f of allFilms()) {
    if (f.critics === null || f.audience === null) continue;
    total++;
    const x = Math.min(bins - 1, Math.floor((f.audience / 100) * bins));
    const y = Math.min(bins - 1, Math.floor((f.critics / 100) * bins));
    cells[y * bins + x]++;
    const hiA = f.audience >= 50;
    const hiC = f.critics >= 50;
    counts[hiC ? (hiA ? 0 : 1) : hiA ? 2 : 3]++;
  }
  return { cells, bins, counts, total, max: Math.max(...cells) };
}
