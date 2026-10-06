import type { SourceKey } from "./types";

export type SourceMeta = {
  key: SourceKey;
  name: string;
  short: string;
  kind: "audience" | "critics";
  /** Format the raw value on the source's own scale. */
  format: (v: number) => string;
  /** CSS variable holding this source's identity color. */
  color: string;
  url: (film: { id: string; letterboxdSlug?: string; title: string }) => string;
};

// Display order is fixed (audience first, then critics) and the colors were
// validated as an adjacent set in this order — don't reorder one without the other.
export const SOURCES: SourceMeta[] = [
  {
    key: "letterboxd",
    name: "Letterboxd",
    short: "LB",
    kind: "audience",
    format: (v) => `${v.toFixed(2)} / 5`,
    color: "var(--src-letterboxd)",
    url: (f) => (f.letterboxdSlug ? `https://letterboxd.com/film/${f.letterboxdSlug}/` : `https://letterboxd.com/imdb/${f.id}/`),
  },
  {
    key: "imdb",
    name: "IMDb",
    short: "IMDb",
    kind: "audience",
    format: (v) => `${v.toFixed(1)} / 10`,
    color: "var(--src-imdb)",
    url: (f) => `https://www.imdb.com/title/${f.id}/`,
  },
  {
    key: "tmdb",
    name: "TMDB",
    short: "TMDB",
    kind: "audience",
    format: (v) => `${v.toFixed(1)} / 10`,
    color: "var(--src-tmdb)",
    url: (f) => `https://www.themoviedb.org/redirect?external_source=imdb_id&external_id=${f.id}`,
  },
  {
    key: "rt",
    name: "Rotten Tomatoes",
    short: "RT",
    kind: "critics",
    format: (v) => `${Math.round(v)}%`,
    color: "var(--src-rt)",
    url: (f) => `https://www.rottentomatoes.com/search?search=${encodeURIComponent(f.title)}`,
  },
  {
    key: "metacritic",
    name: "Metacritic",
    short: "MC",
    kind: "critics",
    format: (v) => `${Math.round(v)} / 100`,
    color: "var(--src-metacritic)",
    url: (f) => `https://www.metacritic.com/search/${encodeURIComponent(f.title)}/`,
  },
];

export const SOURCE = Object.fromEntries(SOURCES.map((s) => [s.key, s])) as Record<SourceKey, SourceMeta>;
