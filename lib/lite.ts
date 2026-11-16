// Browser-side catalog: the compact columns written by scripts/build-client.ts.
// Loaded once, on demand, and shared by the Quad, search, Versus and "My taste".
import type { SourceKey } from "./types";

export const SOURCE_KEYS: SourceKey[] = ["letterboxd", "imdb", "tmdb", "rt", "metacritic"];

export type Lite = {
  n: number;
  genres: string[];
  /** IMDb number without "tt". Use ttId() to rebuild the id. */
  id: Int32Array;
  t: string[];
  yr: Uint16Array;
  /** Bit i set = film is in genres[i]. */
  g: Int32Array;
  /** Balanced score, whole points, -1 = none. */
  sc: Int16Array;
  /** IMDb vote count. Rows are sorted by this, most-voted first. */
  v: Int32Array;
  /** Percentile within each source, in tenths (0–1000), -1 = film isn't on that source. */
  p: Record<SourceKey, Int16Array>;
  /** Mean percentile of the audience sources / the critic sources, in tenths, -1 = none. */
  aud: Int16Array;
  crit: Int16Array;
};

type Raw = {
  n: number;
  genres: string[];
  id: number[];
  t: string[];
  yr: number[];
  g: number[];
  sc: number[];
  v: number[];
  p: Record<SourceKey, number[]>;
};

export const ttId = (n: number) => `tt${String(n).padStart(7, "0")}`;
export const nmId = (n: number) => `nm${String(n).padStart(7, "0")}`;
export const posterSrc = (key: string | undefined, size: "w92" | "w185" | "w342" = "w185") =>
  key ? `https://image.tmdb.org/t/p/${size}/${key}.jpg` : undefined;

let litePromise: Promise<Lite> | null = null;
let posterPromise: Promise<string[]> | null = null;
let peoplePromise: Promise<[number, string, number, number][]> | null = null;

const getJson = <T,>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json() as Promise<T>;
  });

export function loadLite(): Promise<Lite> {
  litePromise ??= getJson<Raw>("/data/lite.json")
    .then((raw) => {
      const mean = (...cols: Int16Array[]) => {
        const out = new Int16Array(raw.n);
        for (let i = 0; i < raw.n; i++) {
          let sum = 0;
          let k = 0;
          for (const c of cols) if (c[i] >= 0) {
            sum += c[i];
            k++;
          }
          out[i] = k ? Math.round(sum / k) : -1;
        }
        return out;
      };
      const p = Object.fromEntries(SOURCE_KEYS.map((k) => [k, Int16Array.from(raw.p[k])])) as Lite["p"];
      return {
        n: raw.n,
        genres: raw.genres,
        id: Int32Array.from(raw.id),
        t: raw.t,
        yr: Uint16Array.from(raw.yr),
        g: Int32Array.from(raw.g),
        sc: Int16Array.from(raw.sc),
        v: Int32Array.from(raw.v),
        p,
        aud: mean(p.letterboxd, p.imdb, p.tmdb),
        crit: mean(p.rt, p.metacritic),
      };
    })
    .catch((e) => {
      litePromise = null; // let the next caller retry
      throw e;
    });
  return litePromise;
}

export function loadPosters(): Promise<string[]> {
  posterPromise ??= getJson<string[]>("/data/posters.json").catch((e) => {
    posterPromise = null;
    throw e;
  });
  return posterPromise;
}

/** [IMDb number, name, films directed, films acted in] for people with 3+ credits. */
export function loadPeople() {
  peoplePromise ??= getJson<[number, string, number, number][]>("/data/people.json").catch((e) => {
    peoplePromise = null;
    throw e;
  });
  return peoplePromise;
}

/** Row index for an IMDb id, or -1. Built lazily. */
let indexById: Map<number, number> | null = null;
export function rowOf(lite: Lite, id: string) {
  if (!indexById) {
    indexById = new Map();
    for (let i = 0; i < lite.n; i++) indexById.set(lite.id[i], i);
  }
  return indexById.get(Number(id.slice(2))) ?? -1;
}
