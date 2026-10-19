// Shapes the free-streaming catalog, plus the subscription services a viewer
// has added, into the rows of the /free page. Everything here runs on the
// server; the page ships only the cards it shows.
import { allFilms, freeInfo, personName } from "./data";
import { SUBSCRIPTIONS } from "./subscriptions";
import type { Film, FreeService, SourceKey } from "./types";
import { agreement, scoreLabel } from "./verdict";

/** What a card and the detail sheet need, kept small for the client. */
export type StreamFilm = {
  id: string;
  title: string;
  year: number | null;
  runtime: number | null;
  genres: string[];
  rated?: string;
  poster?: string;
  backdrop?: string;
  overview?: string;
  score: number | null;
  label: string;
  agree: string;
  critics: number | null;
  audience: number | null;
  /** Percentile per source, for the little bars in the detail sheet. */
  s: Partial<Record<SourceKey, number>>;
  services: number[];
  links: Record<number, string>;
  trailer?: string;
  ytMovie?: string;
  directors: string[];
  cast: string[];
};

export type StreamRow = {
  key: string;
  title: string;
  subtitle?: string;
  style: "poster" | "wide" | "top10";
  /** The first chunk of the ranked list; the rest loads via /api/stream. */
  ids: string[];
  /** How many films the full ranked list holds. */
  total: number;
};

// Services shown as tabs, in this order, when they have films. Everything
// else still counts as free and shows up under "All".
const FEATURED = [
  "Tubi TV",
  "Pluto TV",
  "The Roku Channel",
  "Plex",
  "Amazon Prime Video Free with Ads",
  "Fandango at Home Free",
  "YouTube Free",
  "Kanopy",
  "Hoopla",
  "Fawesome",
  "Xumo Play",
];
const SHORT_NAMES: Record<string, string> = {
  "Tubi TV": "Tubi",
  "The Roku Channel": "Roku Channel",
  "Amazon Prime Video Free with Ads": "Prime Video (free)",
  "Fandango at Home Free": "Fandango Free",
  "YouTube Free": "YouTube",
};
export const serviceName = (s: Pick<FreeService, "name">) => SHORT_NAMES[s.name] ?? s.name;

export function streamServices() {
  const { services, updatedAt } = freeInfo();
  const byName = new Map(services.map((s) => [s.name, s]));
  const featured = FEATURED.flatMap((n) => (byName.get(n) ? [byName.get(n)!] : []));
  return { all: services, featured, updatedAt };
}

const MIN_VOTES_FAMILIAR = 20_000;
const votes = (f: Film) => f.s.imdb?.n ?? 0;
const byScore = (a: Film, b: Film) => (b.score ?? -1) - (a.score ?? -1) || votes(b) - votes(a);
const hasArt = (f: Film) => !!f.poster;

const SUB_IDS = new Set(SUBSCRIPTIONS.map((s) => s.id));
export const isSubscription = (id: number) => SUB_IDS.has(id);

/** The viewer's added services, from the cookie value ("8-1899-15"). */
export function parseSubs(value: string | undefined) {
  return [...new Set((value ?? "").split("-").map(Number).filter((id) => SUB_IDS.has(id)))];
}

/** Films per row in the first server payload; scrolling loads the rest. */
const INITIAL_CHUNK = 30;

const usableFor = (subs: number[]) => {
  const mine = new Set(subs);
  return (id: number) => !SUB_IDS.has(id) || mine.has(id);
};

type ComputedStream = {
  hero: string[];
  rows: StreamRow[];
  byId: Map<string, Film>;
  total: number;
};

const streamCache = new Map<string, ComputedStream>();

/**
 * Every category as its FULL ranked list (JT: the top 10/24 cut hid the good
 * stuff). Rows are computed once per (service, subs) and cached; the page
 * ships the first chunk of each and /api/stream serves the rest as the
 * viewer scrolls, so the payload stays small while nothing is held back.
 */
