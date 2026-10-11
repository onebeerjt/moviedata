// Direct links straight from Tubi and Pluto TV's own catalogs: a second source
// alongside free-links.ts (which is rate limited by TMDB's site).
//
// - Tubi publishes every movie in its sitemaps (title, page URL, runtime).
// - Pluto's web app loads its on-demand catalog from a public endpoint after
//   an anonymous session; one request returns every movie (title, slug, runtime).
//
// Each title is matched to a film we track by normalized title, then
// confirmed by runtime and/or year. Only unambiguous matches are kept, so a
// remake or a same-named film never gets the wrong link.
// Usage: node scripts/service-catalogs.ts
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { SOURCES, readJson, sleep, writeJson } from "./util.ts";
import type { ImdbFilm } from "./ingest-imdb.ts";

export const TUBI = 73;
export const PLUTO = 300;
/** imdbId -> { serviceId: url } */
export type ServiceLinks = { updatedAt: string; links: Record<string, Record<number, string>> };

const UA = "moviedata-bot/0.1 (+https://github.com/onebeerjt/moviedata)";
const OUT = join(SOURCES, "service-links.json");
const imdb = readJson<Record<string, ImdbFilm>>(join(SOURCES, "imdb.json"), {});

/** "The Thing (1982)" and "Thing, The" both become "thing". */
export function normTitle(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*\((19|20)\d\d\)\s*$/, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/^(the|a|an) /, "")
    .replace(/ (the|a|an)$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const byTitle = new Map<string, [string, ImdbFilm][]>();
for (const entry of Object.entries(imdb)) {
  const key = normTitle(entry[1].title);
  byTitle.set(key, [...(byTitle.get(key) ?? []), entry]);
}

type Item = { title: string; url: string; minutes?: number; year?: number };

/** The one film this catalog item is, or nothing if it isn't clear. */
function match(item: Item): string | null {
  const candidates = byTitle.get(normTitle(item.title)) ?? [];
  const fits = candidates.filter(([, f]) => {
    const runtimeOk = item.minutes && f.runtime ? Math.abs(item.minutes - f.runtime) <= 6 : null;
    const yearOk = item.year && f.year ? Math.abs(item.year - f.year) <= 1 : null;
    if (runtimeOk === false || yearOk === false) return false;
    // Need at least one positive check, unless the title is unique to one film.
    return runtimeOk || yearOk || candidates.length === 1;
  });
  return fits.length === 1 ? fits[0][0] : null;
}

async function get(url: string, headers: Record<string, string> = {}) {
  for (let tries = 0; ; tries++) {
    const res = await fetch(url, { headers: { "user-agent": UA, ...headers } });
    if (res.ok) return res;
    if (tries >= 3) throw new Error(`${url} -> ${res.status}`);
    await sleep(2000 * 2 ** tries);
  }
}

async function tubi(): Promise<Item[]> {
  const index = await (await get("https://tubitv.com/sitemap.xml")).text();
  const files = [...index.matchAll(/<loc>(https:\/\/tubitv\.com\/sitemaps\/movies-\d+\.xml)<\/loc>/g)].map((m) => m[1]);
  const items: Item[] = [];
  for (const file of files) {
    const xml = await (await get(file)).text();
    for (const block of xml.split("<url>").slice(1)) {
      const url = block.match(/<loc>(https:\/\/tubitv\.com\/movies\/[^<]+)<\/loc>/)?.[1];
      const title = block.match(/<video:title><!\[CDATA\[([\s\S]*?)\]\]><\/video:title>/)?.[1];
      const seconds = Number(block.match(/<video:duration>(\d+)<\/video:duration>/)?.[1]);
      if (url && title) items.push({ title, url, minutes: seconds ? Math.round(seconds / 60) : undefined });
    }
    await sleep(500);
  }
  return items;
}

async function pluto(): Promise<Item[]> {
  const boot = (await (
    await get(
      `https://boot.pluto.tv/v4/start?appName=web&appVersion=9.0.0&deviceVersion=120.0.0&deviceModel=web&deviceMake=chrome&deviceType=web&clientID=${randomUUID()}&clientModelNumber=1.0.0&serverSideAds=false`,
    )
  ).json()) as { sessionToken: string; servers: { vod: string } };
  const catalog = (await (
    await get(`${boot.servers.vod}/v4/vod/categories?includeItems=true&offset=1000&page=1`, {
      authorization: `Bearer ${boot.sessionToken}`,
    })
  ).json()) as {
    categories: { items?: { _id: string; type: string; name: string; slug: string; originalContentDuration?: number }[] }[];
  };
  const movies = new Map<string, Item>();
  for (const c of catalog.categories)
    for (const i of c.items ?? []) {
      if (i.type !== "movie" || movies.has(i._id)) continue;
      // The year is in the name ("A Star Is Born (2018)") or the slug ("...-2018-1-1").
      const year = Number(i.name.match(/\((19\d\d|20\d\d)\)\s*$/)?.[1] ?? i.slug.match(/-(19\d\d|20\d\d)-/)?.[1]) || undefined;
      movies.set(i._id, {
        title: i.name,
        url: `https://pluto.tv/on-demand/movies/${i.slug}`,
        minutes: i.originalContentDuration ? Math.round(i.originalContentDuration / 60000) : undefined,
        year,
      });
    }
  return [...movies.values()];
}

const prev = readJson<ServiceLinks>(OUT, { updatedAt: "", links: {} });
const links: ServiceLinks["links"] = {};
for (const [sid, name, load] of [
  [TUBI, "Tubi", tubi],
  [PLUTO, "Pluto TV", pluto],
] as const) {
  let items: Item[];
  try {
    items = await load();
  } catch (e) {
    // Keep yesterday's links for this service rather than dropping them.
    console.warn(`${name}: ${(e as Error).message}; keeping previous links`);
    for (const [id, l] of Object.entries(prev.links)) if (l[sid]) (links[id] ??= {})[sid] = l[sid];
    continue;
  }
  let matched = 0;
  for (const item of items) {
    const id = match(item);
    if (!id) continue;
    (links[id] ??= {})[sid] = item.url;
    matched++;
  }
  console.log(`${name}: ${items.length} movies in catalog, ${matched} matched to tracked films`);
}

writeJson(OUT, { updatedAt: new Date().toISOString(), links } satisfies ServiceLinks);
