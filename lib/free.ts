// Shapes the free-streaming catalog into the rows of the /free page.
// Everything here runs on the server; the page ships only the cards it shows.
import { allFilms, freeInfo, personName } from "./data";
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
  directors: string[];
  cast: string[];
};

export type StreamRow = {
  key: string;
  title: string;
  subtitle?: string;
  style: "poster" | "wide" | "top10";
  ids: string[];
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

export function buildStream(serviceId: number | null) {
  // Only films we can send straight to the movie on at least one service.
  const linked = (f: Film) => Object.keys(f.links ?? {}).map(Number);
  const pool = allFilms().filter((f) => {
    const ids = linked(f);
    return ids.length && hasArt(f) && (serviceId === null || ids.includes(serviceId));
  });
  const scored = pool.filter((f) => f.score !== null);
  const familiar = scored.filter((f) => votes(f) >= MIN_VOTES_FAMILIAR);
  const used = new Set<string>();
  const rows: StreamRow[] = [];

  const take = (films: Film[], n: number, { fresh = true } = {}) => {
    const out = films.filter((f) => !fresh || !used.has(f.id)).slice(0, n);
    out.forEach((f) => used.add(f.id));
    return out.map((f) => f.id);
  };
  const add = (row: Omit<StreamRow, "ids">, films: Film[], n = 24, min = 6, fresh = true) => {
    const ids = take(films, n, { fresh });
    if (ids.length >= min) rows.push({ ...row, ids });
  };

  // Hero: the best-loved familiar films with big backdrop art.
  const hero = take(
    [...familiar].filter((f) => f.backdrop && f.overview && votes(f) >= 80_000).sort(byScore),
    6,
  );

  add({ key: "top10", title: "Top 10 free right now", subtitle: "Highest balanced scores", style: "top10" }, [...familiar].sort(byScore), 10, 5);
  add(
    { key: "agree", title: "Everyone agrees", subtitle: "Critics and audiences both love these", style: "wide" },
    familiar.filter((f) => f.backdrop && f.critics !== null && f.audience !== null && Math.abs(f.critics - f.audience) <= 8).sort(byScore),
    16,
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
    16,
  );

  // Genre rows: a film can appear in one genre row and again elsewhere, so
  // these don't consume the "used" set.
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
    const ids = films.slice(0, 24).map((f) => f.id);
    if (ids.length >= 6) rows.push({ key: `g-${genre}`, title, style: "poster", ids });
  }
  add(
    { key: "classic", title: "Before 1970", subtitle: "Classic cinema, free", style: "poster" },
    scored.filter((f) => (f.year ?? 9999) < 1970).sort(byScore),
    24,
    6,
    false,
  );

  // Ship each film once, however many rows it appears in.
  const ids = new Set([...hero, ...rows.flatMap((r) => r.ids)]);
  const films: Record<string, StreamFilm> = {};
  for (const f of pool) if (ids.has(f.id)) films[f.id] = toStream(f);

  return { hero, rows, films, total: pool.length };
}

function toStream(f: Film): StreamFilm {
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
    // Only services with a direct link: those are the ones we can show.
    services: Object.keys(f.links ?? {}).map(Number),
    links: f.links ?? {},
    directors: f.directors.slice(0, 2).map(personName),
    cast: f.cast.slice(0, 4).map(personName),
  };
}
