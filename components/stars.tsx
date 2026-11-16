"use client";

/** Half-star rating input. value is 0–10 (half-stars ×2); tap the left half of a star for a half. */
export function Stars({ value, onChange, size = 28 }: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Your rating"
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value / 2}
      aria-valuetext={value ? `${value / 2} stars` : "not rated"}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") (e.preventDefault(), onChange(Math.min(10, value + 1)));
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") (e.preventDefault(), onChange(Math.max(1, value - 1)));
      }}
      className="inline-flex touch-manipulation select-none rounded outline-offset-2"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.min(1, Math.max(0, (value - (n - 1) * 2) / 2));
        return (
          <button
            key={n}
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const half = e.clientX - r.left < r.width / 2;
              onChange(n * 2 - (half ? 1 : 0));
            }}
            style={{ width: size, height: size }}
            className="relative shrink-0"
          >
            <svg viewBox="0 0 24 24" width={size} height={size} className="absolute inset-0">
              <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="none" stroke="var(--text-3)" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            <svg viewBox="0 0 24 24" width={size} height={size} className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }}>
              <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="var(--text)" stroke="var(--text)" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
