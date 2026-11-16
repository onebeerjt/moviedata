import { SOURCES } from "@/lib/sources";
import type { Film } from "@/lib/types";

/** Every source as a dot on one 0–100 track: the film's disagreement profile at a glance. */
export function SplitStrip({ film, className = "" }: { film: Film; className?: string }) {
  return (
    <div className={`relative h-2.5 rounded-full bg-surface-2 ${className}`} aria-hidden>
      {film.score !== null && <div className="absolute -bottom-0.5 -top-0.5 w-0.5 -translate-x-1/2 rounded bg-text/70" style={{ left: `${film.score}%` }} />}
      {SOURCES.map((s) => {
        const x = film.s[s.key];
        return x ? (
          <span key={s.key} className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-[var(--surface)]" style={{ left: `${x.p}%`, background: s.color }} />
        ) : null;
      })}
    </div>
  );
}
