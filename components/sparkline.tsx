/** Tiny trend line of a source's raw score over recent days. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 48;
  const h = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`).join(" ");
  const delta = values[values.length - 1] - values[0];
  return (
    <svg width={w} height={h} className="shrink-0" aria-label={`Trend: ${delta >= 0 ? "up" : "down"} ${Math.abs(delta).toFixed(2)}`}>
      <title>{`${values[0]} → ${values[values.length - 1]} over ${values.length} days`}</title>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
