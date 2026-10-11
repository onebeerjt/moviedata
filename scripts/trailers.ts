// What can play inside the site, for free films:
// - the official trailer (TMDB's videos list, hosted on YouTube), and
// - the full movie when it's free on YouTube itself.
// Tubi, Pluto and the rest don't allow embedding, so those stay outbound links.
//
// Playability checks:
// - Trailers: YouTube's oEmbed endpoint refuses videos whose owner turned
//   embedding off. Trailers are almost never age-restricted.
// - Full movies: most of YouTube's free movies are age-restricted, and
//   age-restricted videos can't play outside youtube.com. oEmbed doesn't say
//   so; the YouTube Data API does. With YOUTUBE_API_KEY set, every movie (and
//   trailer) is checked there, 50 per request. Without it, no full movies are
//   offered, so the site never shows a player that can't play.
// Usage: node scripts/trailers.ts [--limit 40000]
import { join } from "node:path";
import { SOURCES, arg, isStale, readJson, sleep, writeJson } from "./util.ts";
import type { TmdbEntry } from "./enrich-tmdb.ts";
import type { FreeLinks } from "./free-links.ts";
import type { FreeFile } from "./free-catalog.ts";
import type { ImdbFilm } from "./ingest-imdb.ts";

export type Playable = {
  trailer?: string;
  /** Full movie on YouTube, only once the Data API confirmed it can play embedded. */
  movie?: string;
  /** Last YouTube movie id verified with the Data API, and when. */
  movieChecked?: string;
  movieCheckedAt?: string;
  fetchedAt: string;
};

const KEY = process.env.TMDB_API_KEY;
const TOKEN = process.env.TMDB_READ_TOKEN;
const YT_KEY = process.env.YOUTUBE_API_KEY;
if (!KEY && !TOKEN) {
  console.log("Trailers: no TMDB key set, skipping");
  process.exit(0);
}

const LIMIT = Number(arg("limit", "40000"));
const REFRESH_DAYS = 60;
const MOVIE_RECHECK_DAYS = 7;
const YOUTUBE_FREE = 235;
const OUT = join(SOURCES, "trailers.json");

const free = readJson<FreeFile>(join(SOURCES, "free.json"), { updatedAt: "", services: {}, films: {}, checked: {} });
const tmdb = readJson<Record<string, TmdbEntry>>(join(SOURCES, "tmdb.json"), {});
const links = readJson<FreeLinks>(join(SOURCES, "free-links.json"), {});
const imdb = readJson<Record<string, ImdbFilm>>(join(SOURCES, "imdb.json"), {});
const cache = readJson<Record<string, Playable>>(OUT, {});

type Video = { key: string; site: string; type: string; official: boolean; iso_639_1: string; name: string };

async function videos(tmdbId: number): Promise<Video[]> {
  const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}/videos`);
  if (KEY) url.searchParams.set("api_key", KEY);
  for (let tries = 0; ; tries++) {
    const res = await fetch(url, { headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} });
    if (res.ok) return ((await res.json()) as { results: Video[] }).results;
    if (tries >= 4 || (res.status !== 429 && res.status < 500)) throw new Error(`videos ${tmdbId} -> ${res.status}`);
    await sleep(1000 * 2 ** tries);
  }
}

/** Official English trailer first, then any trailer, then a teaser. */
function bestTrailer(vs: Video[]) {
  const score = (v: Video) =>
    (v.type === "Trailer" ? 100 : v.type === "Teaser" ? 50 : 0) +
    (v.official ? 20 : 0) +
    (v.iso_639_1 === "en" ? 10 : 0) +
    (/official trailer/i.test(v.name) ? 5 : 0);
  return vs
    .filter((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"))
    .sort((a, b) => score(b) - score(a))[0]?.key;
}

/** oEmbed: yes only for videos that exist and allow embedding. */
async function oembedOk(videoId: string) {
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${videoId}`);
  return res.ok;
}

