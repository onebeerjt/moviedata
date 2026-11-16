// "Same shape": films whose disagreement profile rhymes with this one. Not generic
// similars (same genre, same cast): films where the *same sources* split the *same way*,
// e.g. critics loved it and audiences shrugged, or Letterboxd adores it and IMDb doesn't.
import { allFilms } from "./data";
import type { Film } from "./types";

type Profile = {
  film: Film;
  /** critics − audience, Letterboxd − IMDb, Rotten Tomatoes − Metacritic (percentile points); null = a side is missing */
  ca: number | null;
  li: number | null;
  rm: number | null;
  level: number;
  votes: number;
};

export const profileOf = (f: Film): Profile => {
  const { letterboxd, imdb, rt, metacritic } = f.s;
  return {
    film: f,
    ca: f.critics !== null && f.audience !== null ? f.critics - f.audience : null,
    li: letterboxd && imdb ? letterboxd.p - imdb.p : null,
    rm: rt && metacritic ? rt.p - metacritic.p : null,
    level: f.score ?? 50,
    votes: f.s.imdb?.n ?? 0,
  };
};

let pool: Profile[] | null = null;
const getPool = () => (pool ??= allFilms().filter((f) => f.poster && (f.s.imdb?.n ?? 0) >= 10_000 && Object.keys(f.s).length >= 2).map(profileOf));

/** The sources' split in a few words, for captions. Null when there's nothing to describe. */
export function describeShape(f: Film): string | null {
  const p = profileOf(f);
  const parts: [number, string][] = [];
  if (p.ca !== null && Math.abs(p.ca) >= 12) parts.push([Math.abs(p.ca), p.ca > 0 ? `critics ahead of audiences by ${Math.round(p.ca)}` : `audiences ahead of critics by ${Math.round(-p.ca)}`]);
  if (p.li !== null && Math.abs(p.li) >= 12) parts.push([Math.abs(p.li), p.li > 0 ? `Letterboxd ahead of IMDb by ${Math.round(p.li)}` : `IMDb ahead of Letterboxd by ${Math.round(-p.li)}`]);
  if (p.rm !== null && Math.abs(p.rm) >= 20) parts.push([Math.abs(p.rm), p.rm > 0 ? `Rotten Tomatoes ahead of Metacritic by ${Math.round(p.rm)}` : `Metacritic ahead of Rotten Tomatoes by ${Math.round(-p.rm)}`]);
  parts.sort((a, b) => b[0] - a[0]);
  return parts[0]?.[1] ?? null;
}

export function sameShape(film: Film, limit = 8): { film: Film; why: string }[] {
  const me = profileOf(film);
  const comps = (["ca", "li", "rm"] as const).filter((k) => me[k] !== null);
  if (!comps.length) return [];
  const tight = (film.spread ?? 99) <= 12;
  const weight = { ca: 1, li: 1, rm: 0.5 };
  const levelWeight = tight ? 1 : 0.2;
  const scored: { p: Profile; d: number }[] = [];
  for (const p of getPool()) {
    if (p.film.id === film.id) continue;
    let d = levelWeight * (p.level - me.level) ** 2;
    let ok = true;
    for (const k of comps) {
      const theirs = p[k];
      if (theirs === null) {
        ok = false;
        break;
      }
      d += weight[k] * (theirs - (me[k] as number)) ** 2;
    }
    if (!ok) continue;
    // Prefer titles people know: fewer than 100k ratings costs a little.
    d += Math.max(0, 5 - Math.log10(p.votes)) * 12;
    scored.push({ p, d });
  }
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, limit).map(({ p }) => ({ film: p.film, why: describeShape(p.film) ?? (tight ? "every source agrees" : "") }));
}
