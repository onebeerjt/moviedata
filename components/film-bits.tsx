import Link from "next/link";
import { posterUrl } from "@/lib/data";
import { SOURCE, SOURCES } from "@/lib/sources";
import type { Film, SourceKey } from "@/lib/types";
import { scoreLabel } from "@/lib/verdict";

/** Poster from TMDB, or a typographic stand-in when we don't have one. */
export function Poster({ film, size = "w342", className = "" }: { film: Film; size?: "w185" | "w342" | "w500"; className?: string }) {
  // Thumbnails are too small for the typographic stand-in, so they get just the gradient.
  const thumb = size === "w185";
  const src = posterUrl(film.poster, size);
  const hue = [...film.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${film.title} poster`} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full flex-col justify-end p-3"
          style={{ background: `linear-gradient(160deg, hsl(${hue} 25% 22%), hsl(${(hue + 40) % 360} 20% 10%))` }}
        >
          {!thumb && (
            <>
              <div className="font-display text-lg leading-tight text-text">{film.title}</div>
              <div className="mt-1 text-xs text-text-2">{film.year}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The balanced score as a big number with a ring showing 0–100. */
export function ScoreBadge({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? 112 : size === "md" ? 56 : 40;
  const stroke = size === "lg" ? 6 : 4;
  const r = (px - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: px, height: px }} aria-label={`Balanced score ${score ?? "unavailable"}`}>
      <svg width={px} height={px} className="-rotate-90">
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="var(--neutral)" strokeWidth={stroke} />
        {score !== null && (
          <circle
            cx={px / 2}
            cy={px / 2}
            r={r}
            fill="none"
            stroke="var(--text)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * c} ${c}`}
          />
        )}
      </svg>
      <div
        className={`tabular absolute inset-0 flex items-center justify-center font-semibold ${
          size === "lg" ? "text-4xl" : size === "md" ? "text-lg" : "text-sm"
        }`}
      >
        {score ?? "–"}
      </div>
    </div>
  );
}

export function SourceDot({ k }: { k: SourceKey }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SOURCE[k].color }} />;
}

/** Compact poster card used in rails and grids. */
export function FilmCard({ film, note }: { film: Film; note?: React.ReactNode }) {
  return (
    <Link href={`/film/${film.id}`} className="group block w-36 shrink-0 sm:w-40">
      <div className="relative">
        <Poster film={film} className="transition group-hover:brightness-110" />
        <div className="absolute bottom-2 right-2 rounded-full bg-bg/90 p-0.5">
          <ScoreBadge score={film.score} size="sm" />
        </div>
      </div>
      <div className="mt-2 truncate text-sm">{film.title}</div>
      <div className="text-xs text-text-3">
        {film.year} {note && <>· {note}</>}
      </div>
    </Link>
  );
}

/** Row used in "biggest split" lists: two sources' raw scores side by side. */
export function SplitRow({ film, a, b }: { film: Film; a: SourceKey; b: SourceKey }) {
  const sa = film.s[a];
  const sb = film.s[b];
  if (!sa || !sb) return null;
  const gap = Math.round(sa.p - sb.p);
  return (
    <Link href={`/film/${film.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
      <Poster film={film} size="w185" className="w-10 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{film.title}</div>
        <div className="flex gap-3 text-xs text-text-3">
          <span className="flex items-center gap-1">
            <SourceDot k={a} /> {SOURCE[a].format(sa.v)}
          </span>
          <span className="flex items-center gap-1">
            <SourceDot k={b} /> {SOURCE[b].format(sb.v)}
          </span>
        </div>
      </div>
      <div className="tabular text-right text-sm font-semibold">
        {gap > 0 ? "+" : ""}
        {gap}
      </div>
    </Link>
  );
}

export function ScoreWord({ score }: { score: number | null }) {
  return <span className="text-text-2">{scoreLabel(score)}</span>;
}

export { SOURCES };
