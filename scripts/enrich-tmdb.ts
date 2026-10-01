// Posters, overviews, release dates, TMDB user ratings and "now playing" from the TMDB API.
// Needs TMDB_API_KEY (v3 key) or TMDB_READ_TOKEN (v4 bearer token) in .env.local.
// Usage: node scripts/enrich-tmdb.ts [--limit 2000]
import { join } from "node:path";
import { SOURCES, arg, isStale, readJson, sleep, staleAfterDays, writeJson } from "./util.ts";
import type { ImdbFilm } from "./ingest-imdb.ts";

export type TmdbEntry = {
  tmdbId?: number;
  poster?: string;
  backdrop?: string;
  overview?: string;
  releaseDate?: string;
  rating?: number;
  votes?: number;
  fetchedAt: string;
};

const KEY = process.env.TMDB_API_KEY;
const TOKEN = process.env.TMDB_READ_TOKEN;
if (!KEY && !TOKEN) {
  console.log("TMDB: no TMDB_API_KEY / TMDB_READ_TOKEN set, skipping");
  process.exit(0);
}

const LIMIT = Number(arg("limit", "2000"));
const OUT = join(SOURCES, "tmdb.json");
const NOW_PLAYING = join(SOURCES, "now-playing.json");

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (KEY) url.searchParams.set("api_key", KEY);
  const res = await fetch(url, { headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} });
  if (res.status === 429) {
    await sleep(2000);
    return tmdb(path, params);
  }
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

type TmdbMovie = {
  id: number;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
};

function toEntry(m: TmdbMovie): TmdbEntry {
  return {
    tmdbId: m.id,
    poster: m.poster_path ?? undefined,
    backdrop: m.backdrop_path ?? undefined,
    overview: m.overview || undefined,
    releaseDate: m.release_date || undefined,
    rating: m.vote_count ? m.vote_average : undefined,
    votes: m.vote_count,
    fetchedAt: new Date().toISOString(),
  };
}

const imdb = readJson<Record<string, ImdbFilm>>(join(SOURCES, "imdb.json"), {});
const cache = readJson<Record<string, TmdbEntry>>(OUT, {});

// 1. What's in theaters (US) right now.
const nowPlaying: string[] = [];
for (let page = 1; page <= 3; page++) {
  const { results } = await tmdb<{ results: TmdbMovie[] }>("/movie/now_playing", { region: "US", page: String(page) });
  for (const m of results) {
    const { imdb_id } = await tmdb<{ imdb_id: string | null }>(`/movie/${m.id}/external_ids`);
    if (!imdb_id) continue;
    nowPlaying.push(imdb_id);
    cache[imdb_id] = toEntry(m);
  }
}
writeJson(NOW_PLAYING, { updatedAt: new Date().toISOString(), ids: nowPlaying }, true);
console.log(`TMDB: ${nowPlaying.length} films now playing`);

// 2. Everything else we track, stale-first.
const queue = Object.entries(imdb)
  .filter(([id, f]) => isStale(cache[id]?.fetchedAt, staleAfterDays(f.year, cache[id]?.releaseDate)))
  .sort(([, a], [, b]) => b.votes - a.votes)
  .slice(0, LIMIT);

let n = 0;
for (const [id] of queue) {
  try {
    const { movie_results } = await tmdb<{ movie_results: TmdbMovie[] }>(`/find/${id}`, { external_source: "imdb_id" });
    cache[id] = movie_results[0] ? toEntry(movie_results[0]) : { fetchedAt: new Date().toISOString() };
  } catch (e) {
    console.warn(`  ${id}: ${(e as Error).message}`);
  }
  if (++n % 200 === 0) {
    writeJson(OUT, cache);
    console.log(`  ${n}/${queue.length}`);
  }
  await sleep(30);
}
writeJson(OUT, cache);
console.log(`TMDB: done (${n} refreshed)`);
