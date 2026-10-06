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
            stroke="var(--ring)"
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
