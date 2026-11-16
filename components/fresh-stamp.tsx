"use client";

import { useSyncExternalStore } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const noop = () => () => {};

/**
 * "Scores as of Oct 23 · 24 days ago". The date is rendered on the server; the age is
 * worked out in the browser so a cached page never claims to be fresher than it is.
 */
export function FreshStamp({ iso, prefix = "Scores as of", warn = true }: { iso: string; prefix?: string; warn?: boolean }) {
  const days = useSyncExternalStore(
    noop,
    () => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5),
    () => null,
  );
  const d = new Date(iso);
  const stale = days !== null && days >= 3;
  return (
    <span className={stale && warn ? "text-[var(--quad-xdarling)]" : ""} suppressHydrationWarning>
      {prefix} {MONTHS[d.getUTCMonth()]} {d.getUTCDate()}
      {days !== null && days >= 1 ? ` · ${days} day${days === 1 ? "" : "s"} ago` : ""}
      {stale && warn ? ": the daily refresh is behind, so newer ratings aren't in yet" : ""}
    </span>
  );
}
