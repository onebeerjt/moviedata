// Reads Letterboxd's public film pages (via the /imdb/<id>/ redirect) for the
// average rating, rating count and TMDB id. Polite: low concurrency, a delay
// between requests, and refresh cadence based on how recent the film is.
// Usage: node scripts/scrape-letterboxd.ts [--limit 500] [--concurrency 2]
import { join } from "node:path";
import { SOURCES, arg, isStale, readJson, sleep, staleAfterDays, writeJson } from "./util.ts";
import type { ImdbFilm } from "./ingest-imdb.ts";

export type LetterboxdEntry = {
  slug?: string;
  rating?: number;
  count?: number;
  tmdbId?: number;
  fetchedAt: string;
  missing?: boolean;
};

const LIMIT = Number(arg("limit", "500"));
const CONCURRENCY = Number(arg("concurrency", "2"));
const DELAY_MS = 700;
const OUT = join(SOURCES, "letterboxd.json");

const imdb = readJson<Record<string, ImdbFilm>>(join(SOURCES, "imdb.json"), {});
const cache = readJson<Record<string, LetterboxdEntry>>(OUT, {});

// Newest films first (they move daily), then by popularity.
const queue = Object.entries(imdb)
  .filter(([id, f]) => isStale(cache[id]?.fetchedAt, cache[id]?.missing ? 60 : staleAfterDays(f.year)))
  .sort(([, a], [, b]) => staleAfterDays(a.year) - staleAfterDays(b.year) || b.votes - a.votes)
  .slice(0, LIMIT)
  .map(([id]) => id);

console.log(`Letterboxd: ${queue.length} films to refresh`);

async function fetchOne(id: string): Promise<LetterboxdEntry> {
  const res = await fetch(`https://letterboxd.com/imdb/${id}/`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; moviedata-bot/0.1; +https://github.com/onebeerjt/moviedata)" },
    redirect: "follow",
  });
  const fetchedAt = new Date().toISOString();
  if (res.status === 404) return { fetchedAt, missing: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const slug = res.url.match(/\/film\/([^/]+)\//)?.[1];
  const rating = html.match(/"ratingValue":([0-9.]+)/)?.[1];
  const count = html.match(/"ratingCount":([0-9]+)/)?.[1];
  const tmdbId = html.match(/data-tmdb-id="([0-9]+)"/)?.[1];
  return {
    slug,
    rating: rating ? Number(rating) : undefined,
    count: count ? Number(count) : undefined,
    tmdbId: tmdbId ? Number(tmdbId) : undefined,
    fetchedAt,
  };
}

let done = 0;
let failures = 0;
async function worker() {
  while (queue.length) {
    const id = queue.shift()!;
    try {
      cache[id] = await fetchOne(id);
    } catch (e) {
      failures++;
      console.warn(`  ${id}: ${(e as Error).message}`);
      if (failures > 25) {
        console.error("Letterboxd: too many failures, stopping (blocked?)");
        queue.length = 0;
      }
      await sleep(5000);
    }
    if (++done % 50 === 0) {
      writeJson(OUT, cache);
      console.log(`  ${done} done`);
    }
    await sleep(DELAY_MS);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
writeJson(OUT, cache);
console.log(`Letterboxd: done (${done} fetched, ${failures} failed)`);
