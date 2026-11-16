"use client";

import Link from "next/link";
import { setSeen, toggleWatch, useMe } from "@/lib/me";
import { Stars } from "./stars";

/** Watchlist + "I've seen it" with a half-star rating, stored in this browser only. */
export function MyShelf({ id }: { id: string }) {
  const me = useMe();
  const watching = me.watch.includes(id);
  const seen = me.seen[id];
  const btn = "rounded-full border px-4 py-2 text-sm transition";
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-3">Your take</h2>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => toggleWatch(id)}
          aria-pressed={watching}
          disabled={!!seen}
          className={`${btn} ${watching ? "border-text bg-text text-bg" : "border-line text-text hover:bg-surface-2"} disabled:opacity-40`}
        >
          {watching ? "✓ On your watchlist" : "+ Watchlist"}
        </button>
        <button
          onClick={() => setSeen(id, seen ? null : 0)}
          aria-pressed={!!seen}
          className={`${btn} ${seen ? "border-text bg-text text-bg" : "border-line text-text hover:bg-surface-2"}`}
        >
          {seen ? "✓ Seen" : "I've seen it"}
        </button>
      </div>
      {seen && (
        <div className="mt-4">
          <Stars value={seen.r} onChange={(r) => setSeen(id, r)} />
          <div className="mt-1 text-xs text-text-3">{seen.r ? `${seen.r / 2} of 5` : "Tap a star to rate it"}</div>
        </div>
      )}
      <p className="mt-3 text-xs text-text-3">
        Saved in this browser only. Rate a few films and <Link href="/me" className="underline underline-offset-2">see which site agrees with you →</Link>
      </p>
    </div>
  );
}
