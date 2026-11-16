import Link from "next/link";
import { quadDensity } from "@/lib/stories";

const Q = ["canon", "ydarling", "xdarling", "bomb"] as const;

/** A small, server-drawn picture of the Quad on the front page; links to the real thing. */
export function QuadTeaser() {
  const { cells, bins, counts, total, max } = quadDensity();
  if (!total) return null;
  const cell = 10;
  const names = ["The Canon", "Critics' darlings", "Crowd pleasers", "Bomb zone"];
  return (
    <section>
      <Link href="/explore" className="group grid gap-5 rounded-3xl border border-line bg-surface p-5 transition hover:bg-surface-2 sm:grid-cols-[18rem_1fr] sm:items-center sm:p-6">
        <svg viewBox={`0 0 ${bins * cell} ${bins * cell}`} role="img" aria-label={`Density of ${total.toLocaleString("en-US")} films, audiences against critics`} className="w-full max-w-[18rem] rounded-xl">
          {cells.map((n, i) => {
            if (!n) return null;
            const x = i % bins;
            const y = Math.floor(i / bins);
            const hiA = x >= bins / 2;
            const hiC = y >= bins / 2;
            const q = hiC ? (hiA ? 0 : 1) : hiA ? 2 : 3;
            return <rect key={i} x={x * cell} y={(bins - 1 - y) * cell} width={cell - 0.6} height={cell - 0.6} rx={1.5} fill={`var(--quad-${Q[q]})`} opacity={0.18 + 0.82 * Math.sqrt(n / max)} />;
          })}
          <line x1={(bins * cell) / 2} x2={(bins * cell) / 2} y1={0} y2={bins * cell} stroke="var(--text-3)" strokeDasharray="3 3" />
          <line y1={(bins * cell) / 2} y2={(bins * cell) / 2} x1={0} x2={bins * cell} stroke="var(--text-3)" strokeDasharray="3 3" />
        </svg>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-3">New · Explore</div>
          <h2 className="font-display mt-1 text-4xl sm:text-5xl">
            The Quad <span className="inline-block text-3xl transition group-hover:translate-x-1">→</span>
          </h2>
          <p className="mt-2 max-w-md text-text-2">
            {total.toLocaleString("en-US")} films, critics against audiences. Find the critics&apos; darlings, the crowd pleasers and the canon, then filter by decade and genre.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[1, 0, 3, 2].map((q) => (
              <div key={q} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(--quad-${Q[q]})` }} />
                <span className="text-text-2">{names[q]}</span>
                <span className="tabular ml-auto font-semibold">{counts[q].toLocaleString("en-US")}</span>
              </div>
            ))}
          </div>
        </div>
      </Link>
    </section>
  );
}
