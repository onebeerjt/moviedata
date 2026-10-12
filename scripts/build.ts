// Merges every source into the files the site reads (data/site/*.json) and
// computes the balanced score. Run after any ingest/scrape step.
//
// Method (also explained on /about):
//  1. Shrink each source's raw rating toward that source's average when it has
//     relatively few votes (Bayesian average), so 40 votes at 4.8 doesn't beat 400k at 4.2.
//  2. Convert to a percentile within that source. Every site has its own
//     inflation (an IMDb 7.0 and a Letterboxd 3.5 are both "about average"),
//     and percentiles cancel it out.
//  3. Average the audience percentiles and the critic percentiles separately,
//     then weight the two groups equally. If only one group exists, use it.
import { join } from "node:path";
import { SITE, SOURCES, readJson, unwrapAffiliate, usableLink, writeJson } from "./util.ts";
import type { ImdbFilm } from "./ingest-imdb.ts";
import type { LetterboxdEntry } from "./scrape-letterboxd.ts";
import type { TmdbEntry } from "./enrich-tmdb.ts";
import type { OmdbEntry } from "./enrich-omdb.ts";
import type { FreeFile } from "./free-catalog.ts";
import type { FreeLinks } from "./free-links.ts";
import type { ServiceLinks } from "./service-catalogs.ts";
import type { Playable } from "./trailers.ts";
import type { Film, FreeService, GroupStat, Insights, Person, SourceKey } from "../lib/types.ts";

const imdb = readJson<Record<string, ImdbFilm>>(join(SOURCES, "imdb.json"), {});
const names = readJson<Record<string, string>>(join(SOURCES, "imdb-people.json"), {});
const lb = readJson<Record<string, LetterboxdEntry>>(join(SOURCES, "letterboxd.json"), {});
const tmdb = readJson<Record<string, TmdbEntry>>(join(SOURCES, "tmdb.json"), {});
const omdb = readJson<Record<string, OmdbEntry>>(join(SOURCES, "omdb.json"), {});
const free = readJson<FreeFile>(join(SOURCES, "free.json"), { updatedAt: "", services: {}, films: {}, checked: {} });
const freeLinks = readJson<FreeLinks>(join(SOURCES, "free-links.json"), {});
const playable = readJson<Record<string, Playable>>(join(SOURCES, "trailers.json"), {});
const serviceLinks = readJson<ServiceLinks>(join(SOURCES, "service-links.json"), { updatedAt: "", links: {} }).links;
const nowPlaying = new Set(readJson<{ ids: string[] }>(join(SOURCES, "now-playing.json"), { ids: [] }).ids);
const historyPath = join(SOURCES, "history.json");
const history = readJson<Record<string, Film["h"]>>(historyPath, {});

if (!Object.keys(imdb).length) throw new Error("No IMDb data — run `npm run data:imdb` first");

type Raw = { v: number; n?: number };
const raw: Record<SourceKey, Map<string, Raw>> = {
  letterboxd: new Map(),
  imdb: new Map(),
  tmdb: new Map(),
  rt: new Map(),
  metacritic: new Map(),
};

for (const [id, f] of Object.entries(imdb)) {
  raw.imdb.set(id, { v: f.rating, n: f.votes });
  const l = lb[id];
  if (l?.rating && l.count) raw.letterboxd.set(id, { v: l.rating, n: l.count });
  const t = tmdb[id];
  if (t?.rating && t.votes && t.votes >= 20) raw.tmdb.set(id, { v: t.rating, n: t.votes });
  const o = omdb[id];
  if (o?.rt !== undefined) raw.rt.set(id, { v: o.rt });
  if (o?.metacritic !== undefined) raw.metacritic.set(id, { v: o.metacritic });
}

// Films with at least this many IMDb votes form the reference pool each
// source's percentiles are measured against. Thousands of obscure titles
// (mostly from the free catalog) would otherwise dilute the pool and push
// every established film toward 100.
const REFERENCE_VOTES = 5_000;
const inReference = (id: string) => (imdb[id]?.votes ?? 0) >= REFERENCE_VOTES;

/**
 * Percentile (0–100) of every film within one source, after vote-count
 * shrinkage, ranked against the reference pool.
 */
