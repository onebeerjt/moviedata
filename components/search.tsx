"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Results = {
  films: { id: string; title: string; year: number | null; score: number | null; poster?: string }[];
  people: { id: string; name: string; role: string; count: number }[];
};

export function Search({ autoFocus = false, large = false }: { autoFocus?: boolean; large?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((r: Results) => {
          setResults(r);
          setActive(0);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const visible = q.trim().length >= 2 ? results : null;
  const items = visible
    ? [
        ...visible.films.map((f) => ({ href: `/film/${f.id}`, key: f.id })),
        ...visible.people.map((p) => ({ href: `/person/${p.id}`, key: p.id })),
      ]
    : [];

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <div ref={box} className="relative">
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, items.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && items[active]) go(items[active].href);
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search a movie, director or actor"
        aria-label="Search"
        className={`w-full rounded-full border border-line bg-surface text-text placeholder:text-text-3 outline-none focus:border-text-3 ${
          large ? "px-6 py-4 text-lg" : "px-4 py-2 text-sm"
        }`}
      />
      {open && visible && (visible.films.length > 0 || visible.people.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          {visible.films.map((f, i) => (
            <button
              key={f.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(`/film/${f.id}`)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left ${active === i ? "bg-surface-2" : ""}`}
            >
              <div className="h-12 w-8 shrink-0 overflow-hidden rounded bg-surface-2">
                {f.poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.poster} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{f.title}</div>
                <div className="text-xs text-text-3">{f.year ?? "—"}</div>
              </div>
              {f.score !== null && <div className="tabular text-sm font-semibold">{f.score}</div>}
            </button>
          ))}
          {visible.people.length > 0 && (
            <div className="border-t border-line px-3 pb-1 pt-2 text-[11px] uppercase tracking-wider text-text-3">People</div>
          )}
          {visible.people.map((p, j) => {
            const i = visible.films.length + j;
            return (
              <button
                key={p.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(`/person/${p.id}`)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${active === i ? "bg-surface-2" : ""}`}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-text-3">
                  {p.role} · {p.count} films
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
