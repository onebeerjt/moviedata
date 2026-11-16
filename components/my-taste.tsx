"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { alignment, strength, type AlignKey } from "@/lib/align";
import { clearMe, exportMe, importMe, setSeen, toggleWatch, useMe } from "@/lib/me";
import { loadLite, loadPosters, posterSrc, rowOf, ttId, type Lite } from "@/lib/lite";
import { SOURCE } from "@/lib/sources";
import { Stars } from "./stars";

export type Suggestion = { id: string; title: string; year: number | null; poster?: string };

const MIN_FILMS = 5;
const LABEL: Record<AlignKey, string> = {
  letterboxd: "Letterboxd",
  imdb: "IMDb",
  tmdb: "TMDB",
  rt: "Rotten Tomatoes",
  metacritic: "Metacritic",
  audience: "Audiences overall",
  critics: "Critics overall",
  score: "Consensus score",
};
const COLOR = (k: AlignKey) => (k in SOURCE ? SOURCE[k as keyof typeof SOURCE].color : "var(--text-2)");

export function MyTaste({ suggestions }: { suggestions: Suggestion[] }) {
  const me = useMe();
  const [lite, setLite] = useState<Lite | null>(null);
  const [posters, setPosters] = useState<string[] | null>(null);
  const [note, setNote] = useState("");
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLite().then(setLite, () => {});
    loadPosters().then(setPosters, () => {});
  }, []);

  const rated = useMemo(() => {
    if (!lite) return [] as [number, number][];
    const out: [number, number][] = [];
    for (const [id, s] of Object.entries(me.seen)) {
      if (!s.r) continue;
      const row = rowOf(lite, id);
      if (row >= 0) out.push([row, s.r]);
    }
    return out;
  }, [lite, me.seen]);

  const align = useMemo(() => (lite ? alignment(lite, rated) : []), [lite, rated]);
  const sources = align.filter((a) => ["letterboxd", "imdb", "tmdb", "rt", "metacritic"].includes(a.key) && a.rho !== null && a.n >= MIN_FILMS).sort((a, b) => b.rho! - a.rho!);
  const aud = align.find((a) => a.key === "audience");
  const crit = align.find((a) => a.key === "critics");
  const ready = rated.length >= MIN_FILMS && sources.length > 0;

  const verdict = (() => {
    if (!ready) return null;
    const [top, next] = sources;
    const tied = next && top.rho! - next.rho! < 0.1;
    const small = rated.length < 10;
    let line = tied
      ? `${LABEL[top.key]} and ${LABEL[next.key]} are neck and neck for you (${top.rho!.toFixed(2)} vs ${next.rho!.toFixed(2)}).`
      : `${LABEL[top.key]} agrees with you most: a ${strength(top.rho!)} match (${top.rho!.toFixed(2)}).`;
    if (aud?.rho != null && crit?.rho != null && aud.n >= MIN_FILMS && crit.n >= MIN_FILMS && Math.abs(aud.rho - crit.rho) >= 0.15) {
      line += aud.rho > crit.rho ? " You side with audiences over critics." : " You side with critics over audiences.";
    }
    return line + (small ? ` That's an early read from ${rated.length} films; rate ten or more to firm it up.` : "");
  })();

  const rows = (ids: string[]) =>
    lite
      ? ids.flatMap((id) => {
          const i = rowOf(lite, id);
          return i >= 0 ? [{ id, i, title: lite.t[i], year: lite.yr[i], score: lite.sc[i], poster: posters?.[i] }] : [];
        })
      : [];
  const seenRows = rows(Object.keys(me.seen)).sort((a, b) => (me.seen[b.id].at > me.seen[a.id].at ? 1 : -1));
  const watchRows = rows(me.watch);
  const unrated = suggestions.filter((s) => !me.seen[s.id]);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-3">Which site agrees with you</div>
        {ready ? (
          <>
            <h2 className="font-display mt-1 text-2xl leading-snug sm:text-3xl">{verdict}</h2>
            <div className="mt-5 space-y-2.5">
              {[...sources, ...[aud, crit].filter((a): a is NonNullable<typeof a> => !!a && a.rho !== null && a.n >= MIN_FILMS)].map((a, idx) => (
                <div key={a.key} className={`grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-sm ${idx === sources.length ? "mt-4 border-t border-line pt-4" : ""}`}>
                  <span className="flex items-center gap-2 truncate">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR(a.key) }} />
                    {LABEL[a.key]}
                  </span>
                  <div className="relative h-2.5 rounded-full bg-surface-2" title={`${strength(a.rho!)} agreement over ${a.n} films`}>
                    <div className="absolute inset-y-0 left-1/2 w-px bg-text-3" />
                    <div
                      className="absolute inset-y-0 rounded-full"
                      style={{ background: COLOR(a.key), left: a.rho! >= 0 ? "50%" : `${50 + a.rho! * 50}%`, width: `${Math.abs(a.rho!) * 50}%` }}
                    />
                  </div>
                  <span className="tabular text-right text-text-2">
                    {a.rho! > 0 ? "+" : ""}
                    {a.rho!.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-text-3">
              Rank correlation between your ratings and each site&apos;s percentile, from {rated.length} rated films ({sources.map((s) => `${LABEL[s.key]} ${s.n}`).join(", ")}). +1 means you rank films in the same order; 0 means no relationship. Under about 10 films a gap of 0.1 is noise.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display mt-1 text-3xl leading-tight sm:text-4xl">Rate {Math.max(0, MIN_FILMS - rated.length) || "a few more"} film{MIN_FILMS - rated.length === 1 ? "" : "s"} to find out</h2>
            <p className="mt-2 text-sm text-text-2">
              Mark films you&apos;ve seen and give them stars. Once you have {MIN_FILMS} rated we compare your taste with Letterboxd, IMDb, TMDB, Rotten Tomatoes and Metacritic. Everything stays in this browser.
            </p>
            <div className="mt-3 h-2 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-text transition-all" style={{ width: `${Math.min(100, (rated.length / MIN_FILMS) * 100)}%` }} />
            </div>
            <div className="mt-1 text-xs text-text-3">{rated.length} of {MIN_FILMS} rated</div>
          </>
        )}
      </section>

      {unrated.length > 0 && (
        <section>
          <h2 className="font-display text-3xl">Rate these</h2>
          <p className="mb-4 mt-1 text-sm text-text-2">Well-known films where the sites disagree most, so your rating tells them apart. Skip any you haven&apos;t seen.</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {unrated.slice(0, 18).map((s) => (
              <RateCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}

      {seenRows.length > 0 && (
        <section>
          <h2 className="font-display text-3xl">Seen ({seenRows.length})</h2>
          <ul className="mt-3 divide-y divide-line/60">
            {seenRows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <Link href={`/film/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Thumb src={posterSrc(r.poster, "w92")} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{r.title}</span>
                    <span className="text-xs text-text-3">{r.year || "—"}{r.score >= 0 ? ` · Consensus ${r.score}` : ""}</span>
                  </span>
                </Link>
                <Stars value={me.seen[r.id].r} onChange={(v) => setSeen(r.id, v)} size={22} />
                <button aria-label={`Remove ${r.title}`} onClick={() => setSeen(r.id, null)} className="px-1 text-text-3 hover:text-text">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display text-3xl">Watchlist ({watchRows.length})</h2>
        {watchRows.length === 0 ? (
          <p className="mt-2 text-sm text-text-2">Nothing yet. Add films from any film page with “+ Watchlist”.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/60">
            {watchRows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <Link href={`/film/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Thumb src={posterSrc(r.poster, "w92")} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{r.title}</span>
                    <span className="text-xs text-text-3">{r.year || "—"}</span>
                  </span>
                </Link>
                {r.score >= 0 && <span className="tabular text-sm font-semibold">{r.score}</span>}
                <button onClick={() => setSeen(r.id, 0)} className="rounded-full border border-line px-3 py-1 text-xs hover:bg-surface-2">Seen it</button>
                <button aria-label={`Remove ${r.title}`} onClick={() => toggleWatch(r.id)} className="px-1 text-text-3 hover:text-text">✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 text-sm text-text-2">
        <h2 className="font-semibold text-text">Your data</h2>
        <p className="mt-1 text-xs text-text-3">Stored only in this browser (localStorage). No account, nothing uploaded. Clearing your browser data erases it, so export a copy if it matters.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-full border border-line px-4 py-2 hover:bg-surface-2"
            onClick={() => {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([exportMe()], { type: "application/json" }));
              a.download = "consensus-my-taste.json";
              a.click();
            }}
          >
            Export
          </button>
          <button className="rounded-full border border-line px-4 py-2 hover:bg-surface-2" onClick={() => file.current?.click()}>
            Import
          </button>
          <button
            className="rounded-full border border-line px-4 py-2 hover:bg-surface-2"
            onClick={() => {
              if (confirm("Erase your watchlist and ratings from this browser?")) clearMe();
            }}
          >
            Erase
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                importMe(await f.text());
                setNote("Imported.");
              } catch {
                setNote("That file isn't a Consensus export.");
              }
              e.target.value = "";
            }}
          />
          <span className="self-center text-xs text-text-3" aria-live="polite">{note}</span>
        </div>
      </section>
    </div>
  );
}

function Thumb({ src }: { src?: string }) {
  return (
    <div className="h-14 w-9 shrink-0 overflow-hidden rounded bg-surface-2">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function RateCard({ s }: { s: Suggestion }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="relative block aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface-2">
        {s.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`https://image.tmdb.org/t/p/w185${s.poster}`} alt={s.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-end p-2 text-left text-xs">{s.title}</span>
        )}
      </button>
      <div className="mt-1 truncate text-xs text-text-2">{s.title}</div>
      {open && (
        <div className="mt-1">
          <Stars value={0} size={20} onChange={(v) => setSeen(s.id, v)} />
        </div>
      )}
    </div>
  );
}

export { ttId };
