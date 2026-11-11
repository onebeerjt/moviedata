// Which films stream free (with ads, or free with a library card) in the US,
// and which are on the subscription services people can add on the Free page
// (lib/subscriptions.ts). Source: TMDB's watch-provider data, which comes from
// JustWatch (the site must credit JustWatch wherever it shows this).
//
// 1. Discover every film TMDB lists as free/ads in the US, plus each
//    subscription service's catalog. The discover filters can't say *which*
//    service offers what, so this is just the candidate list.
// 2. For each candidate, fetch its details + watch providers in one call and
//    keep the services listed under "ads"/"free", and the subscription
//    services listed under "flatrate".
// Films land in free.json keyed by IMDb id; ingest-imdb.ts adds them to the
// tracked set so they get scored like everything else.
// Usage: node scripts/free-catalog.ts [--min-votes 20] [--refresh-days 3] [--max-details 4000] [--budget minutes]
import { join } from "node:path";
import { SOURCES, arg, isStale, outOfTime, readJson, sleep, writeJson } from "./util.ts";
import type { TmdbEntry } from "./enrich-tmdb.ts";
import { SUBSCRIPTIONS, SUBSCRIPTION_OF } from "../lib/subscriptions.ts";

export type FreeService = { id: number; name: string; logo?: string; library?: boolean };
export type FreeEntry = {
  tmdbId: number;
  /** Free (ads or library card) services. */
  services: number[];
  /** Subscription services (lib/subscriptions.ts ids). */
  subs?: number[];
  link?: string;
  checkedAt: string;
};
export type FreeFile = {
  /** Bumped when what's recorded per film changes, forcing a full re-check. */
  version?: number;
  updatedAt: string;
  services: Record<number, FreeService>;
  films: Record<string, FreeEntry>;
  /** tmdbId -> details last fetched (also for films without an IMDb id). */
  checked: Record<number, string>;
};

const KEY = process.env.TMDB_API_KEY;
const TOKEN = process.env.TMDB_READ_TOKEN;
if (!KEY && !TOKEN) {
  console.log("Free catalog: no TMDB key set, skipping");
  process.exit(0);
}

const MIN_VOTES = arg("min-votes", "20")!;
const REFRESH_DAYS = Number(arg("refresh-days", "3"));
// Most film details fetched per run (~0.15 s each). With the default, the whole catalog rolls over about every 9 days.
const MAX_DETAILS = Number(arg("max-details", "4000"));
const OUT = join(SOURCES, "free.json");
const VERSION = 2; // 2: subscription services recorded too
const TMDB_OUT = join(SOURCES, "tmdb.json");
// Free with a library card rather than with ads. Labeled as such on the site.
const LIBRARY = new Set(["Kanopy", "Hoopla"]);

async function tmdb<T>(path: string, params: Record<string, string> = {}, tries = 0): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (KEY) url.searchParams.set("api_key", KEY);
  try {
    const res = await fetch(url, { headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} });
    if (res.status === 429 || res.status >= 500) throw new Error(String(res.status));
    if (!res.ok) throw Object.assign(new Error(`${path} -> ${res.status}`), { fatal: true });
    return (await res.json()) as T;
  } catch (e) {
    if ((e as { fatal?: boolean }).fatal || tries >= 5) throw e;
    await sleep(1000 * 2 ** tries);
    return tmdb(path, params, tries + 1);
  }
}

type Provider = { provider_id: number; provider_name: string; logo_path?: string };
type Details = {
  id: number;
  imdb_id: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  "watch/providers"?: { results: { US?: { link?: string; ads?: Provider[]; free?: Provider[]; flatrate?: Provider[] } } };
};

const stored = readJson<FreeFile>(OUT, { updatedAt: "", services: {}, films: {}, checked: {} });
// An older file didn't record subscriptions: keep its service names but check every film again.
const prev: FreeFile = stored.version === VERSION ? stored : { ...stored, films: {}, checked: {} };
const tmdbCache = readJson<Record<string, TmdbEntry>>(TMDB_OUT, {});

