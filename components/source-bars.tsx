import { SOURCES } from "@/lib/sources";
import type { Film } from "@/lib/types";
import { fmtCount } from "@/lib/verdict";
import { Sparkline } from "./sparkline";

const HISTORY_INDEX = { letterboxd: 1, imdb: 2, rt: 3, metacritic: 4 } as const;

/**
 * Every source on one shared 0–100 scale (percentile within that site), with
 * the raw score kept as the label. The vertical line is the balanced score.
 */
export function SourceBars({ film }: { film: Film }) {
  return (
    <div className="space-y-1">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-wider text-text-3">
        <span>Source</span>
        <span className="hidden sm:inline">Rank among all films on that site</span>
      </div>
      {SOURCES.map((src) => {
        const s = film.s[src.key];
        const histIdx = HISTORY_INDEX[src.key as keyof typeof HISTORY_INDEX];
        const trail = film.h && histIdx ? film.h.map((row) => row[histIdx]).filter((v): v is number => v !== null) : [];
        return (
          <div key={src.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-lg px-2 py-2.5 sm:grid-cols-[13rem_1fr_3rem]">
            <a
              href={src.url(film)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-2 hover:underline"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: src.color }} />
              <span className="text-sm">{src.name}</span>
              <span className="text-xs text-text-3">{src.kind === "critics" ? "critics" : ""}</span>
            </a>
            <div className="text-right sm:order-last">
              {s ? (
                <span className="tabular text-sm font-semibold">{Math.round(s.p)}</span>
              ) : (
                <span className="text-xs text-text-3">—</span>
              )}
            </div>
            <div className="col-span-2 sm:col-span-1">
              {s ? (
                <div className="flex items-center gap-3">
                  <div className="relative h-2 flex-1 rounded-full bg-surface-2" title={`${src.name}: ${src.format(s.v)}, better than ${Math.round(s.p)}% of films on ${src.name}`}>
                    <div className="absolute inset-y-0 left-0 rounded-full opacity-35" style={{ width: `${s.p}%`, background: src.color }} />
                    <div
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]"
                      style={{ left: `${s.p}%`, background: src.color }}
                    />
                    {film.score !== null && (
                      <div className="absolute -top-1.5 -bottom-1.5 w-0.5 -translate-x-1/2 rounded bg-text/70" style={{ left: `${film.score}%` }} />
                    )}
                  </div>
                  <div className="w-24 shrink-0 text-right text-xs text-text-2 tabular">
                    {src.format(s.v)}
                    {s.n ? <span className="block text-text-3">{fmtCount(s.n)} ratings</span> : null}
                  </div>
                  {trail.length > 1 && <Sparkline values={trail} color={src.color} />}
                </div>
              ) : (
                <div className="text-xs text-text-3">Not collected yet</div>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-2 px-2 pt-2 text-xs text-text-3">
        <span className="inline-block h-3 w-0.5 rounded bg-text/70" /> Balanced score
      </div>
    </div>
  );
}
