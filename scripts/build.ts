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
import { SITE, SOURCES, readJson, writeJson } from "./util.ts";
import type { ImdbFilm } from "./ingest-imdb.ts";
import type { LetterboxdEntry } from "./scrape-letterboxd.ts";
import type { TmdbEntry } from "./enrich-tmdb.ts";
import type { OmdbEntry } from "./enrich-omdb.ts";
import type { Film, GroupStat, Insights, Person, SourceKey } from "../lib/types.ts";

const imdb = readJson<Record<string, ImdbFilm>>(join(SOURCES, "imdb.json"), {});
const names = readJson<Record<string, string>>(join(SOURCES, "imdb-people.json"), {});
const lb = readJson<Record<string, LetterboxdEntry>>(join(SOURCES, "letterboxd.json"), {});
const tmdb = readJson<Record<string, TmdbEntry>>(join(SOURCES, "tmdb.json"), {});
const omdb = readJson<Record<string, OmdbEntry>>(join(SOURCES, "omdb.json"), {});
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

/** Percentile (0–100) of every film within one source, after vote-count shrinkage. */
function percentiles(values: Map<string, Raw>): Map<string, number> {
  const entries = [...values];
  if (!entries.length) return new Map();
  const mean = entries.reduce((s, [, r]) => s + r.v, 0) / entries.length;
  const counts = entries.map(([, r]) => r.n).filter((n): n is number => n !== undefined).sort((a, b) => a - b);
  // Prior strength = the 25th-percentile vote count on this source. Strong enough
  // that a few thousand enthusiastic early votes can't push a film to the top.
  const m = counts.length ? counts[Math.floor(counts.length * 0.25)] : 0;
  const adjusted = entries
    .map(([id, r]) => [id, r.n === undefined || !m ? r.v : (r.n * r.v + m * mean) / (r.n + m)] as const)
    .sort((a, b) => a[1] - b[1]);
  const out = new Map<string, number>();
  // Ties share the midpoint rank so identical scores get identical percentiles.
  for (let i = 0; i < adjusted.length; ) {
    let j = i;
    while (j + 1 < adjusted.length && adjusted[j + 1][1] === adjusted[i][1]) j++;
    const pct = adjusted.length === 1 ? 50 : (((i + j) / 2) / (adjusted.length - 1)) * 100;
    for (let k = i; k <= j; k++) out.set(adjusted[k][0], Math.round(pct * 10) / 10);
    i = j + 1;
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
  const score = audience !== null && critics !== null ? (audience + critics) / 2 : (audience ?? critics);
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
    s,
    audience: round(audience),
    critics: round(critics),
    score: round(score),
    spread: ps.length > 1 ? Math.round(Math.max(...ps) - Math.min(...ps)) : null,
    h: h && h.length > 1 ? h : undefined,
  };
});

films.sort((a, b) => (b.s.imdb?.n ?? 0) - (a.s.imdb?.n ?? 0));

// People
const people: Record<string, Person> = {};
const person = (pid: string) => (people[pid] ??= { id: pid, name: names[pid] ?? pid, directed: [], actedIn: [] });
for (const f of films) {
  f.directors.forEach((d) => person(d).directed.push(f.id));
  f.cast.forEach((c) => person(c).actedIn.push(f.id));
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

const genres = [...groupBy((f) => f.genres)]
  .filter(([, g]) => g.length >= 50)
  .map(([k, g]) => stat(k, k, g));
const decades = [...groupBy((f) => (f.year ? [`${Math.floor(f.year / 10) * 10}`] : []))]
  .filter(([, g]) => g.length >= 30)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([k, g]) => stat(k, `${k}s`, g));
const directors = [...groupBy((f) => f.directors)]
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

writeJson(join(SITE, "films.json"), films);
writeJson(join(SITE, "people.json"), people);
writeJson(join(SITE, "insights.json"), insights, true);
writeJson(historyPath, history);
console.log(
  `Built ${films.length} films, ${Object.keys(people).length} people. Sources:`,
  insights.sourceCounts,
);