function computeStream(serviceId: number | null, subs: number[] = []): ComputedStream {
  const cacheKey = `${serviceId ?? "all"}|${subs.join("-")}`;
  const hit = streamCache.get(cacheKey);
  if (hit) return hit;

  const usable = usableFor(subs);
  const linked = (f: Film) => Object.keys(f.links ?? {}).map(Number).filter(usable);
  const pool = allFilms().filter((f) => {
    const ids = linked(f);
    return ids.length && hasArt(f) && (serviceId === null || ids.includes(serviceId));
  });
  const scored = pool.filter((f) => f.score !== null);
  const familiar = scored.filter((f) => votes(f) >= MIN_VOTES_FAMILIAR);
  const rows: StreamRow[] = [];
  const add = (row: Omit<StreamRow, "ids" | "total">, films: Film[], min = 6) => {
    const ids = films.map((f) => f.id);
    if (ids.length >= min) rows.push({ ...row, ids, total: ids.length });
  };

  // Hero: the best-loved familiar films with big backdrop art.
  const hero = [...familiar]
    .filter((f) => f.backdrop && f.overview && votes(f) >= 80_000)
    .sort(byScore)
    .slice(0, 6)
    .map((f) => f.id);

  add(
    { key: "top10", title: subs.length ? "Top for you right now" : "Top free right now", subtitle: "Every familiar favorite, ranked by balanced score", style: "top10" },
    [...familiar].sort(byScore),
    5,
  );
  // One row per added service, unless the page is already filtered to one.
  if (serviceId === null)
    for (const sub of SUBSCRIPTIONS.filter((s) => subs.includes(s.id)))
      add(
        { key: `sub-${sub.id}`, title: `Top on ${sub.name}`, subtitle: "Best balanced scores on your subscription", style: "poster" },
        scored.filter((f) => f.links?.[sub.id]).sort(byScore),
      );
  add(
    { key: "agree", title: "Everyone agrees", subtitle: "Critics and audiences both love these", style: "wide" },
    familiar.filter((f) => f.backdrop && f.critics !== null && f.audience !== null && Math.abs(f.critics - f.audience) <= 8).sort(byScore),
  );
  add(
    { key: "critics", title: "Critics' favorites", subtitle: "Rated higher by critics than by the crowd", style: "poster" },
    scored.filter((f) => f.critics !== null && f.audience !== null && f.critics - f.audience >= 12 && (f.critics ?? 0) >= 70).sort((a, b) => (b.critics ?? 0) - (a.critics ?? 0)),
  );
  add(
    { key: "crowd", title: "Crowd-pleasers", subtitle: "Audiences love them, whatever the critics said", style: "poster" },
    scored.filter((f) => f.critics !== null && f.audience !== null && f.audience - f.critics >= 12 && (f.audience ?? 0) >= 65).sort((a, b) => (b.audience ?? 0) - (a.audience ?? 0)),
  );
  add(
    { key: "gems", title: "Hidden gems", subtitle: "Great scores, few people have seen them", style: "poster" },
    scored.filter((f) => (f.score ?? 0) >= 75 && votes(f) < MIN_VOTES_FAMILIAR && votes(f) >= 1_500).sort(byScore),
  );
  add(
    { key: "cult", title: "Letterboxd cult favorites", subtitle: "Cinephiles rate these far above IMDb", style: "poster" },
    scored.filter((f) => f.s.letterboxd && f.s.imdb && f.s.letterboxd.p - f.s.imdb.p >= 15 && (f.score ?? 0) >= 65 && votes(f) >= 5_000).sort((a, b) => (b.s.letterboxd!.p - b.s.imdb!.p) - (a.s.letterboxd!.p - a.s.imdb!.p)),
  );

  const thisYear = new Date().getFullYear();
  add(
    { key: "recent", title: "Recent releases", subtitle: `From ${thisYear - 3} on`, style: "wide" },
    scored.filter((f) => f.backdrop && (f.year ?? 0) >= thisYear - 3).sort(byScore),
  );

  // Genre rows: the whole genre, ranked.
  const GENRES: [string, string][] = [
    ["Comedy", "Comedy"],
    ["Horror", "Horror"],
    ["Action", "Action"],
    ["Thriller", "Thrillers"],
    ["Sci-Fi", "Sci-fi"],
    ["Crime", "Crime"],
    ["Romance", "Romance"],
    ["Documentary", "Documentaries"],
    ["Animation", "Animation"],
    ["Drama", "Drama"],
    ["Western", "Westerns"],
    ["Family", "Family night"],
  ];
  for (const [genre, title] of GENRES) {
    const films = scored.filter((f) => f.genres.includes(genre)).sort(byScore);
    if (films.length >= 6) {
      const ids = films.map((f) => f.id);
      rows.push({ key: `g-${genre}`, title, style: "poster", ids, total: ids.length });
    }
  }
  add(
    { key: "classic", title: "Before 1970", subtitle: subs.length ? "Classic cinema" : "Classic cinema, free", style: "poster" },
    scored.filter((f) => (f.year ?? 9999) < 1970).sort(byScore),
  );

  const out: ComputedStream = { hero, rows, byId: new Map(pool.map((f) => [f.id, f])), total: pool.length };
  if (streamCache.size > 6) streamCache.clear();
  streamCache.set(cacheKey, out);
  return out;
}

export function buildStream(serviceId: number | null, subs: number[] = []) {
  const { hero, rows, byId, total } = computeStream(serviceId, subs);
  const usable = usableFor(subs);
  // Ship each film once, and only the first chunk of every row.
  const chunked = rows.map((r) => ({ ...r, ids: r.ids.slice(0, INITIAL_CHUNK) }));
  const ids = new Set([...hero, ...chunked.flatMap((r) => r.ids)]);
  const films: Record<string, StreamFilm> = {};
  for (const id of ids) {
    const f = byId.get(id);
    if (f) films[id] = toStream(f, usable);
  }
  return { hero, rows: chunked, films, total };
}

/** One more chunk of one row's full ranked list, for /api/stream. */
export function getStreamChunk(serviceId: number | null, subs: number[], rowKey: string, offset: number, limit: number) {
  const { rows, byId } = computeStream(serviceId, subs);
  const row = rows.find((r) => r.key === rowKey);
  if (!row) return null;
  const usable = usableFor(subs);
  const ids = row.ids.slice(offset, offset + limit);
  const films: Record<string, StreamFilm> = {};
  for (const id of ids) {
    const f = byId.get(id);
    if (f) films[id] = toStream(f, usable);
  }
  return { ids, films, total: row.total };
}

function toStream(f: Film, usable: (id: number) => boolean): StreamFilm {
  const links = Object.fromEntries(Object.entries(f.links ?? {}).filter(([id]) => usable(Number(id))));
  return {
    id: f.id,
    title: f.title,
    year: f.year,
    runtime: f.runtime,
    genres: f.genres,
    rated: f.rated,
    poster: f.poster,
    backdrop: f.backdrop,
    overview: f.overview,
    score: f.score,
    label: scoreLabel(f.score),
    agree: agreement(f.spread).label,
    critics: f.critics,
    audience: f.audience,
    s: Object.fromEntries(Object.entries(f.s).map(([k, v]) => [k, Math.round(v.p)])),
    // Only services with a direct link that the viewer can use.
    services: Object.keys(links).map(Number),
    links,
    trailer: f.trailer,
    ytMovie: f.ytMovie,
    directors: f.directors.slice(0, 2).map(personName),
    cast: f.cast.slice(0, 4).map(personName),
  };
}
