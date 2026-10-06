import type { Film } from "./types";

export function agreement(spread: number | null) {
  if (spread === null) return { label: "One source so far", tone: "muted" as const };
  if (spread <= 12) return { label: "Strong agreement", tone: "agree" as const };
  if (spread <= 25) return { label: "Mostly agree", tone: "agree" as const };
  if (spread <= 40) return { label: "Mixed reactions", tone: "mixed" as const };
  return { label: "Split verdict", tone: "split" as const };
}

/** Plain-English notes about where the sources disagree. */
export function notes(f: Film): string[] {
  const out: string[] = [];
  const { letterboxd: lb, imdb } = f.s;
  if (lb && imdb) {
    const d = Math.round(lb.p - imdb.p);
    if (d >= 15) out.push(`Letterboxd users rank this ${d} points higher than IMDb users do.`);
    else if (d <= -15) out.push(`IMDb users rank this ${-d} points higher than Letterboxd users do.`);
  }
  if (f.critics !== null && f.audience !== null) {
    const d = f.critics - f.audience;
    if (d >= 15) out.push(`Critics like this more than audiences (+${d}).`);
    else if (d <= -15) out.push(`Audiences like this more than critics (+${-d}).`);
  }
  const votes = Math.max(imdb?.n ?? 0, lb?.n ?? 0);
  if (votes && votes < 5000) out.push("Early days: fewer than 5,000 ratings, so expect these numbers to move.");
  if (!out.length && f.spread !== null && f.spread <= 12) out.push("Every source lands in the same place on this one.");
  return out;
}

export function scoreLabel(score: number | null) {
  if (score === null) return "Not enough data";
  if (score >= 90) return "Essential";
  if (score >= 75) return "Great";
  if (score >= 55) return "Good";
  if (score >= 35) return "Mixed";
  return "Poor";
}

export const fmtCount = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
