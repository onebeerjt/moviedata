import { getMeta } from "./data";

const DAY = 864e5;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
export const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);

/** How old the scores are, in words a reader can trust. */
export function freshness() {
  const meta = getMeta();
  if (!meta) return null;
  const age = daysSince(meta.builtAt);
  const when = age <= 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`;
  return {
    builtAt: meta.builtAt,
    age,
    stale: age >= 3,
    label: `Scores as of ${fmtDay(meta.builtAt)}`,
    when,
    theatersAt: meta.theatersAt,
    theatersAge: meta.theatersAt ? daysSince(meta.theatersAt) : null,
    streamingAt: meta.streamingAt,
    sources: meta.sources,
  };
}
