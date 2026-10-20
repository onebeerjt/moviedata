// Rotten Tomatoes (Tomatometer), Metacritic and the MPA rating via the OMDb API.
// Needs OMDB_API_KEY in .env.local. Free keys allow 1,000 requests/day, so the
// default limit stays under that. Films never queried come first (most IMDb votes
// first); stale refreshes (newest films first) only get the budget left over.
// Usage: node scripts/enrich-omdb.ts [--limit 900]
import { join } from "node:path";
import { SOURCES, arg, isStale, readJson, sleep, staleAfterDays, writeJson } from "./util.ts";
import type { ImdbFilm } from "./ingest-imdb.ts";

export type OmdbEntry = {
  rt?: number;
  metacritic?: number;
  rated?: string;
  fetchedAt: string;
};

const KEY = process.env.OMDB_API_KEY;
if (!KEY) {
  console.log("OMDb: no OMDB_API_KEY set, skipping");
  process.exit(0);
}

const LIMIT = Number(arg("limit", "900"));
const OUT = join(SOURCES, "omdb.json");
const imdb = readJson<Record<string, ImdbFilm>>(join(SOURCES, "imdb.json"), {});
const cache = readJson<Record<string, OmdbEntry>>(OUT, {});

const stale = Object.entries(imdb).filter(([id, f]) => isStale(cache[id]?.fetchedAt, staleAfterDays(f.year)));
const fresh = stale.filter(([id]) => !cache[id]).sort(([, a], [, b]) => b.votes - a.votes);
const refresh = stale
  .filter(([id]) => cache[id])
  .sort(([, a], [, b]) => staleAfterDays(a.year) - staleAfterDays(b.year) || b.votes - a.votes);
const queue = [...fresh, ...refresh].slice(0, LIMIT);
const newCount = Math.min(fresh.length, LIMIT);

console.log(
  `OMDb: ${fresh.length} never-fetched films waiting, ${refresh.length} stale; queued ${newCount} new + ${queue.length - newCount} refresh`,
);
if (fresh.length) console.log(`OMDb: never-fetched films go first, so newly ingested films get their first query within ${Math.ceil(fresh.length / LIMIT)} day(s)`);
let n = 0;
let nNew = 0;
for (const [id] of queue) {
  const isNew = !cache[id];
  const res = await fetch(`https://www.omdbapi.com/?i=${id}&apikey=${KEY}`);
  const data = (await res.json()) as {
    Response: string;
    Error?: string;
    Rated?: string;
    Ratings?: { Source: string; Value: string }[];
  };
  if (data.Error?.includes("limit")) {
    console.log("OMDb: daily limit reached");
    break;
  }
  const rt = data.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value;
  const mc = data.Ratings?.find((r) => r.Source === "Metacritic")?.Value;
  cache[id] = {
    rt: rt ? parseInt(rt) : undefined,
    metacritic: mc ? parseInt(mc) : undefined,
    rated: data.Rated && data.Rated !== "N/A" ? data.Rated : undefined,
    fetchedAt: new Date().toISOString(),
  };
  if (isNew) nNew++;
  if (++n % 100 === 0) {
    writeJson(OUT, cache);
    console.log(`  ${n}/${queue.length}`);
  }
  await sleep(50);
}
writeJson(OUT, cache);
console.log(`OMDb: done (${nNew} new, ${n - nNew} refreshed)`);
