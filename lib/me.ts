"use client";
// Your watchlist and ratings. Local-first: everything lives in this browser's
// localStorage, nothing is sent anywhere, there are no accounts.
import { useSyncExternalStore } from "react";

export type Me = {
  /** IMDb ids on the watchlist, newest first. */
  watch: string[];
  /** Films seen. r = rating in half-stars ×2 (1–10), 0 = seen but not rated. */
  seen: Record<string, { r: number; at: string }>;
};

const KEY = "consensus-me-v1";
const CHANGE = "consensus-me-change";
const EMPTY: Me = { watch: [], seen: {} };

let cachedRaw: string | null = null;
let cached: Me = EMPTY;

function read(): Me {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const p = raw ? JSON.parse(raw) : null;
    cached = p && Array.isArray(p.watch) && p.seen && typeof p.seen === "object" ? { watch: p.watch, seen: p.seen } : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function write(next: Me) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode or full: the change just won't persist */
  }
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}

export const useMe = () => useSyncExternalStore(subscribe, read, () => EMPTY);

export function toggleWatch(id: string) {
  const me = read();
  write({ ...me, watch: me.watch.includes(id) ? me.watch.filter((x) => x !== id) : [id, ...me.watch] });
}

/** Mark a film seen with a rating (1–10 half-stars ×2); 0 = seen, unrated; null = not seen. */
export function setSeen(id: string, r: number | null) {
  const me = read();
  const seen = { ...me.seen };
  if (r === null) delete seen[id];
  else seen[id] = { r, at: new Date().toISOString() };
  // Seeing a film takes it off the watchlist.
  write({ watch: r === null ? me.watch : me.watch.filter((x) => x !== id), seen });
}

export const clearMe = () => write(EMPTY);
export const exportMe = () => JSON.stringify(read(), null, 1);
export function importMe(json: string) {
  const p = JSON.parse(json);
  if (!p || !Array.isArray(p.watch) || !p.seen || typeof p.seen !== "object") throw new Error("Not a Consensus export");
  write({ watch: p.watch.filter((x: unknown) => typeof x === "string"), seen: p.seen });
}