function percentiles(values: Map<string, Raw>): Map<string, number> {
  const entries = [...values];
  const ref = entries.filter(([id]) => inReference(id));
  const pool = ref.length >= 50 ? ref : entries;
  if (!pool.length) return new Map();
  const mean = pool.reduce((s, [, r]) => s + r.v, 0) / pool.length;
  const counts = pool.map(([, r]) => r.n).filter((n): n is number => n !== undefined).sort((a, b) => a - b);
  // Prior strength = the 25th-percentile vote count on this source. Strong enough
  // that a few thousand enthusiastic early votes can't push a film to the top.
  const m = counts.length ? counts[Math.floor(counts.length * 0.25)] : 0;
  const adjust = (r: Raw) => (r.n === undefined || !m ? r.v : (r.n * r.v + m * mean) / (r.n + m));
  const sorted = pool.map(([, r]) => adjust(r)).sort((a, b) => a - b);
  // Index of the first value >= x (lo) or > x (hi), by binary search.
  const bound = (x: number, strict: boolean) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (strict ? sorted[mid] <= x : sorted[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const out = new Map<string, number>();
  for (const [id, r] of entries) {
    const v = adjust(r);
    // Ties share the midpoint rank so identical scores get identical percentiles.
    const below = bound(v, false);
    const equal = bound(v, true) - below;
    const pct = sorted.length === 1 ? 50 : ((below + equal / 2) / sorted.length) * 100;
    out.set(id, Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10);
  }
  return out;
}

const pct = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, percentiles(v)])) as Record<
  SourceKey,
  Map<string, number>
>;

const AUDIENCE: SourceKey[] = ["letterboxd", "imdb", "tmdb"];
const CRITICS: SourceKey[] = ["rt", "metacritic"];
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (x: number | null) => (x === null ? null : Math.round(x));
const today = new Date().toISOString().slice(0, 10);

const films: Film[] = Object.entries(imdb).map(([id, f]) => {
  const s: Film["s"] = {};
  for (const key of Object.keys(raw) as SourceKey[]) {
    const r = raw[key].get(id);
    const p = pct[key].get(id);
    if (r && p !== undefined) s[key] = { ...r, p };
  }
  const audience = mean(AUDIENCE.flatMap((k) => (s[k] ? [s[k]!.p] : [])));
  const critics = mean(CRITICS.flatMap((k) => (s[k] ? [s[k]!.p] : [])));
  // A balanced score needs at least two sources. With only audiences or only
  // critics it's eased 10% toward the middle, so a 100 takes both agreeing.
  const sources = Object.keys(s).length;
  const oneSided = audience ?? critics;
  const score =
    sources < 2 ? null : audience !== null && critics !== null ? (audience + critics) / 2 : oneSided === null ? null : 50 + (oneSided - 50) * 0.9;
  const ps = Object.values(s).map((x) => x.p);
  const t = tmdb[id];

  // Keep a daily trail for recent releases so the film page can show movement.
  const releaseDate = t?.releaseDate;
  const ageDays = releaseDate ? (Date.now() - new Date(releaseDate).getTime()) / 864e5 : f.year ? (new Date().getFullYear() - f.year) * 365 : 9999;
  let h = history[id];
  if (ageDays < 180) {
    h = (h ?? []).filter((row) => row[0] !== today);
    h.push([today, s.letterboxd?.v ?? null, s.imdb?.v ?? null, s.rt?.v ?? null, s.metacritic?.v ?? null]);
    history[id] = h;
  }

  return {
    id,
    title: f.title,
    year: f.year,
    runtime: f.runtime,
    genres: f.genres,
    directors: f.directors,
    cast: f.cast,
    poster: t?.poster,
    backdrop: t?.backdrop,
    overview: t?.overview,
    releaseDate,
    rated: omdb[id]?.rated,
    nowPlaying: nowPlaying.has(id) || undefined,
    letterboxdSlug: lb[id]?.slug,
    free: freeServices(id),
    subs: free.films[id]?.subs?.length ? free.films[id].subs : undefined,
    watchLink: free.films[id]?.link,
    links: directLinks(id),
    trailer: playable[id]?.trailer,
    // Only movies the YouTube Data API confirmed can play embedded (trailers.ts).
    ytMovie: playable[id]?.movieCheckedAt ? playable[id].movie : undefined,
    s,
    audience: round(audience),
    critics: round(critics),
    score: round(score),
    spread: ps.length > 1 ? Math.round(Math.max(...ps) - Math.min(...ps)) : null,
    h: h && h.length > 1 ? h : undefined,
  };
});

