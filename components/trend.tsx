import Link from "next/link";
import type { Film } from "@/lib/types";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const RECENT = 5;
const W = 640;
const H = 220;
const PAD = { l: 34, r: 12, t: 12, b: 26 };

/**
 * A career's critics-vs-audience lean, film by film, plus whose stock is moving:
 * the last five films against everything before them.
 */
export function Trend({ films, name }: { films: Film[]; name: string }) {
  const rows = films
    .filter((f) => f.year && f.critics !== null && f.audience !== null)
    .sort((a, b) => a.year! - b.year!);
  if (rows.length < 6) return null;
  const recent = rows.slice(-RECENT);
  const before = rows.slice(0, -RECENT);
  const dC = mean(recent.map((f) => f.critics!))! - mean(before.map((f) => f.critics!))!;
  const dA = mean(recent.map((f) => f.audience!))! - mean(before.map((f) => f.audience!))!;
  const arrow = (d: number) => (Math.abs(d) < 3 ? "▬" : d > 0 ? "▲" : "▼");
  const tone = (d: number) => (Math.abs(d) < 3 ? "text-text-3" : d > 0 ? "text-[var(--quad-canon)]" : "text-[var(--quad-bomb)]");

  const y0 = rows[0].year!;
  const y1 = rows[rows.length - 1].year!;
  const span = Math.max(1, y1 - y0);
  const gaps = rows.map((f) => f.critics! - f.audience!);
  const max = Math.max(30, ...gaps.map(Math.abs));
  const sx = (y: number) => PAD.l + ((y - y0) / span) * (W - PAD.l - PAD.r);
  const sy = (g: number) => PAD.t + (1 - (g + max) / (2 * max)) * (H - PAD.t - PAD.b);
  const avg = mean(gaps)!;

  return (
    <section className="mt-10 rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-label="Career lean">
      <h2 className="text-lg font-semibold">Critics vs audiences, across the career</h2>
      <p className="mb-4 text-sm text-text-2">
        Each dot is a film: above the line, critics rank it higher than audiences do; below, audiences do. Dots link to the film.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${name}: critic minus audience score for each film by year. Average ${avg > 0 ? "+" : ""}${Math.round(avg)}.`}>
        <line x1={PAD.l} x2={W - PAD.r} y1={sy(0)} y2={sy(0)} stroke="var(--text-3)" strokeDasharray="4 4" />
        <line x1={PAD.l} x2={W - PAD.r} y1={sy(avg)} y2={sy(avg)} stroke="var(--text-2)" strokeWidth={1.5} opacity={0.5} />
        <text x={W - PAD.r} y={sy(avg) - 5} textAnchor="end" fontSize="13" fill="var(--text-2)">career average {avg > 0 ? "+" : ""}{Math.round(avg)}</text>
        <text x={PAD.l - 4} y={PAD.t + 8} textAnchor="end" fontSize="13" fill="var(--text-3)">+{max}</text>
        <text x={PAD.l - 4} y={sy(0) + 3} textAnchor="end" fontSize="13" fill="var(--text-3)">0</text>
        <text x={PAD.l - 4} y={H - PAD.b} textAnchor="end" fontSize="13" fill="var(--text-3)">−{max}</text>
        <text x={PAD.l} y={H - 8} fontSize="13" fill="var(--text-3)">{y0}</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="13" fill="var(--text-3)">{y1}</text>
        <text x={PAD.l + 6} y={PAD.t + 10} fontSize="13" fill="var(--quad-ydarling)">critics higher</text>
        <text x={PAD.l + 6} y={H - PAD.b - 6} fontSize="13" fill="var(--quad-xdarling)">audiences higher</text>
        {rows.map((f, i) => (
          <Link key={f.id} href={`/film/${f.id}`}>
            <circle cx={sx(f.year!)} cy={sy(gaps[i])} r={14} fill="transparent" />
            <circle cx={sx(f.year!)} cy={sy(gaps[i])} r={5} fill={gaps[i] >= 0 ? "var(--quad-ydarling)" : "var(--quad-xdarling)"} stroke="var(--surface)" strokeWidth={1.5}>
              <title>{`${f.title} (${f.year}): critics ${f.critics}, audiences ${f.audience}`}</title>
            </circle>
          </Link>
        ))}
      </svg>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-3">Stock with critics</div>
          <div className={`tabular text-2xl font-semibold ${tone(dC)}`}>
            {arrow(dC)} {dC > 0 ? "+" : ""}{Math.round(dC)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-3">Stock with audiences</div>
          <div className={`tabular text-2xl font-semibold ${tone(dA)}`}>
            {arrow(dA)} {dA > 0 ? "+" : ""}{Math.round(dA)}
          </div>
        </div>
        <p className="col-span-2 text-xs text-text-3">
          Average score of the last {RECENT} films ({recent[0].year}–{recent[recent.length - 1].year}) compared with the {before.length} before them, in percentile points. This is career trajectory from release years, not a day-by-day tracker.
        </p>
      </div>
    </section>
  );
}
