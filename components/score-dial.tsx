"use client";

import { useSyncExternalStore } from "react";
import type { Film } from "@/lib/types";
import { agreement, scoreLabel } from "@/lib/verdict";
import { ScoreBadge } from "./score-badge";

const STORAGE_KEY = "consensus-critic-weight";
const CHANGE = "consensus-dial-change";
const DEFAULT_WEIGHT = 50;

const MODELS = [
  { name: "Balanced", weight: 50, blurb: "Half critics, half audiences" },
  { name: "Critics-led", weight: 70, blurb: "70% critics, 30% audiences" },
  { name: "Audience-led", weight: 30, blurb: "30% critics, 70% audiences" },
];

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}

function read() {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    if (localStorage.getItem(STORAGE_KEY) !== null && Number.isFinite(n)) return Math.min(100, Math.max(0, Math.round(n)));
  } catch {}
  return DEFAULT_WEIGHT;
}

function setWeight(w: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(w));
  } catch {}
  window.dispatchEvent(new Event(CHANGE));
}

/** Re-weights the consensus. At 50 this is exactly the published balanced score. */
function weighted(film: Film, criticWeight: number) {
  const { audience, critics } = film;
  if (criticWeight === DEFAULT_WEIGHT) return film.score;
  if (audience !== null && critics !== null) {
    return Math.round((critics * criticWeight + audience * (100 - criticWeight)) / 100);
  }
  return audience ?? critics;
}

/** The big score on the film page, with the critic/audience weight dial under it. */
export function ScoreDial({ film }: { film: Film }) {
  const weight = useSyncExternalStore(subscribe, read, () => DEFAULT_WEIGHT);
  const score = weighted(film, weight);
  const both = film.audience !== null && film.critics !== null;
  const agree = agreement(film.spread);
  const model = MODELS.find((m) => m.weight === weight);
  const title = model ? `${model.name} score` : "Custom score";

  return (
    <div className="mt-6 sm:mt-8">
      <div className="flex items-center gap-4">
        <ScoreBadge score={score} size="lg" />
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-3">{title}</div>
          <div className="text-xl">{scoreLabel(score)}</div>
          <div className={`mt-1 text-sm ${agree.tone === "split" ? "text-[var(--src-rt)]" : "text-text-2"}`}>
            {agree.label}
            {film.spread !== null && <span className="text-text-3"> · {film.spread} pt spread</span>}
          </div>
          <div className="tabular mt-1 text-xs text-text-3">
            Audiences {film.audience ?? "—"} · Critics {film.critics ?? "—"}
            {both && ` · ${weight}% critics, ${100 - weight}% audiences`}
          </div>
        </div>
      </div>

      {both && (
        <div className="mt-5 max-w-md">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] uppercase tracking-wider text-text-3">Score model</span>
            <div role="tablist" aria-label="Score model" className="scroller flex min-w-0 gap-1 overflow-x-auto py-1">
              {MODELS.map((m) => (
                <button
                  key={m.name}
                  role="tab"
                  aria-selected={weight === m.weight}
                  title={m.blurb}
                  onClick={() => setWeight(m.weight)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs whitespace-nowrap transition ${
                    weight === m.weight ? "bg-text text-bg" : "text-text-2 hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-text-3">
            <span>Audiences</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              aria-label="Critic weight, percent"
              className="min-w-0 flex-1 accent-[var(--ring)]"
            />
            <span>Critics</span>
          </div>
          <p className="mt-1 text-xs text-text-3">Slide toward critics or audiences to re-weight the consensus.</p>
        </div>
      )}
    </div>
  );
}