films.sort((a, b) => (b.s.imdb?.n ?? 0) - (a.s.imdb?.n ?? 0));

/** Free services: JustWatch's list plus anything Tubi or Pluto's own catalogs show. */
function freeServices(id: string) {
  const ids = new Set([...(free.films[id]?.services ?? []), ...Object.keys(serviceLinks[id] ?? {}).map(Number)]);
  return ids.size ? [...ids] : undefined;
}

/**
 * Direct links for the services the film is free on right now. Tubi and
 * Pluto's own catalogs (service-catalogs.ts) win over JustWatch's links,
 * which sometimes point at a dubbed copy.
 */
function directLinks(id: string) {
  // Free services and subscription services (keyed by lib/subscriptions.ts id).
  const services = [...(free.films[id]?.services ?? []), ...(free.films[id]?.subs ?? [])];
  const jw = freeLinks[id]?.links ?? {};
  const out: Record<number, string> = Object.fromEntries(
    services.flatMap((sid) => (jw[sid] && usableLink(jw[sid]) ? [[sid, unwrapAffiliate(jw[sid])]] : [])),
  );
  Object.assign(out, serviceLinks[id]);
  return Object.keys(out).length ? out : undefined;
}

// People
const people: Record<string, Person> = {};
const person = (pid: string) => (people[pid] ??= { id: pid, name: names[pid] ?? pid, directed: [], actedIn: [] });
for (const f of films) {
  (f.directors ?? []).forEach((d) => person(d).directed.push(f.id));
  (f.cast ?? []).forEach((c) => person(c).actedIn.push(f.id));
}

// Insights: how each group of films leans between sources.
function stat(key: string, label: string, group: Film[]): GroupStat {
  const lbDiffs = group.flatMap((f) => (f.s.letterboxd && f.s.imdb ? [f.s.letterboxd.p - f.s.imdb.p] : []));
  const caDiffs = group.flatMap((f) => (f.critics !== null && f.audience !== null ? [f.critics - f.audience] : []));
  const lbVsImdb = mean(lbDiffs);
  const cva = mean(caDiffs);
  const avg = mean(group.flatMap((f) => (f.score !== null ? [f.score] : [])));
  return {
    key,
    label,
    count: group.length,
    lbVsImdb: lbVsImdb === null ? null : Math.round(lbVsImdb * 10) / 10,
    criticsVsAudience: cva === null ? null : Math.round(cva * 10) / 10,
    avgScore: round(avg),
    lbN: lbDiffs.length,
    caN: caDiffs.length,
  };
}
const groupBy = (fn: (f: Film) => string[]) => {
  const m = new Map<string, Film[]>();
  for (const f of films) for (const k of fn(f)) m.set(k, [...(m.get(k) ?? []), f]);
  return m;
};

const genres = [...groupBy((f) => f.genres ?? [])]
  .filter(([, g]) => g.length >= 50)
  .map(([k, g]) => stat(k, k, g));
const decades = [...groupBy((f) => (f.year ? [`${Math.floor(f.year / 10) * 10}`] : []))]
  .filter(([, g]) => g.length >= 30)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([k, g]) => stat(k, `${k}s`, g));
const directors = [...groupBy((f) => f.directors ?? [])]
  .filter(([, g]) => g.length >= 5)
  .map(([k, g]) => stat(k, names[k] ?? k, g));

const insights: Insights = {
  generatedAt: new Date().toISOString(),
  filmCount: films.length,
  sourceCounts: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v.size])),
  genres,
  decades,
  directors,
};

// Free services, biggest catalog first.
const serviceCounts = new Map<number, number>();
for (const f of films) for (const sid of f.free ?? []) serviceCounts.set(sid, (serviceCounts.get(sid) ?? 0) + 1);
const services: FreeService[] = [...serviceCounts]
  .map(([sid, count]) => ({ ...free.services[sid], count }))
  .sort((a, b) => b.count - a.count);

writeJson(join(SITE, "films.json"), films);
writeJson(join(SITE, "free.json"), { updatedAt: free.updatedAt, services }, true);
writeJson(join(SITE, "people.json"), people);
writeJson(join(SITE, "insights.json"), insights, true);
writeJson(historyPath, history);
console.log(
  `Built ${films.length} films, ${Object.keys(people).length} people. Sources:`,
  insights.sourceCounts,
);
