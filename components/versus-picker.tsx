"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadLite, loadPeople, nmId, ttId } from "@/lib/lite";
import { makeSearcher, type Searcher } from "@/lib/search";
import type { VsKind } from "@/lib/versus";

/** Search box that returns a film or director id for one side of the matchup. */
export function VersusPicker({ kind, side, current, params }: { kind: VsKind; side: "a" | "b"; current?: string; params: Record<string, string> }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [engine, setEngine] = useState<{ s: Searcher; lite: Awaited<ReturnType<typeof loadLite>>; people: [number, string, number, number][] } | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || engine) return;
    Promise.all([loadLite(), loadPeople()]).then(([lite, people]) => setEngine({ s: makeSearcher(lite, people), lite, people }));
  }, [open, engine]);
  useEffect(() => {
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const choose = (id: string) => {
    const next = new URLSearchParams({ ...params, type: kind, [side]: id });
    setOpen(false);
    setQ("");
    router.push(`/versus?${next.toString()}`);
  };

  const hits: { id: string; label: string; sub: string }[] = [];
  if (engine && q.trim()) {
    if (kind === "film") for (const i of engine.s.films(q, 6)) hits.push({ id: ttId(engine.lite.id[i]), label: engine.lite.t[i], sub: String(engine.lite.yr[i] || "") });
    else for (const i of engine.s.people(q, 12).filter((i) => engine.people[i][2] >= 3).slice(0, 6)) hits.push({ id: nmId(engine.people[i][0]), label: engine.people[i][1], sub: `${engine.people[i][2]} films directed` });
  }

  return (
    <div ref={box} className="relative">
      <input
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        placeholder={current ? `Change ${kind}…` : `Pick a ${kind}`}
        aria-label={`Pick ${kind} ${side.toUpperCase()}`}
        autoComplete="off"
        className="w-full rounded-full border border-line bg-surface px-4 py-2 text-sm text-text outline-none placeholder:text-text-3 focus:border-text-3"
      />
      {open && q.trim() && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
          {hits.length === 0 ? (
            <div className="px-3 py-3 text-sm text-text-3">{engine ? "No match." : "Loading…"}</div>
          ) : (
            hits.map((h) => (
              <button key={h.id} onClick={() => choose(h.id)} className="flex w-full items-baseline justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-2">
                <span className="truncate">{h.label}</span>
                <span className="shrink-0 text-xs text-text-3">{h.sub}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
