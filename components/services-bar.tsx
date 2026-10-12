"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SUBSCRIPTIONS, SUBS_COOKIE } from "@/lib/subscriptions";

// The "What do you have?" bar at the top of /watch: every subscription service
// as a tap-to-toggle logo. Picks live in a cookie so the server builds the page
// from free movies plus these services. Taps are batched briefly so picking
// three services refreshes the page once.
const logo = (path: string) => `https://image.tmdb.org/t/p/w92${path}`;
const SAVE_DELAY_MS = 700;

function writeCookie(ids: number[]) {
  document.cookie = ids.length
    ? `${SUBS_COOKIE}=${ids.join("-")}; path=/; max-age=31536000; samesite=lax`
    : `${SUBS_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function ServicesBar({ selected }: { selected: number[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState(() => new Set(selected));
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function toggle(id: number) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
    writeCookie(SUBSCRIPTIONS.filter((s) => next.has(s.id)).map((s) => s.id));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => startTransition(() => router.refresh()), SAVE_DELAY_MS);
  }

  const count = picked.size;
  return (
    <section aria-labelledby="services-heading" className="px-5 sm:px-10 lg:px-14">
      <div className="stream-panel rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="services-heading" className="text-lg font-bold tracking-tight sm:text-xl">
            What do you have?
          </h2>
          <p className="text-xs text-white/55 sm:text-sm">
            {pending
              ? "Updating your movies…"
              : count
                ? `Showing free movies + ${count} service${count > 1 ? "s" : ""} you have`
                : "Tap your services. Free ones like Tubi, Pluto and Plex are always included."}
          </p>
        </div>
        <div className="scroller -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {SUBSCRIPTIONS.map((s) => {
            const on = picked.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                aria-pressed={on}
                className={`group flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold whitespace-nowrap transition active:scale-95 ${
                  on ? "bg-white text-black" : "bg-white/[0.07] text-white/75 hover:bg-white/15 hover:text-white"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo(s.logo)} alt="" className={`h-7 w-7 rounded-full transition ${on ? "" : "opacity-75 group-hover:opacity-100"}`} />
                {s.name}
                <span aria-hidden className={`text-xs ${on ? "text-black/60" : "text-white/35"}`}>
                  {on ? "✓" : "+"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
