// Direct links straight from each service's own public catalog: a second source
// alongside free-links.ts (which is rate limited by TMDB's site).
//
// - Tubi publishes every movie in its sitemaps (title, page URL, runtime).
// - Pluto's web app loads its on-demand catalog from a public endpoint after
//   an anonymous session; one request returns every movie (title, slug, runtime).
// - Starz, MGM+, Peacock, AMC+, MUBI, Xumo and Apple TV+ publish a feed or
//   sitemap of film pages. Those seven only ever link a film that free.json
//   already lists on that service, and only fetch pages for slugs that look
//   like one of those films (Apple's sitemap is the whole iTunes buy/rent shop).
//
// Each title is matched to a film we track by normalized title, then
// confirmed by runtime and/or year. Only unambiguous matches are kept, so a
// remake or a same-named film never gets the wrong link.
// Usage: node scripts/service-catalogs.ts
import { randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { SOURCES, readJson, sleep, writeJson } from "./util.ts";
import type { ImdbFilm } from "./ingest-imdb.ts";

export const TUBI = 73;
export const PLUTO = 300;
const STARZ = 43;
const MGMPLUS = 34;
const PEACOCK = 386;
const AMCPLUS = 526;
const MUBI = 11;
const XUMO = 1963;
const APPLETV = 350;
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

const free = readJson<{ films: Record<string, { services?: number[]; subs?: number[] }> }>(join(SOURCES, "free.json"), {
  films: {},
});
/** Only claim a film is on a service if free.json (JustWatch/TMDB) says so too. */
const onService = (id: string, sid: number) =>
  !!free.films[id] && ((free.films[id].services ?? []).includes(sid) || (free.films[id].subs ?? []).includes(sid));

/** Like normTitle, but "Ocean's Eleven" and a slug "oceans-eleven" agree. */
const squash = (t: string) => normTitle(t).replace(/ /g, "");
const bySquash = new Map<string, [string, ImdbFilm][]>();
for (const entry of Object.entries(imdb)) {
  const key = squash(entry[1].title);
  bySquash.set(key, [...(bySquash.get(key) ?? []), entry]);
}

/** Title keys of the films free.json lists on this service: the only slugs worth a page fetch. */
function trackedKeys(sid: number, skip?: (id: string) => boolean) {
  const keys = new Set<string>();
  for (const [id, f] of Object.entries(imdb)) if (onService(id, sid) && !skip?.(id)) keys.add(squash(f.title));
  return keys;
}

type Item = {
  title: string;
  url: string;
  minutes?: number;
  year?: number;
  /** Fetches the page for the facts the catalog list lacks (year, runtime, the real title). */
  enrich?: () => Promise<Partial<Pick<Item, "title" | "minutes" | "year">> | null>;
  /** Only fetch the page if the list data alone doesn't settle it. */
  lazy?: boolean;
};

/** The one film this catalog item is, or nothing if it isn't clear. sid = a service whose films must include it. */
function match(item: Item, sid?: number): string | null {
  const candidates = (sid ? bySquash.get(squash(item.title)) : byTitle.get(normTitle(item.title))) ?? [];
  const fits = candidates.filter(([, f]) => {
    const runtimeOk = item.minutes && f.runtime ? Math.abs(item.minutes - f.runtime) <= 6 : null;
    const yearOk = item.year && f.year ? Math.abs(item.year - f.year) <= 1 : null;
    if (runtimeOk === false || yearOk === false) return false;
    // Need at least one positive check, unless the title is unique to one film.
    return runtimeOk || yearOk || candidates.length === 1;
  });
  const id = fits.length === 1 ? fits[0][0] : null;
  return id && (!sid || onService(id, sid)) ? id : null;
}

/** fetch that retries dropped connections; the error names the real cause, not just "fetch failed". */
async function send(url: string, headers: Record<string, string>, timeout: number, tries = 3) {
  for (let n = 0; ; n++) {
    try {
      return await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(timeout) });
    } catch (e) {
      if (n >= tries) throw new Error(`${url} -> ${(e as Error).cause ?? (e as Error).message}`);
      await sleep(2000 * 2 ** n);
    }
  }
}

