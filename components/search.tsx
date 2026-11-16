"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadLite, loadPeople, loadPosters, nmId, posterSrc, ttId, type Lite } from "@/lib/lite";
import { makeSearcher, type Searcher } from "@/lib/search";

type FilmHit = { kind: "film"; id: string; title: string; year: number; score: number; votes: number; poster?: string };
type PersonHit = { kind: "person"; id: string; name: string; role: string; count: number };
type Hit = FilmHit | PersonHit;

/** Fallback while the index downloads: the server search, same shape as the local one. */
type ApiResults = {
  films: { id: string; title: string; year: number | null; score: number | null; poster?: string }[];
  people: { id: string; name: string; role: string; count: number }[];
};

export function Search({ autoFocus = false, large = false }: { autoFocus?: boolean; large?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [engine, setEngine] = useState<{ lite: Lite; searcher: Searcher; people: [number, string, number, number][] } | null>(null);
  const [posters, setPosters] = useState<string[] | null>(null);
  const [remote, setRemote] = useState<ApiResults | null>(null);
  const [dropTop, setDropTop] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  // Download the catalog the first time anyone touches search.
  const warm = useCallback(() => {
    if (started.current) return;
    started.current = true;
    Promise.all([loadLite(), loadPeople()])
      .then(([lite, people]) => setEngine({ lite, people, searcher: makeSearcher(lite, people) }))
      .catch(() => (started.current = false));
    loadPosters().then(setPosters, () => {});
  }, []);

  useEffect(() => {
    if (autoFocus) warm();
  }, [autoFocus, warm]);

  // "/" or ⌘K / Ctrl+K jumps to search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey)) {
        // Only the search box that's visible answers (the header has one, the home page has a second).
        if (!input.current || input.current.offsetParent === null) return;
        if (!large && document.querySelector(".hero-search")) return;
        e.preventDefault();
        input.current.focus();
        input.current.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [large]);

  useEffect(() => {
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const trimmed = q.trim();

  // Server fallback until the local index is ready.
  useEffect(() => {
    if (engine || trimmed.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then(setRemote)
        .catch(() => {});
    }, 100);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, engine, trimmed]);

  const hits: Hit[] = useMemo(() => {
    if (!trimmed) return [];
    if (engine) {
      const { lite, searcher, people } = engine;
      const films: Hit[] = searcher.films(trimmed, 6).map((i) => ({
        kind: "film",
        id: ttId(lite.id[i]),
        title: lite.t[i],
        year: lite.yr[i],
        score: lite.sc[i],
        votes: lite.v[i],
        poster: posterSrc(posters?.[i], "w92"),
      }));
      const ppl: Hit[] = searcher.people(trimmed, 3).map((i) => ({
        kind: "person",
        id: nmId(people[i][0]),
        name: people[i][1],
        role: people[i][2] >= people[i][3] ? "Director" : "Actor",
        count: people[i][2] + people[i][3],
      }));
      return [...films, ...ppl];
    }
    if (!remote || trimmed.length < 2) return [];
    return [
      ...remote.films.map((f): Hit => ({ kind: "film", id: f.id, title: f.title, year: f.year ?? 0, score: f.score ?? -1, votes: 0, poster: f.poster })),
      ...remote.people.map((p): Hit => ({ kind: "person", ...p })),
    ];
  }, [trimmed, engine, posters, remote]);

  const href = (h: Hit) => (h.kind === "film" ? `/film/${h.id}` : `/person/${h.id}`);
  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    input.current?.blur();
    router.push(href(h));
  };

  const showing = open && trimmed.length >= 1;
  const films = hits.filter((h): h is FilmHit => h.kind === "film");
  const people = hits.filter((h): h is PersonHit => h.kind === "person");

  // On phones the results panel spans the screen, below the search box.
  const place = () => {
    const r = box.current?.getBoundingClientRect();
    if (r) setDropTop(r.bottom + 8);
  };

  return (
    <div ref={box} className="relative">
      <input
        ref={input}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
          place();
        }}
        onFocus={() => {
          warm();
          setOpen(true);
          place();
        }}
        onPointerDown={warm}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && hits[active]) go(hits[active]);
          else if (e.key === "Escape") {
            setOpen(false);
            input.current?.blur();
          }
        }}
        placeholder="Search a movie, director or actor"
        aria-label="Search"
        role="combobox"
        aria-expanded={showing && hits.length > 0}
        aria-controls="search-results"
        aria-activedescendant={hits[active] ? `sr-${hits[active].id}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        className={`w-full rounded-full border border-line bg-surface text-text placeholder:text-text-3 outline-none focus:border-text-3 ${
          large ? "px-6 py-4 pr-14 text-lg" : "px-4 py-2 text-sm"
        }`}
      />
      {!large && (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[10px] text-text-3 lg:block">/</kbd>
      )}
      {showing && (
        <div
          id="search-results"
          role="listbox"
          style={{ top: dropTop }}
          className="fixed inset-x-2 z-40 max-h-[70vh] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface shadow-2xl sm:absolute sm:inset-x-0 sm:!top-full sm:mt-2"
        >
          {hits.length === 0 && (
            <div className="px-4 py-4 text-sm text-text-3">
              {engine || trimmed.length < 2 ? (trimmed.length < 2 ? "Keep typing…" : <>Nothing matches “{trimmed}”. Check the spelling, or try just part of the title.</>) : "Searching…"}
            </div>
          )}
          {films.map((f, i) => (
            <button
              key={f.id}
              id={`sr-${f.id}`}
              role="option"
              aria-selected={active === i}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(f)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left ${active === i ? "bg-surface-2" : ""}`}
            >
              <div className="h-14 w-9 shrink-0 overflow-hidden rounded bg-surface-2">
                {f.poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.poster} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{f.title}</div>
                <div className="text-xs text-text-3">{f.year || "—"}</div>
              </div>
              {f.score >= 0 ? <div className="tabular text-base font-semibold">{f.score}</div> : <div className="text-xs text-text-3">no score</div>}
            </button>
          ))}
          {people.length > 0 && <div className="border-t border-line px-3 pb-1 pt-2 text-[11px] uppercase tracking-wider text-text-3">People</div>}
          {people.map((p, j) => {
            const i = films.length + j;
            return (
              <button
                key={p.id}
                id={`sr-${p.id}`}
                role="option"
                aria-selected={active === i}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(p)}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm ${active === i ? "bg-surface-2" : ""}`}
              >
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 pl-3 text-xs text-text-3">
                  {p.role} · {p.count} films
                </span>
              </button>
            );
          })}
          {hits.length > 0 && (
            <div className="hidden border-t border-line px-3 py-1.5 text-[11px] text-text-3 sm:block">↑↓ to move · ↵ to open · esc to close</div>
          )}
        </div>
      )}
    </div>
  );
}
