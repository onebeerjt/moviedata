import type { Film } from "./types";

export type Confidence = {
  tier: "solid" | "limited" | "thin";
  label: string;
  /** One honest sentence on what the score rests on. */
  detail: string;
};

/** The score pool starts at 5,000 IMDb ratings (scripts/build.ts), so that's where "thin" starts. */
export const THIN_VOTES = 5_000;

export function confidence(f: Film): Confidence {
  const sources = Object.keys(f.s).length;
  const votes = f.s.imdb?.n ?? 0;
  const lbVotes = f.s.letterboxd?.n ?? 0;
  const hasCritics = f.critics !== null;
  const hasAudience = f.audience !== null;
  if (f.score === null) {
    return { tier: "thin", label: "No score yet", detail: "Only one source has rated this so far, which isn't enough for a balanced score." };
  }
  if (votes < THIN_VOTES) {
    const n = votes ? `${votes.toLocaleString("en-US")} IMDb ratings` : "very few ratings";
    return {
      tier: "thin",
      label: "Thin data",
      detail: `Based on ${n}${lbVotes ? ` and ${lbVotes.toLocaleString("en-US")} on Letterboxd` : ""}. Treat the score as a rough read: a few hundred votes either way can move it.`,
    };
  }
  if (!hasCritics || !hasAudience || sources < 3) {
    return {
      tier: "limited",
      label: "One-sided",
      detail: !hasCritics
        ? "No critic score yet, so this is audience-only, nudged 10% toward the middle. A 100 needs both critics and audiences."
        : "Only critics have a score so far, so it is critic-only, nudged 10% toward the middle. A 100 needs both critics and audiences.",
    };
  }
  return { tier: "solid", label: "Solid", detail: `${sources} sources and ${votes.toLocaleString("en-US")} IMDb ratings behind it.` };
}
