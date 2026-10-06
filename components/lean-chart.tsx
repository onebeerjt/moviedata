import Link from "next/link";

export type LeanRow = { key: string; label: string; value: number; n: number; href?: string };

/**
 * Diverging bars around zero: right = the "positive" side ranks the group higher,
 * left = the "negative" side does. Each pole wears its source's color.
 */
export function LeanChart({
  rows,
  pos,
  neg,
}: {
  rows: LeanRow[];
  pos: { label: string; color: string };
  neg: { label: string; color: string };
}) {
  const max = Math.max(10, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div>
      <div className="mb-3 grid grid-cols-[minmax(6rem,9rem)_1fr_3rem] gap-3 text-[11px] uppercase tracking-wider text-text-3">
        <span />
        <div className="flex justify-between">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: neg.color }} />
            {neg.label}
          </span>
          <span className="flex items-center gap-1.5">
            {pos.label}
            <span className="h-2 w-2 rounded-full" style={{ background: pos.color }} />
          </span>
        </div>
        <span />
      </div>
      <div className="space-y-0.5">
        {rows.map((r) => {
          const w = (Math.abs(r.value) / max) * 50;
          const label = r.href ? (
            <Link href={r.href} className="truncate hover:underline">
              {r.label}
            </Link>
          ) : (
            <span className="truncate">{r.label}</span>
          );
          return (
            <div
              key={r.key}
              className="grid grid-cols-[minmax(6rem,9rem)_1fr_3rem] items-center gap-3 rounded px-0 py-1 text-sm hover:bg-surface-2"
              title={`${r.label}: ${r.value > 0 ? pos.label : neg.label} by ${Math.abs(r.value).toFixed(1)} pts on average (${r.n} films)`}
            >
              {label}
              <div className="relative h-4">
                <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--text-3)]" />
                <div
                  className={`absolute inset-y-0.5 ${r.value >= 0 ? "rounded-r" : "rounded-l"}`}
                  style={{
                    background: r.value >= 0 ? pos.color : neg.color,
                    left: r.value >= 0 ? "50%" : `${50 - w}%`,
                    width: `${w}%`,
                  }}
                />
              </div>
              <span className="tabular text-right text-text-2">
                {r.value > 0 ? "+" : ""}
                {r.value.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
