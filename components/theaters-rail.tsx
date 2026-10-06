"use client";

import type { ReactNode } from "react";
import { useVersion } from "./version-context";

const DAY = 864e5;
const PAST_DAYS = 84;
const FUTURE_DAYS = 14;

export type TheaterItem = { id: string; releaseDate?: string; card: ReactNode };

/** V2 keeps new releases only: out 12 weeks ago up to two weeks from now. Films with no date are dropped. */
function isNewRelease(releaseDate?: string) {
  if (!releaseDate) return false;
  const t = new Date(releaseDate).getTime();
  if (Number.isNaN(t)) return false;
  const age = (Date.now() - t) / DAY;
  return age <= PAST_DAYS && age >= -FUTURE_DAYS;
}

/** The "In theaters now" rail. V1 shows everything flagged now-playing; V2 filters it here, in the browser. */
export function TheatersRail({ items }: { items: TheaterItem[] }) {
  const { version } = useVersion();
  const v2 = version === "v2";
  const shown = v2 ? items.filter((i) => isNewRelease(i.releaseDate)) : items;
  if (shown.length === 0) return null;
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl">In theaters now</h2>
        <span className="text-xs text-text-3">{v2 ? "New releases · last 12 weeks" : "Refreshed daily"}</span>
      </div>
      <div className="scroller -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
        {shown.map((i) => (
          <div key={i.id} className="contents">
            {i.card}
          </div>
        ))}
      </div>
    </section>
  );
}