/** Data API: which of these videos can play embedded in the US without sign-in. */
async function playableEmbedded(ids: string[]): Promise<Set<string>> {
  const ok = new Set<string>();
  for (let i = 0; i < ids.length; i += 50) {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "status,contentDetails");
    url.searchParams.set("id", ids.slice(i, i + 50).join(","));
    url.searchParams.set("key", YT_KEY!);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube Data API -> ${res.status}`);
    const { items } = (await res.json()) as {
      items: {
        id: string;
        status: { embeddable: boolean; privacyStatus: string };
        contentDetails: { contentRating?: { ytRating?: string }; regionRestriction?: { allowed?: string[]; blocked?: string[] } };
      }[];
    };
    for (const v of items) {
      const region = v.contentDetails.regionRestriction;
      const inUS = !region || (region.allowed ? region.allowed.includes("US") : !region.blocked?.includes("US"));
      const ageRestricted = v.contentDetails.contentRating?.ytRating === "ytAgeRestricted";
      if (v.status.embeddable && v.status.privacyStatus === "public" && inUS && !ageRestricted) ok.add(v.id);
    }
    await sleep(100);
  }
  return ok;
}

const youtubeId = (url?: string) => url?.match(/[?&]v=([\w-]{11})/)?.[1];
const ytMovie = (id: string) => youtubeId(links[id]?.links[YOUTUBE_FREE]);

// 1. Trailers. Tracked films only, most-voted first.
const queue = Object.keys(free.films)
  .filter((id) => imdb[id] && tmdb[id]?.tmdbId && isStale(cache[id]?.fetchedAt, REFRESH_DAYS))
  .sort((a, b) => imdb[b].votes - imdb[a].votes)
  .slice(0, LIMIT);
console.log(`Trailers: ${queue.length} films to check`);

let done = 0;
async function worker() {
  while (queue.length) {
    const id = queue.shift()!;
    try {
      const trailer = bestTrailer(await videos(tmdb[id].tmdbId!));
      cache[id] = { ...cache[id], trailer: trailer && (await oembedOk(trailer)) ? trailer : undefined, fetchedAt: new Date().toISOString() };
    } catch (e) {
      console.warn(`  ${id}: ${(e as Error).message}`);
    }
    if (++done % 500 === 0) {
      writeJson(OUT, cache);
      console.log(`  ${done} done`);
    }
    await sleep(60);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

// 2. Full movies on YouTube, verified with the Data API (and trailers re-verified).
if (!YT_KEY) {
  for (const p of Object.values(cache)) delete p.movie;
  console.log("Trailers: no YOUTUBE_API_KEY, so no full movies are offered (most are age-restricted)");
} else {
  const due = Object.keys(cache).filter((id) => {
    const m = ytMovie(id);
    return m && (m !== cache[id].movieChecked || isStale(cache[id].movieCheckedAt, MOVIE_RECHECK_DAYS));
  });
  try {
    const ok = await playableEmbedded(due.map((id) => ytMovie(id)!));
    const now = new Date().toISOString();
    for (const id of due) {
      const m = ytMovie(id)!;
      cache[id] = { ...cache[id], movie: ok.has(m) ? m : undefined, movieChecked: m, movieCheckedAt: now };
    }
    // Films that lost their YouTube link lose the movie too.
    for (const [id, p] of Object.entries(cache)) if (p.movie && p.movie !== ytMovie(id)) delete p.movie;
    const trailers = Object.values(cache).flatMap((p) => (p.trailer ? [p.trailer] : []));
    const okTrailers = await playableEmbedded(trailers);
    for (const p of Object.values(cache)) if (p.trailer && !okTrailers.has(p.trailer)) delete p.trailer;
    console.log(`Trailers: checked ${due.length} YouTube movies, ${[...ok].length} play embedded`);
  } catch (e) {
    console.warn(`Trailers: ${(e as Error).message}; keeping previous movie checks`);
  }
}

writeJson(OUT, cache);
const all = Object.values(cache);
console.log(`Trailers: done. ${all.filter((p) => p.trailer).length} trailers, ${all.filter((p) => p.movie).length} full movies`);
