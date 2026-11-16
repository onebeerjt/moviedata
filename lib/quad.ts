import type { Lite } from "./lite";

export type AxisKey = "audience" | "critics" | "letterboxd" | "imdb" | "tmdb" | "rt" | "metacritic";

export const AXES: { key: AxisKey; label: string; hint: string; noun: string }[] = [
  { key: "audience", label: "Audiences", hint: "Letterboxd · IMDb · TMDB, averaged", noun: "audiences" },
  { key: "critics", label: "Critics", hint: "Rotten Tomatoes · Metacritic, averaged", noun: "critics" },
  { key: "letterboxd", label: "Letterboxd", hint: "Letterboxd percentile", noun: "Letterboxd" },
  { key: "imdb", label: "IMDb", hint: "IMDb percentile", noun: "IMDb" },
  { key: "tmdb", label: "TMDB", hint: "TMDB percentile", noun: "TMDB" },
  { key: "rt", label: "Rotten Tomatoes", hint: "Rotten Tomatoes percentile", noun: "Rotten Tomatoes" },
  { key: "metacritic", label: "Metacritic", hint: "Metacritic percentile", noun: "Metacritic" },
];

export const PRESETS: { name: string; x: AxisKey; y: AxisKey }[] = [
  { name: "Critics vs audiences", x: "audience", y: "critics" },
  { name: "Letterboxd vs IMDb", x: "imdb", y: "letterboxd" },
  { name: "RT vs Metacritic", x: "metacritic", y: "rt" },
  { name: "Letterboxd vs RT", x: "rt", y: "letterboxd" },
  { name: "IMDb vs Metacritic", x: "metacritic", y: "imdb" },
];

export const axisOf = (k: AxisKey) => AXES.find((a) => a.key === k) ?? AXES[0];

/** The column behind an axis, in percentile tenths (-1 = film has no data on it). */
export const column = (lite: Lite, k: AxisKey): Int16Array => (k === "audience" ? lite.aud : k === "critics" ? lite.crit : lite.p[k]);

/** Names for the four boxes. Index = (y high ? 0 : 2) + (x high ? 1 : 0)... see quadOf(). */
export function quadNames(x: AxisKey, y: AxisKey) {
  const xs = axisOf(x);
  const ys = axisOf(y);
  const crit = y === "critics" && x === "audience";
  return {
    canon: { name: "The Canon", sub: "loved by both" },
    ydarling: crit ? { name: "Critics' darlings", sub: "critics yes, audiences no" } : { name: `${ys.label} darlings`, sub: `${ys.noun} yes, ${xs.noun} no` },
    xdarling: crit ? { name: "Crowd pleasers", sub: "audiences yes, critics no" } : { name: `${xs.label} darlings`, sub: `${xs.noun} yes, ${ys.noun} no` },
    bomb: { name: "The Bomb Zone", sub: "panned by both" },
  };
}

/** 0 canon (high x, high y), 1 y-darling (low x, high y), 2 x-darling (high x, low y), 3 bomb. */
export const quadOf = (xv: number, yv: number, split = 500) => (yv >= split ? (xv >= split ? 0 : 1) : xv >= split ? 2 : 3);
export const QUAD_KEYS = ["canon", "ydarling", "xdarling", "bomb"] as const;