async function get(url: string, headers: Record<string, string> = {}) {
  for (let tries = 0; ; tries++) {
    const res = await send(url, headers, 60_000);
    if (res.ok) return res;
    if (tries >= 3) throw new Error(`${url} -> ${res.status}`);
    await sleep(2000 * 2 ** tries);
  }
}

/** A service told us to stop (403/429). We keep yesterday's links and move on; never route around it. */
class Blocked extends Error {}

/** One film page: its HTML, or null if it's gone. Gives up on the whole service if it blocks us. */
async function page(url: string) {
  for (let tries = 0; ; tries++) {
    const res = await send(url, {}, 30_000, 2);
    if (res.ok) return res.text();
    if (res.status === 404 || res.status === 410) return null;
    if (res.status === 403 || res.status === 429) throw new Blocked(`${url} -> ${res.status}`);
    if (tries >= 2) throw new Error(`${url} -> ${res.status}`);
    await sleep(3000 * 2 ** tries);
  }
}

/** "PT1H43M" -> 103 minutes. */
function isoMinutes(d?: string) {
  const m = d?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return undefined;
  const minutes = Math.round(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60);
  return minutes || undefined;
}

/** "chaplin-1992" -> the title words, and the year if the slug ends in one. */
function fromSlug(slug: string) {
  const words = slug.replace(/-+/g, " ").trim();
  const m = words.match(/^(.+) ((?:19|20)\d\d)$/);
  return m ? { title: m[1], year: Number(m[2]), full: words } : { title: words, year: undefined, full: words };
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

/** Pause between page fetches, a little jittered. */
const pause = (ms: number) => sleep(ms + Math.random() * ms * 0.5);

/** Starz: one feed (announced in its robots.txt) lists every movie. */
async function starz(): Promise<Item[]> {
  type Named = string | { "@value": string }[];
  const feed = (await (await get("https://feeddata.starz.com/PROD/google_home/starz_feed.json")).json()) as {
    dataFeedElement: { "@type": string; name: Named; url?: string; duration?: string; releasedEvent?: { startDate?: string } }[];
  };
  const items: Item[] = [];
  for (const m of feed.dataFeedElement) {
    const title = Array.isArray(m.name) ? m.name[0]?.["@value"] : m.name;
    if (m["@type"] !== "Movie" || !title || !m.url?.startsWith("https://www.starz.com/us/en/movies/")) continue;
    items.push({
      title,
      url: m.url.split("?")[0],
      minutes: isoMinutes(m.duration),
      year: Number(m.releasedEvent?.startDate?.slice(0, 4)) || undefined,
    });
  }
  return items;
}

/** MGM+: movie slugs in the sitemap, about half with the year ("chaplin-1992"); the rest need their page. */
async function mgmplus(tracked: Set<string>): Promise<Item[]> {
  const xml = await (await get("https://www.mgmplus.com/sitemap/sitemap.xml")).text();
  const items: Item[] = [];
  for (const [, url, slug] of xml.matchAll(/<loc>(https:\/\/www\.mgmplus\.com\/movie\/([^/<]+))<\/loc>/g)) {
    const { title, year, full } = fromSlug(slug);
    if (year) {
      // "wonder-woman-1984" could be the title or title + year.
      if (tracked.has(squash(title))) items.push({ title, url, year });
      if (tracked.has(squash(full))) items.push({ title: full, url });
      continue;
    }
    if (!tracked.has(squash(title))) continue;
    items.push({
      title,
      url,
      enrich: async () => {
        const html = await page(url);
        if (!html) return null;
        const year = Number(html.match(/datePublished\\?":\\?"(\d{4})/)?.[1]) || undefined;
        const minutes = isoMinutes(html.match(/duration\\?":\\?"(PT[^"\\]+)/)?.[1]);
        return year || minutes ? { year, minutes } : null;
      },
    });
  }
  return items;
}

/** Peacock: movie pages from the sitemap; each page's JSON-LD has the real title, year and runtime. */
async function peacock(tracked: Set<string>): Promise<Item[]> {
  const xml = await (await get("https://www.peacocktv.com/sitemap-content_page_movies_us-0.xml")).text();
  const items: Item[] = [];
  const seen = new Set<string>();
  for (const [, url, slug] of xml.matchAll(/<loc>(https:\/\/www\.peacocktv\.com\/watch-online\/movies\/([^/<]+)\/[0-9a-f-]{36})<\/loc>/g)) {
    const { title, full } = fromSlug(slug);
    if (seen.has(url) || !(tracked.has(squash(title)) || tracked.has(squash(full)))) continue;
    seen.add(url);
    items.push({
      title: full,
      url,
      enrich: async () => {
        const html = await page(url);
        if (!html) return null;
        for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
          let data: { "@graph"?: Record<string, string>[] };
          try {
            data = JSON.parse(json);
          } catch {
            continue;
          }
          const movie = data["@graph"]?.find((n) => n["@type"] === "Movie");
          const minutes = isoMinutes(movie?.duration);
          // Stubs: no name, or a trailer-length "movie".
          if (!movie?.name || !minutes || minutes < 2) return null;
          return { title: movie.name, minutes, year: Number(movie.copyrightYear) || undefined };
        }
        return null;
      },
    });
  }
  return items;
}

/** AMC+: slugs are "<title>--<id>", sometimes with the year; otherwise the page's og:title may carry it. */
async function amcplus(tracked: Set<string>): Promise<Item[]> {
  const xml = await (await get("https://www.amcplus.com/sitemap.xml")).text();
  const items: Item[] = [];
  for (const [, url, slug] of xml.matchAll(/<loc>(https:\/\/www\.amcplus\.com\/movies\/([^/<]+?)--\d+)<\/loc>/g)) {
    const { title, year, full } = fromSlug(slug);
    if (year) {
      if (tracked.has(squash(title))) items.push({ title, url, year });
      if (tracked.has(squash(full))) items.push({ title: full, url });
      continue;
    }
    if (!tracked.has(squash(title))) continue;
    items.push({
      title,
      url,
      enrich: async () => {
        const html = await page(url);
        // "Watch Housemaid, The (2018) Online | AMC+"
        const og = html?.match(/property="og:title" content="Watch (.+?)(?: \(((?:19|20)\d\d)\))? Online \| AMC\+"/);
        return og ? { title: og[1], year: Number(og[2]) || undefined } : null;
      },
    });
  }
  return items;
}

/** MUBI: 15 film sitemaps repeat every film per locale; dedupe by slug and link the en/us page. */
async function mubi(tracked: Set<string>): Promise<Item[]> {
  const index = await (await get("https://feeds.mubi.com/sitemap.xml")).text();
  const files = [...index.matchAll(/<loc>(https:\/\/feeds\.mubi\.com\/sitemap\/films_\d+\.xml)<\/loc>/g)].map((m) => m[1]);
  const slugs = new Set<string>();
  for (const file of files) {
    const xml = await (await get(file)).text();
    for (const m of xml.matchAll(/<loc>https:\/\/mubi\.com\/[a-z]{2}\/[a-z]{2}\/films\/([^/<]+)<\/loc>/g)) slugs.add(m[1]);
    await sleep(500);
  }
  const items: Item[] = [];
  for (const slug of slugs) {
    const { title, year, full } = fromSlug(slug);
    const url = `https://mubi.com/en/us/films/${slug}`;
    if (year) {
      if (tracked.has(squash(title))) items.push({ title, url, year });
      if (tracked.has(squash(full))) items.push({ title: full, url });
      continue;
    }
    if (!tracked.has(squash(title))) continue;
    items.push({
      title,
      url,
      enrich: async () => {
        // "Watch La antena (2007) on MUBI"
        const og = (await page(url))?.match(/property="og:title" content="Watch (.+?) \(((?:19|20)\d\d)\) on MUBI"/);
        return og ? { title: og[1], year: Number(og[2]) } : null;
      },
    });
  }
  return items;
}

/** Xumo: the free-movies page embeds every rail of cards (title, slug, runtime); the year comes from the detail page if needed. */
async function xumo(): Promise<Item[]> {
  const html = await (await get("https://play.xumo.com/free-movies")).text();
  const data = JSON.parse(html.match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/)![1]) as {
    props: { pageProps: { page: { rails: { cards?: { id: string; slug: string; title: string; contentType: string; runtime?: number }[] }[] } } };
  };
  const movies = new Map<string, Item>();
  for (const rail of data.props.pageProps.page.rails)
    for (const c of rail.cards ?? []) {
      if (c.contentType !== "MOVIE" || movies.has(c.id)) continue;
      const url = `https://play.xumo.com/free-movies/${c.slug}/${c.id}`;
      movies.set(c.id, {
        title: c.title,
        url,
        minutes: c.runtime ? Math.round(c.runtime / 60) : undefined,
        lazy: true,
        enrich: async () => {
          const html = await page(url);
          const next = html?.match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/)?.[1];
          const year = next ? Number(JSON.parse(next).props?.pageProps?.page?.entity?.year) : NaN;
          return year ? { year } : null;
        },
      });
    }
  return [...movies.values()];
}

/**
 * Apple TV+: the sitemap is the whole iTunes buy/rent catalog, so we only look
 * for the films free.json lists under Apple TV+, and confirm each page's title
 * and release year. Films we already linked are kept without another scan.
 */
async function appletv(): Promise<Item[]> {
  const items: Item[] = [];
  const known = (id: string) => !!prev.links[id]?.[APPLETV];
  for (const [id, f] of Object.entries(imdb))
    if (onService(id, APPLETV) && known(id)) items.push({ title: f.title, url: prev.links[id][APPLETV], year: f.year ?? undefined });
  const wanted = trackedKeys(APPLETV, known);
  if (!wanted.size) return items;
  const index = await (await get("https://tv.apple.com/sitemaps_tv_index_movie_1.xml")).text();
  const files = [...index.matchAll(/<loc>(https:\/\/tv\.apple\.com\/[^<]+\.xml(?:\.gz)?)<\/loc>/g)].map((m) => m[1]);
  const found = new Map<string, string>(); // umc id -> slug
  for (const file of files) {
    const body = Buffer.from(await (await get(file)).arrayBuffer());
    const xml = (body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body).toString("utf8");
    for (const m of xml.matchAll(/<loc>https:\/\/tv\.apple\.com\/[a-z]{2}\/movie\/([^/<]+)\/(umc\.cmc\.[a-z0-9]+)<\/loc>/g)) {
      const { title, full } = fromSlug(m[1]);
      if (!found.has(m[2]) && (wanted.has(squash(title)) || wanted.has(squash(full)))) found.set(m[2], m[1]);
    }
    await sleep(300);
  }
  for (const [umc, slug] of found) {
    const url = `https://tv.apple.com/us/movie/${slug}/${umc}`;
    items.push({
      title: fromSlug(slug).full,
      url,
      enrich: async () => {
        const html = await page(url);
        const t = html?.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/)?.[1] ?? html?.match(/<meta[^>]+content="([^"]*)"[^>]+property="og:title"/)?.[1];
        const y = html?.match(/"datePublished":"(\d{4})-/)?.[1];
        if (!t || !y) return null;
        const title = t
          .replace(/ /g, " ")
          .replace(/ - Apple TV$/, "")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#x27;|&#39;|&apos;/g, "'");
        return { title, year: Number(y) };
      },
    });
  }
  return items;
}

type Loader = {
  sid: number;
  name: string;
  /** Name used by the ONLY filter. */
  key: string;
  load: (tracked: Set<string>) => Promise<Item[]>;
  /** Only link films free.json already lists on this service. */
  listedOnly?: boolean;
  /** Pause between page fetches (ms). */
  pace?: number;
};
const LOADERS: Loader[] = [
  { sid: TUBI, name: "Tubi", key: "tubi", load: tubi },
  { sid: PLUTO, name: "Pluto TV", key: "pluto", load: pluto },
  { sid: STARZ, name: "Starz", key: "starz", load: starz, listedOnly: true },
  { sid: MGMPLUS, name: "MGM+", key: "mgmplus", load: mgmplus, listedOnly: true, pace: 1500 },
  { sid: PEACOCK, name: "Peacock", key: "peacock", load: peacock, listedOnly: true, pace: 2000 },
  { sid: AMCPLUS, name: "AMC+", key: "amcplus", load: amcplus, listedOnly: true, pace: 1500 },
  { sid: MUBI, name: "MUBI", key: "mubi", load: mubi, listedOnly: true, pace: 1500 },
  { sid: XUMO, name: "Xumo", key: "xumo", load: xumo, listedOnly: true, pace: 1500 },
  { sid: APPLETV, name: "Apple TV+", key: "appletv", load: appletv, listedOnly: true, pace: 1500 },
];

// ONLY=amcplus,mubi limits the run to those loaders (by key); every other service keeps its previous links untouched.
const only = (process.env.ONLY ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const known = LOADERS.map((l) => l.key);
const unknown = only.filter((k) => !known.includes(k));
if (unknown.length) throw new Error(`ONLY: unknown loader(s) ${unknown.join(", ")}; known: ${known.join(", ")}`);

const links: ServiceLinks["links"] = {};
for (const { sid, name, key, load, listedOnly, pace = 1500 } of LOADERS) {
  if (only.length && !only.includes(key)) {
    for (const [id, l] of Object.entries(prev.links)) if (l[sid]) (links[id] ??= {})[sid] ??= l[sid];
    continue;
  }
  const keepPrevious = () => {
    for (const [id, l] of Object.entries(prev.links))
      if (l[sid] && (!listedOnly || onService(id, sid))) (links[id] ??= {})[sid] ??= l[sid];
  };
  let items: Item[];
  try {
    items = await load(trackedKeys(sid));
  } catch (e) {
    // Keep yesterday's links for this service rather than dropping them.
    console.warn(`${name}: ${(e as Error).message}; keeping previous links`);
    keepPrevious();
    continue;
  }
  let matched = 0;
  let fetched = 0;
  let trouble = 0;
  let stopped = false;
  const taken = new Set<string>();
  const plausible = (title: string, sid: number) => (bySquash.get(squash(title)) ?? []).some(([id]) => onService(id, sid));
  for (let item of items) {
    if (taken.has(item.url)) continue;
    let id = match(item, listedOnly ? sid : undefined);
    // Fetch a page only when the list data isn't enough and the title could be a film listed on this service.
    if (item.enrich && (!item.lazy || !id) && (!listedOnly || plausible(item.title, sid))) {
      if (stopped) continue;
      try {
        if (fetched++) await pause(pace);
        const more = await item.enrich();
        if (!more) continue;
        item = { ...item, ...more };
      } catch (e) {
        console.warn(`${name}: ${(e as Error).message}`);
        trouble++;
        stopped = e instanceof Blocked;
        continue;
      }
      id = match(item, listedOnly ? sid : undefined);
    }
    if (!id || (listedOnly && links[id]?.[sid])) continue;
    (links[id] ??= {})[sid] = item.url;
    taken.add(item.url);
    matched++;
  }
  // If pages failed or the service blocked us, don't lose links we couldn't re-check.
  if (trouble) keepPrevious();
  console.log(
    `${name}: ${items.length} movies in catalog, ${matched} matched to tracked films` +
      (fetched ? `, ${fetched} pages fetched` : "") +
      (trouble ? `, ${trouble} fetch problems${stopped ? " (blocked, stopped early)" : ""}` : ""),
  );
}

writeJson(OUT, { updatedAt: new Date().toISOString(), links } satisfies ServiceLinks);
