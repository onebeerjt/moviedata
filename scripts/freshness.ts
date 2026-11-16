// Writes data/site/meta.json: when each source was last refreshed, read from the
// per-film `fetchedAt` stamps in data/sources. The site shows these as "as of" stamps.
// Runs at the end of `npm run data:build`, and can be run alone.
import { join } from "node:path";
import { SITE, SOURCES, readJson, writeJson } from "./util.ts";

type Stamped = Record<string, { fetchedAt?: string }>;
const newest = (m: Stamped) => Object.values(m).reduce((best, x) => (x.fetchedAt && x.fetchedAt > best ? x.fetchedAt : best), "");
const stamps = (file: string) => {
  const m = readJson<Stamped>(join(SOURCES, file), {});
  return { updatedAt: newest(m) || null, count: Object.keys(m).length };
};

const insights = readJson<{ generatedAt?: string }>(join(SITE, "insights.json"), {});
const meta = {
  // When films.json was assembled: every score on the site is as of this moment.
  builtAt: insights.generatedAt ?? new Date().toISOString(),
  sources: {
    letterboxd: stamps("letterboxd.json"),
    omdb: stamps("omdb.json"), // Rotten Tomatoes + Metacritic
    tmdb: stamps("tmdb.json"),
    trailers: stamps("trailers.json"),
    "free-links": stamps("free-links.json"),
  },
  theatersAt: readJson<{ updatedAt?: string }>(join(SOURCES, "now-playing.json"), {}).updatedAt ?? null,
  streamingAt: readJson<{ updatedAt?: string }>(join(SOURCES, "free.json"), {}).updatedAt ?? null,
};
writeJson(join(SITE, "meta.json"), meta, true);
console.log("freshness:", meta.builtAt, "theaters", meta.theatersAt);
