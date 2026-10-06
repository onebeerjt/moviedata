"use client";

import { useState, useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, type ThemeId } from "@/lib/themes";
import { Tour } from "./tour";

const CHANGE = "consensus-theme-change";
const TOURED_KEY = "consensus-toured";

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  return () => window.removeEventListener(CHANGE, cb);
}
const current = () => (document.documentElement.dataset.theme as ThemeId) || DEFAULT_THEME;

function setTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {}
  window.dispatchEvent(new Event(CHANGE));
}

function readToured() {
  try {
    return localStorage.getItem(TOURED_KEY) === "1";
  } catch {
    return true;
  }
}

/** Design switcher across the top of every page, plus the tour button. */
export function ThemeTabs() {
  const theme = useSyncExternalStore(subscribe, current, () => DEFAULT_THEME);
  // The tour button glows until someone has opened it once.
  const toured = useSyncExternalStore(subscribe, readToured, () => true);
  const [tourOpen, setTourOpen] = useState(false);

  function openTour() {
    setTourOpen(true);
    try {
      localStorage.setItem(TOURED_KEY, "1");
    } catch {}
    window.dispatchEvent(new Event(CHANGE));
  }

  return (
    <>
      <div className="theme-bar border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4">
          <span className="hidden shrink-0 text-[11px] uppercase tracking-wider text-text-3 sm:inline">Design</span>
          <div role="tablist" aria-label="Site design" className="scroller flex min-w-0 flex-1 gap-1 overflow-x-auto py-1.5">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={theme === t.id}
                title={t.blurb}
                onClick={() => setTheme(t.id)}
                className={`theme-tab shrink-0 rounded-full px-3 py-1 text-xs whitespace-nowrap transition ${
                  theme === t.id ? "bg-text text-bg" : "text-text-2 hover:bg-surface-2 hover:text-text"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <button
            onClick={openTour}
            className={`tour-button shrink-0 rounded-full border border-line px-3 py-1 text-xs text-text hover:bg-surface-2 ${
              toured ? "" : "tour-new"
            }`}
          >
            ? Tour
          </button>
        </div>
      </div>
      {tourOpen && <Tour onClose={() => setTourOpen(false)} />}
    </>
  );
}
