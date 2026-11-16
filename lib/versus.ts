// Head-to-head profiles for films, directors and decades, built from the same percentiles as the score.
import { allFilms, allPeople, getFilm } from "./data";
import { SOURCES } from "./sources";
import type { Film, SourceKey } from "./types";

export type VsKind = "film" | "director" | "decade";
export type Entity = {
  kind: VsKind;
  id: string;
  label: string;
  sub: string;
  href: string;
  poster?: string;
  /** Mean percentile per source over the entity's films that have that source. */
  p: Partial<Record<SourceKey, number>>;
  /** How many films contributed to each source's mean. */
  n: Partial<Record<SourceKey, number>>;
  audience: number | null;
  critics: number | null;
  score: number | null;
  films: number;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function aggregate(films: Film[]) {
  const p: Entity["p"] = {};
  const n: Entity["n"] = {};
  for (const s of SOURCES) {
    const xs = films.flatMap((f) => (f.s[s.key] ? [f.s[s.key]!.p] : []));
    if (xs.length) {
      p[s.key] = Math.round(mean(xs)! * 10) / 10;
      n[s.key] = xs.length;
    }
  }
  const r = (x: number | null) => (x === null ? null : Math.round(x));
  return {
    p,
    n,
    audience: r(mean(films.flatMap((f) => (f.audience !== null ? [f.audience] : [])))),
    critics: r(mean(films.flatMap((f) => (f.critics !== null ? [f.critics] : [])))),
    score: r(mean(films.flatMap((f) => (f.score !== null ? [f.score] : [])))),
    films: films.length,
  };
}

export function entity(kind: VsKind, id: string): Entity | null {
  if (kind === "film") {
    const f = getFilm(id);
    if (!f) return null;
    return {
      kind,
      id,
      label: f.title,
      sub: `${f.year ?? ""}${f.genres.length ? ` · ${f.genres.slice(0, 2).join(", ")}` : ""}`,
      href: `/film/${id}`,
      poster: f.poster,
      p: Object.fromEntries(Object.entries(f.s).map(([k, v]) => [k, v.p])),
      n: Object.fromEntries(Object.entries(f.s).map(([k]) => [k, 1])),
      audience: f.audience,
      critics: f.critics,
      score: f.score,
      films: 1,
    };
  }
  if (kind === "director") {
    const person = allPeople()[id];
    if (!person || !person.directed.length) return null;
    const films = person.directed.map((d) => getFilm(d)).filter((f): f is Film => !!f);
    const best = [...films].filter((f) => f.poster).sort((a, b) => (b.s.imdb?.n ?? 0) - (a.s.imdb?.n ?? 0))[0];
    return { kind, id, label: person.name, sub: `${films.length} films directed`, href: `/person/${id}`, poster: best?.poster, ...aggregate(films) };
  }
  // Decade: films with enough ratings to be in the percentile pool, so obscure titles don't dilute it.
  const d = Number(id);
  if (!Number.isFinite(d)) return null;
  const films = allFilms().filter((f) => f.year !== null && Math.floor(f.year / 10) * 10 === d && (f.s.imdb?.n ?? 0) >= 5_000);
  if (!films.length) return null;
  return { kind, id, label: `The ${d}s`, sub: `${films.length.toLocaleString("en-US")} films with 5,000+ ratings`, href: `/explore?decade=${d}`, ...aggregate(films) };
}

export const DECADES = Array.from({ length: 13 }, (_, i) => 1900 + i * 10).filter((d) => d >= 1920);

/** A few plain sentences on how the two compare. */
export function versusLines(a: Entity, b: Entity): string[] {
  const out: string[] = [];
  const cmp = (name: string, x: number | null, y: number | null) => {
    if (x === null || y === null) return null;
    const d = x - y;
    if (Math.abs(d) < 5) return { name, who: 0, d: 0 };
    return { name, who: d > 0 ? 1 : -1, d: Math.abs(Math.round(d)) };
  };
  const c = cmp("critics", a.critics, b.critics);
  const au = cmp("audiences", a.audience, b.audience);
  const w = (s: number) => (s > 0 ? a.label : b.label);
  if (c && au) {
    if (c.who !== 0 && au.who !== 0 && c.who !== au.who) out.push(`A split decision: critics prefer ${w(c.who)} by ${c.d}, audiences prefer ${w(au.who)} by ${au.d}.`);
    else if (c.who === 0 && au.who === 0) out.push("Too close to call: critics and audiences rate these about the same.");
    else if (c.who !== 0 && au.who !== 0) out.push(`${w(c.who)} wins with both critics and audiences (by ${c.d} and ${au.d}).`);
    else {
      const x = c.who !== 0 ? c : au;
      const other = c.who !== 0 ? "audiences" : "critics";
      out.push(`${x.name === "critics" ? "Critics" : "Audiences"} prefer ${w(x.who)} by ${x.d}; ${other} see them as level.`);
    }
  } else if (au && au.who !== 0) out.push(`Audiences prefer ${w(au.who)} by ${au.d}. (One side has no critic scores to compare.)`);
  else if (c && c.who !== 0) out.push(`Critics prefer ${w(c.who)} by ${c.d}.`);
  const lb = (e: Entity) => (e.p.letterboxd !== undefined && e.p.imdb !== undefined ? e.p.letterboxd - e.p.imdb : null);
  const la = lb(a);
  const lbb = lb(b);
  if (la !== null && lbb !== null && Math.abs(la - lbb) >= 10) {
    const higher = la > lbb ? a : b;
    out.push(`Letterboxd likes ${higher.label} relatively more than IMDb does (a ${Math.round(Math.abs(la - lbb))}-point difference in tilt).`);
  }
  if ((a.kind === "director" || a.kind === "decade") && Math.min(a.films, b.films) < 5) out.push("Small catalogs: with under five films a single title can swing these averages.");
  return out;
}
