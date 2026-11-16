// Which source agrees with you? Spearman rank correlation between your ratings and each
// source's percentile, over the films you rated that the source also covers.
import { SOURCE_KEYS, type Lite } from "./lite";
import type { SourceKey } from "./types";

export type AlignKey = SourceKey | "audience" | "critics" | "score";
export type Alignment = { key: AlignKey; rho: number | null; n: number };

function ranks(xs: number[]) {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++;
    const r = (i + j) / 2 + 1; // ties share the average rank
    for (let k = i; k <= j; k++) out[idx[k]] = r;
    i = j + 1;
  }
  return out;
}

export function spearman(a: number[], b: number[]) {
  const n = a.length;
  if (n < 3) return null;
  const ra = ranks(a);
  const rb = ranks(b);
  const ma = ra.reduce((s, x) => s + x, 0) / n;
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  // Rating everything the same (or a source scoring them all alike) carries no signal.
  return da === 0 || db === 0 ? null : num / Math.sqrt(da * db);
}

/** rows: [lite row, your rating 1–10] */
export function alignment(lite: Lite, rated: [number, number][]): Alignment[] {
  const cols: [AlignKey, Int16Array][] = [
    ...SOURCE_KEYS.map((k): [AlignKey, Int16Array] => [k, lite.p[k]]),
    ["audience", lite.aud],
    ["critics", lite.crit],
    ["score", Int16Array.from(lite.sc, (v) => (v < 0 ? -1 : v * 10))],
  ];
  return cols.map(([key, col]) => {
    const pairs = rated.filter(([row]) => col[row] >= 0);
    return { key, n: pairs.length, rho: spearman(pairs.map((p) => p[1]), pairs.map((p) => col[p[0]])) };
  });
}

export const strength = (rho: number) => (rho >= 0.7 ? "strong" : rho >= 0.4 ? "moderate" : rho >= 0.15 ? "weak" : rho > -0.15 ? "no real" : "opposite");
