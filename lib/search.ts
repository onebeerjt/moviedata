// Instant, typo-tolerant search over films and people, entirely in the browser.
// Words are looked up in a vocabulary (exact, prefix, then edit distance for typos),
// every query word has to match, and ties go to the better-known title.
import type { Lite } from "./lite";

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Index = {
  /** token -> row numbers that contain it */
  postings: Map<string, number[]>;
  /** sorted vocabulary, for prefix lookups */
  vocab: string[];
  /** vocabulary by first letter: typos rarely hit the first letter, so fuzzy matching only scans one bucket */
  byFirst: Map<string, string[]>;
  norm: string[];
  /** Popularity weight per row, 0–1 */
  pop: Float32Array;
};

/** `texts` are what gets tokenised; `plain` (default: the same) is what exact/starts-with bonuses compare against. */
function buildIndex(texts: string[], weights: ArrayLike<number>, plain: string[] = texts): Index {
  const postings = new Map<string, number[]>();
  const norm = plain.map(normalize);
  const tokenText = texts.map(normalize);
  const pop = new Float32Array(texts.length);
  let max = 1;
  for (let i = 0; i < texts.length; i++) max = Math.max(max, Math.log10(weights[i] + 10));
  for (let i = 0; i < texts.length; i++) {
    pop[i] = Math.log10(weights[i] + 10) / max;
    for (const tok of new Set(tokenText[i].split(" "))) {
      if (!tok) continue;
      const list = postings.get(tok);
      if (list) list.push(i);
      else postings.set(tok, [i]);
    }
  }
  const vocab = [...postings.keys()].sort();
  const byFirst = new Map<string, string[]>();
  for (const w of vocab) {
    const list = byFirst.get(w[0]);
    if (list) list.push(w);
    else byFirst.set(w[0], [w]);
  }
  return { postings, vocab, byFirst, norm, pop };
}

/** Edit distance with an early exit once it can't beat `max`. */
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // A swapped pair of letters ("teh") counts as one slip.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev[j - 2]);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function lowerBound(vocab: string[], prefix: string) {
  let lo = 0;
  let hi = vocab.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (vocab[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Rows matching one query word, with a 0–3 quality each. */
function matchToken(ix: Index, tok: string, isLast: boolean): Map<number, number> {
  const hits = new Map<number, number>();
  const add = (word: string, q: number) => {
    for (const row of ix.postings.get(word) ?? []) if ((hits.get(row) ?? 0) < q) hits.set(row, q);
  };
  add(tok, 3);
  if (isLast) {
    for (let i = lowerBound(ix.vocab, tok); i < ix.vocab.length && ix.vocab[i].startsWith(tok); i++) add(ix.vocab[i], 2.4);
  }
  // Too few hits: forgive typos. Short words only get one slip, long ones two.
  if (hits.size < 6 && tok.length >= 4) {
    const max = tok.length >= 8 ? 2 : 1;
    for (const word of ix.byFirst.get(tok[0]) ?? []) {
      if (word === tok) continue;
      let d = distance(tok, word, max);
      if (isLast && d > max && word.length > tok.length) d = Math.min(d, distance(tok, word.slice(0, tok.length), max));
      if (d <= max) add(word, 2 - d * 0.5);
    }
  }
  return hits;
}

function query(ix: Index, q: string, limit: number, bonus?: (row: number, qn: string) => number) {
  const qn = normalize(q);
  if (!qn) return [];
  const toks = qn.split(" ");
  let acc = new Map<number, number>();
  for (let k = 0; k < toks.length; k++) {
    const hits = matchToken(ix, toks[k], k === toks.length - 1);
    if (k === 0) acc = hits;
    else {
      const next = new Map<number, number>();
      for (const [row, s] of acc) {
        const h = hits.get(row);
        if (h !== undefined) next.set(row, s + h);
      }
      acc = next;
    }
  }
  const scored: [number, number][] = [];
  for (const [row, s] of acc) {
    const n = ix.norm[row];
    let score = s / toks.length + ix.pop[row] * 1.6;
    if (n === qn) score += 6;
    else if (n.startsWith(qn)) score += 2.5;
    else if (n.includes(qn)) score += 1;
    score += bonus?.(row, qn) ?? 0;
    scored.push([row, score]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, limit).map(([row]) => row);
}

export type Searcher = {
  films: (q: string, limit?: number) => number[];
  people: (q: string, limit?: number) => number[];
};

export function makeSearcher(lite: Lite, people: [number, string, number, number][]): Searcher {
  // Film titles are searchable with their year ("heat 1995").
  const filmIx = buildIndex(
    lite.t.map((t, i) => (lite.yr[i] ? `${t} ${lite.yr[i]}` : t)),
    lite.v,
    lite.t,
  );
  const peopleIx = buildIndex(
    people.map((p) => p[1]),
    people.map((p) => (p[2] + p[3]) * 40),
  );
  return {
    films: (q, limit = 6) => query(filmIx, q, limit),
    people: (q, limit = 3) => query(peopleIx, q, limit),
  };
}