// 1. Candidates. Discover stops at page 500, so walk it in year bands narrow
// enough to stay under that.
const candidates = new Set<number>();
async function sweep(from: string, to: string, filter: Record<string, string>) {
  const base = {
    watch_region: "US",
    ...filter,
    "vote_count.gte": MIN_VOTES,
    "primary_release_date.gte": from,
    "primary_release_date.lte": to,
    sort_by: "popularity.desc",
  };
  const first = await tmdb<{ total_pages: number; results: { id: number }[] }>("/discover/movie", { ...base, page: "1" });
  if (first.total_pages > 500) {
    // Split the band in half and try again.
    const a = new Date(from).getTime();
    const b = new Date(to).getTime();
    if (b - a > 864e5) {
      const mid = new Date((a + b) / 2).toISOString().slice(0, 10);
      const next = new Date(new Date(mid).getTime() + 864e5).toISOString().slice(0, 10);
      await sweep(from, mid, filter);
      await sweep(next, to, filter);
      return;
    }
  }
  first.results.forEach((m) => candidates.add(m.id));
  for (let page = 2; page <= Math.min(first.total_pages, 500); page++) {
    const { results } = await tmdb<{ results: { id: number }[] }>("/discover/movie", { ...base, page: String(page) });
    results.forEach((m) => candidates.add(m.id));
  }
}
const thisYear = new Date().getFullYear();
const bands: [string, string][] = [["1880-01-01", "1949-12-31"]];
for (let y = 1950; y <= thisYear; y += 10) bands.push([`${y}-01-01`, `${Math.min(y + 9, thisYear + 1)}-12-31`]);
for (const [from, to] of bands) await sweep(from, to, { with_watch_monetization_types: "free|ads" });
const freeCount = candidates.size;
for (const sub of SUBSCRIPTIONS)
  for (const [from, to] of bands)
    await sweep(from, to, { with_watch_monetization_types: "flatrate", with_watch_providers: sub.providerIds.join("|") });
console.log(`Free catalog: ${candidates.size} candidate films (${freeCount} free, the rest on subscriptions)`);

// 2. Details + providers for new candidates and ones not checked recently.
const services: FreeFile["services"] = { ...prev.services };
const films: FreeFile["films"] = {};
const checked: FreeFile["checked"] = {};
const byTmdb = new Map(Object.entries(prev.films).map(([imdbId, f]) => [f.tmdbId, imdbId]));

// Start from what we already knew; fetching below overwrites it. A film we don't
// get to this run keeps its last answer instead of vanishing from the site.
for (const id of candidates) {
  const last = prev.checked[id];
  if (!last) continue;
  checked[id] = last;
  const imdbId = byTmdb.get(id);
  if (imdbId) films[imdbId] = prev.films[imdbId];
}

// A bounded bite per run: never-checked films first, then the longest-unchecked.
// (An unbounded "everything older than 3 days" queue is what once put all 35k films
// due on the same morning, ~2 hours of requests that were only saved at the very end.)
const due = [...candidates]
  .filter((id) => isStale(prev.checked[id], REFRESH_DAYS))
  .sort((a, b) => (prev.checked[a] ?? "").localeCompare(prev.checked[b] ?? ""));
const queue = due.slice(0, MAX_DETAILS);
console.log(`Free catalog: ${due.length} films due a re-check, taking ${queue.length} this run`);

function save() {
  writeJson(OUT, { version: VERSION, updatedAt: new Date().toISOString(), services, films, checked } satisfies FreeFile);
  writeJson(TMDB_OUT, tmdbCache);
}

let n = 0;
let fetched = 0;
for (const id of queue) {
  if (outOfTime()) {
    console.log(`Free catalog: time budget used up after ${fetched} films; the rest wait for the next run`);
    break;
  }
  try {
    const d = await tmdb<Details>(`/movie/${id}`, { append_to_response: "watch/providers" });
    const now = new Date().toISOString();
    checked[id] = now;
    fetched++;
    const was = byTmdb.get(id);
    if (was) delete films[was];
    const us = d["watch/providers"]?.results.US;
    const free = [...(us?.ads ?? []), ...(us?.free ?? [])];
    const subs = [...new Set((us?.flatrate ?? []).flatMap((p) => (SUBSCRIPTION_OF[p.provider_id] ? [SUBSCRIPTION_OF[p.provider_id]] : [])))];
    if (d.imdb_id && (free.length || subs.length)) {
      for (const p of free)
        services[p.provider_id] ??= {
          id: p.provider_id,
          name: p.provider_name.trim(),
          logo: p.logo_path,
          library: LIBRARY.has(p.provider_name.trim()) || undefined,
        };
      films[d.imdb_id] = {
        tmdbId: d.id,
        services: [...new Set(free.map((p) => p.provider_id))],
        subs,
        link: us?.link,
        checkedAt: now,
      };
      if (!tmdbCache[d.imdb_id]?.tmdbId)
        tmdbCache[d.imdb_id] = {
          tmdbId: d.id,
          poster: d.poster_path ?? undefined,
          backdrop: d.backdrop_path ?? undefined,
          overview: d.overview || undefined,
          releaseDate: d.release_date || undefined,
          rating: d.vote_count ? d.vote_average : undefined,
          votes: d.vote_count,
          fetchedAt: now,
        };
    }
  } catch (e) {
    console.warn(`  ${id}: ${(e as Error).message}`);
  }
  if (++n % 500 === 0) console.log(`  ${n} checked`);
  if (n % 1500 === 0) save();
  await sleep(20);
}

save();
const all = Object.values(films);
console.log(
  `Free catalog: ${all.filter((f) => f.services.length).length} free films, ${all.filter((f) => f.subs?.length).length} on subscriptions (${fetched} fetched fresh)`,
);
