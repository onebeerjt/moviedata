// Which films stream free (with ads, or free with a library card) in the US,
// and on which services. Source: TMDB's watch-provider data, which comes from
// JustWatch (the site must credit JustWatch wherever it shows this).
//
// 1. Discover every film TMDB lists as free/ads in the US. The discover
//    filter can't say *which* service is free, so this is just the candidate list.
// 2. For each candidate, fetch its details + watch providers in one call and
//    keep only the services listed under "ads" or "free".
// Films land in free.json keyed by IMDb id; ingest-imdb.ts adds them to the
// tracked set so they get scored like everything else.
// Usage: node scripts/free-catalog.ts [--min-votes 20] [--refresh-days 3]
import { join } from "node:path";
import { SOURCES, arg, isStale, readJson, sleep, writeJson } from "./util.ts";
import type { TmdbEntry } from "./enrich-tmdb.ts";

export type FreeService = { id: number; name: string; logo?: string; library?: boolean };
export type FreeEntry = { tmdbId: number; services: number[]; link?: string; checkedAt: string };
export type FreeFile = {
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
const OUT = join(SOURCES, "free.json");
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
  "watch/providers"?: { results: { US?: { link?: string; ads?: Provider[]; free?: Provider[] } } };
};

const prev = readJson<FreeFile>(OUT, { updatedAt: "", services: {}, films: {}, checked: {} });
const tmdbCache = readJson<Record<string, TmdbEntry>>(TMDB_OUT, {});

// 1. Candidates. Discover stops at page 500, so walk it in year bands narrow
// enough to stay under that.
const candidates = new Set<number>();
async function sweep(from: string, to: string) {
  const base = {
    watch_region: "US",
    with_watch_monetization_types: "free|ads",
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
      await sweep(from, mid);
      await sweep(next, to);
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
for (const [from, to] of bands) await sweep(from, to);
console.log(`Free catalog: ${candidates.size} candidate films`);

// 2. Details + providers for new candidates and ones not checked recently.
const services: FreeFile["services"] = { ...prev.services };
const films: FreeFile["films"] = {};
const checked: FreeFile["checked"] = {};
const byTmdb = new Map(Object.entries(prev.films).map(([imdbId, f]) => [f.tmdbId, imdbId]));

let n = 0;
let fetched = 0;
for (const id of candidates) {
  const last = prev.checked[id];
  if (!isStale(last, REFRESH_DAYS)) {
    // Recently checked: carry it over as-is.
    checked[id] = last;
    const imdbId = byTmdb.get(id);
    if (imdbId) films[imdbId] = prev.films[imdbId];
    continue;
  }
  try {
    const d = await tmdb<Details>(`/movie/${id}`, { append_to_response: "watch/providers" });
    const now = new Date().toISOString();
    checked[id] = now;
    fetched++;
    const us = d["watch/providers"]?.results.US;
    const free = [...(us?.ads ?? []), ...(us?.free ?? [])];
    if (d.imdb_id && free.length) {
      for (const p of free)
        services[p.provider_id] ??= {
          id: p.provider_id,
          name: p.provider_name.trim(),
          logo: p.logo_path,
          library: LIBRARY.has(p.provider_name.trim()) || undefined,
        };
      films[d.imdb_id] = { tmdbId: d.id, services: [...new Set(free.map((p) => p.provider_id))], link: us?.link, checkedAt: now };
      // We already have everything enrich-tmdb would fetch, so save it a call.
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
  await sleep(20);
}

writeJson(OUT, { updatedAt: new Date().toISOString(), services, films, checked } satisfies FreeFile);
writeJson(TMDB_OUT, tmdbCache);
console.log(`Free catalog: ${Object.keys(films).length} free films (${fetched} fetched fresh)`);
