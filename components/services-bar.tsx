"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SUBSCRIPTIONS, SUBS_COOKIE } from "@/lib/subscriptions";

// The service controls at the top of /watch, in one place:
// - With no services picked (or while editing), a "What do you have?" panel
//   where every subscription is a tap-to-toggle logo.
// - Once picked, that collapses to a single "Your services · Edit" button at
//   the start of the Browse row, so nothing shows twice.
// Picks live in a cookie so the server builds the page from free movies plus
// these services. Taps are batched briefly so picking three refreshes once.
const logo = (path: string) => `https://image.tmdb.org/t/p/w92${path}`;
const SAVE_DELAY_MS = 700;
const FREE_TABS_SHOWN = 5;

export type BrowseTab = { id: number; label: string; logo?: string; mine?: boolean };

function writeCookie(ids: number[]) {
  document.cookie = ids.length
    ? `${SUBS_COOKIE}=${ids.join("-")}; path=/; max-age=31536000; samesite=lax`
    : `${SUBS_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function ServicesBar({
  selected,
  tabs,
  active,
  total,
}: {
  selected: number[];
  tabs: BrowseTab[];
  active: number | null;
  total: number;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState(() => new Set(selected));
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function toggle(id: number) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
    writeCookie(SUBSCRIPTIONS.filter((s) => next.has(s.id)).map((s) => s.id));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => startTransition(() => router.refresh()), SAVE_DELAY_MS);
  }

  const mine = SUBSCRIPTIONS.filter((s) => picked.has(s.id));
  const expanded = editing || selected.length === 0;
  const own = tabs.filter((t) => t.mine);
  const free = tabs.filter((t) => !t.mine);
  // Keep the active free tab visible even when it's past the first few.
  const freeShown = showAll ? free : free.filter((t, i) => i < FREE_TABS_SHOWN || t.id === active);
  const hidden = free.length - freeShown.length;

  return (
    <div>
      {expanded && (
        <section aria-labelledby="services-heading" className="px-5 sm:px-10 lg:px-14">
          <div className="stream-panel rounded-3xl p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="services-heading" className="text-lg font-bold tracking-tight">
                What do you have?
              </h2>
              <div className="flex items-baseline gap-4">
                <p className="text-xs text-white/55 sm:text-sm">
                  {pending ? "Updating your movies…" : "Tap your services. Free ones like Tubi and Pluto are always included."}
                </p>
                {selected.length > 0 && (
                  <button onClick={() => setEditing(false)} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black">
                    Done
                  </button>
                )}
              </div>
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
      )}

      <nav aria-label="Filter by service" className="scroller flex items-center gap-2 overflow-x-auto px-5 py-3 sm:px-10 lg:px-14">
        {!expanded && (
          <>
            <button
              onClick={() => setEditing(true)}
              className="stream-glass flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold whitespace-nowrap"
              title="Change your services"
            >
              <span className="flex -space-x-2">
                {mine.slice(0, 4).map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={s.id} src={logo(s.logo)} alt="" className="h-6 w-6 rounded-full ring-2 ring-black" />
                ))}
              </span>
              Your services
              <span className="text-xs font-medium text-white/50">Edit</span>
            </button>
            <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-white/15" />
          </>
        )}
        <Tab href="/watch" label={selected.length ? "All" : "All free"} active={active === null} count={total} />
        {own.map((t) => (
          <Tab key={t.id} href={`/watch?service=${t.id}`} label={t.label} logo={t.logo} active={active === t.id} />
        ))}
        {own.length > 0 && <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-white/15" />}
        {freeShown.map((t) => (
          <Tab key={t.id} href={`/watch?service=${t.id}`} label={t.label} logo={t.logo} active={active === t.id} />
        ))}
        {hidden > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white/60 hover:text-white"
          >
            + {hidden} more free
          </button>
        )}
      </nav>
    </div>
  );
}

function Tab({ href, label, logo: logoPath, active, count }: { href: string; label: string; logo?: string; active: boolean; count?: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-4 text-sm font-medium whitespace-nowrap transition ${
        logoPath ? "pl-1.5" : "pl-4"
      } ${active ? "bg-white text-black" : "bg-white/[0.07] text-white/80 hover:bg-white/15 hover:text-white"}`}
    >
      {logoPath && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo(logoPath)} alt="" className="h-6 w-6 rounded-full" />
      )}
      {label}
      {count !== undefined && active && <span className="text-black/50 tabular-nums">{count.toLocaleString()}</span>}
    </Link>
  );
}
