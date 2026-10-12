// Direct "watch" links for every free film: the URL of the film on Tubi,
// Pluto, YouTube and so on, so the site's Watch buttons open the movie itself.
// Also the film's page on the subscription services (lib/subscriptions.ts),
// stored under the service's id whichever plan JustWatch listed.
//
// TMDB's API only gives one link per film (its own where-to-watch page). That
// page carries JustWatch click-out links whose `r` parameter is the service's
// own URL and whose `cx` parameter names the service and how it's offered. We
// read the page once per film, keep the free/ads offers, and cache them.
// Like the Letterboxd scraper it reads a public web page: polite, low
// concurrency, fine for a personal project.
// Usage: node scripts/free-links.ts [--limit 30000] [--concurrency 2]
import { join } from "node:path";
import { SOURCES, arg, isStale, readJson, sleep, usableLink, writeJson } from "./util.ts";
import type { FreeFile } from "./free-catalog.ts";
import type { ImdbFilm } from "./ingest-imdb.ts";
import { SUBSCRIPTION_OF } from "../lib/subscriptions.ts";

export type FreeLinks = Record<string, { links: Record<number, string>; services: number[]; fetchedAt: string }>;

const LIMIT = Number(arg("limit", "30000"));
const CONCURRENCY = Number(arg("concurrency", "1"));
const DELAY_MS = 700;
const REFRESH_DAYS = 30;
const OUT = join(SOURCES, "free-links.json");

const free = readJson<FreeFile>(join(SOURCES, "free.json"), { updatedAt: "", services: {}, films: {}, checked: {} });
const cache = readJson<FreeLinks>(OUT, {});
for (const c of Object.values(cache))
  for (const [sid, url] of Object.entries(c.links)) if (!usableLink(url)) delete c.links[Number(sid)];
const imdb = readJson<Record<string, ImdbFilm>>(join(SOURCES, "imdb.json"), {});

// Only films the site tracks (ingest-imdb.ts), most-voted first so the films
// people actually see get links soonest. Refetch when the film is new, its
// free or subscription services changed, or the links are old.
const sameServices = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));
const wanted = (f: FreeFile["films"][string]) => [...f.services, ...(f.subs ?? [])];
const queue = Object.entries(free.films)
  .filter(([id, f]) => {
    if (!imdb[id]) return false;
    const c = cache[id];
    return !c || !sameServices(c.services, wanted(f)) || isStale(c.fetchedAt, REFRESH_DAYS);
  })
  .sort(([a], [b]) => imdb[b].votes - imdb[a].votes)
  .slice(0, LIMIT);
console.log(`Free links: ${queue.length} films to fetch`);

/** Strip tracking parameters added for JustWatch; keep everything else. */
function clean(url: string) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (k.startsWith("utm_")) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}

async function fetchLinks(tmdbId: number): Promise<Record<number, string>> {
  // A plain bot user agent: TMDB's site rejects "Mozilla/5.0 (compatible; ...)"
  // from non-browsers but lets clearly labeled bots through.
  const res = await fetch(`https://www.themoviedb.org/movie/${tmdbId}/watch?locale=US`, {
    headers: { "user-agent": "moviedata-bot/0.1 (+https://github.com/onebeerjt/moviedata)" },
    redirect: "follow",
  });
  if (res.status === 429) throw Object.assign(new Error("HTTP 429"), { retryAfter: Number(res.headers.get("retry-after")) || 60 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const links: Record<number, string> = {};
  for (const m of html.matchAll(/href="(https:\/\/click\.justwatch\.com\/a\?[^"]+)"/g)) {
    const params = new URL(m[1].replaceAll("&amp;", "&")).searchParams;
    const target = params.get("r");
    const cx = params.get("cx");
    if (!target || !cx) continue;
    try {
      const ctx = JSON.parse(Buffer.from(cx, "base64url").toString("utf8")) as {
        data: { data: { providerId?: number; monetizationType?: string } }[];
      };
      const { providerId, monetizationType } = ctx.data[0]?.data ?? {};
      if (!providerId || !usableLink(target)) continue;
      if (monetizationType === "ads" || monetizationType === "free") links[providerId] ??= clean(target);
      else if (monetizationType === "flatrate" && SUBSCRIPTION_OF[providerId]) links[SUBSCRIPTION_OF[providerId]] ??= clean(target);
    } catch {}
  }
  return links;
}

let done = 0;
let failures = 0;
async function worker() {
  while (queue.length) {
    const [id, f] = queue.shift()!;
    try {
      cache[id] = { links: await fetchLinks(f.tmdbId), services: wanted(f), fetchedAt: new Date().toISOString() };
    } catch (e) {
      const retryAfter = (e as { retryAfter?: number }).retryAfter;
      if (retryAfter) {
        // Rate limited: wait as asked and try the same film again.
        queue.unshift([id, f]);
        console.warn(`  rate limited, waiting ${retryAfter}s`);
        await sleep(retryAfter * 1000);
        continue;
      }
      failures++;
      console.warn(`  ${id}: ${(e as Error).message}`);
      if (failures > 25) {
        console.error("Free links: too many failures, stopping (blocked?)");
        queue.length = 0;
      }
      await sleep(5000);
    }
    if (++done % 200 === 0) {
      writeJson(OUT, cache);
      console.log(`  ${done} done`);
    }
    await sleep(DELAY_MS);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
writeJson(OUT, cache);
const withLinks = Object.values(cache).filter((c) => Object.keys(c.links).length).length;
console.log(`Free links: done (${done} fetched, ${failures} failed; ${withLinks} films have direct links)`);
