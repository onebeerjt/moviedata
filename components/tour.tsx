"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SOURCES } from "@/lib/sources";

// A quick walkthrough of how to read the site. Visuals are small mock-ups
// built from the same colors as the real pages, so they match every design.
const EXAMPLE_FILM = "/film/tt0111161";

const STEPS: { title: string; body: string; visual: React.ReactNode; link?: { href: string; label: string } }[] = [
  {
    title: "One score from five sites",
    body: "Every film gets a single balanced score from 0 to 100. The ring fills up as the score goes up, and the word underneath tells you what it means at a glance.",
    visual: <Ring score={87} label="Great" />,
  },
  {
    title: "Every source on one scale",
    body: "Each site rates differently: Letterboxd out of 5, IMDb out of 10, Rotten Tomatoes as a percent. We show how a film ranks against everything else on that site, so they finally line up. The raw score is still right there.",
    visual: <Bars />,
  },
  {
    title: "See where they disagree",
    body: "Critics and audiences don't always agree. When the sources are far apart, the film page says so and tells you who likes it more. The homepage collects the biggest splits.",
    visual: <Split />,
    link: { href: EXAMPLE_FILM, label: "Open an example film" },
  },
  {
    title: "Explore and Insights",
    body: "Explore plots every film one site against another, so the outliers jump out. Insights shows which genres, decades and directors each site loves or underrates.",
    visual: <Dots />,
    link: { href: "/explore", label: "Open Explore" },
  },
  {
    title: "Pick a look",
    body: "The tabs at the top switch the whole site between five designs. Same data, different vibe. Your pick is remembered on this device. Search works from any page: try a movie, director or actor.",
    visual: <Tabs />,
  },
];

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, STEPS.length - 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="tour fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        onClick={(e) => e.stopPropagation()}
        className="tour-card w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-text-3">
          <span>
            Tour · {i + 1} of {STEPS.length}
          </span>
          <button onClick={onClose} aria-label="Close tour" className="px-1 text-base leading-none hover:text-text">
            ×
          </button>
        </div>
        <div className="mt-5 flex h-28 items-center justify-center rounded-xl bg-surface-2">{step.visual}</div>
        <h2 id="tour-title" className="font-display mt-5 text-3xl leading-tight">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-2">{step.body}</p>
        {step.link && (
          <Link href={step.link.href} onClick={onClose} className="mt-3 inline-block text-sm text-text underline underline-offset-4">
            {step.link.label} →
          </Link>
        )}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, n) => (
              <button
                key={n}
                onClick={() => setI(n)}
                aria-label={`Step ${n + 1}`}
                className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-text" : "w-1.5 bg-line"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <button onClick={() => setI(i - 1)} className="rounded-full px-4 py-2 text-sm text-text-2 hover:text-text">
                Back
              </button>
            )}
            <button
              onClick={() => (last ? onClose() : setI(i + 1))}
              className="rounded-full bg-text px-4 py-2 text-sm font-medium text-bg"
            >
              {last ? "Start exploring" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Ring({ score, label }: { score: number; label: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[68px] w-[68px]">
        <svg width="68" height="68" className="-rotate-90">
          <circle cx="34" cy="34" r={r} fill="none" stroke="var(--neutral)" strokeWidth="5" />
          <circle
            cx="34"
            cy="34"
            r={r}
            fill="none"
            stroke="var(--ring)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * c} ${c}`}
          />
        </svg>
        <div className="tabular absolute inset-0 flex items-center justify-center text-xl font-semibold">{score}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-text-3">Balanced score</div>
        <div className="text-lg">{label}</div>
      </div>
    </div>
  );
}

function Bars() {
  const ranks = [91, 84, 79, 72, 88];
  return (
    <div className="w-56 space-y-1.5">
      {SOURCES.map((s, n) => (
        <div key={s.key} className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
          <span className="w-16 truncate text-[10px] text-text-2">{s.name}</span>
          <div className="relative h-1.5 flex-1 rounded-full bg-[var(--neutral)]">
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${ranks[n]}%`, background: s.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Split() {
  return (
    <div className="flex items-end gap-6">
      {[
        { label: "Critics", v: 92, color: "var(--src-rt)" },
        { label: "Audiences", v: 48, color: "var(--src-imdb)" },
      ].map((b) => (
        <div key={b.label} className="flex flex-col items-center gap-1">
          <span className="tabular text-sm font-semibold">{b.v}</span>
          <div className="w-10 rounded-t" style={{ height: b.v * 0.6, background: b.color }} />
          <span className="text-[10px] text-text-3">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function Dots() {
  // A fixed little scatter: most films along the diagonal, a few outliers.
  const pts = [
    [10, 14], [18, 22], [26, 24], [34, 38], [42, 40], [50, 54], [58, 56], [66, 70], [74, 72], [82, 86], [90, 88],
    [30, 70], [72, 28],
  ];
  return (
    <svg width="160" height="96" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <line x1="0" y1="100" x2="100" y2="0" stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y], n) => (
        <circle
          key={n}
          cx={x}
          cy={100 - y}
          r="3.5"
          fill={n === 11 ? "var(--src-letterboxd)" : n === 12 ? "var(--src-imdb)" : "var(--text-3)"}
        />
      ))}
    </svg>
  );
}

function Tabs() {
  return (
    <div className="flex flex-wrap justify-center gap-1 px-4">
      {["Cinema", "Broadsheet", "Marquee", "Rewind", "Index"].map((t, n) => (
        <span key={t} className={`rounded-full px-2.5 py-1 text-[11px] ${n === 0 ? "bg-text text-bg" : "border border-line text-text-2"}`}>
          {t}
        </span>
      ))}
    </div>
  );
}
