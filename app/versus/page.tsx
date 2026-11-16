import type { Metadata } from "next";
import Link from "next/link";
import { ScoreBadge } from "@/components/film-bits";
import { ShareButton } from "@/components/share-button";
import { VersusPicker } from "@/components/versus-picker";
import { posterUrl } from "@/lib/data";
import { SOURCES } from "@/lib/sources";
import { DECADES, entity, versusLines, type Entity, type VsKind } from "@/lib/versus";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const KINDS: { key: VsKind; label: string }[] = [
  { key: "film", label: "Films" },
  { key: "director", label: "Directors" },
  { key: "decade", label: "Decades" },
];
// Starting matchups, so the page is never empty.
const DEFAULTS: Record<VsKind, [string, string]> = {
  film: ["tt0468569", "tt1375666"], // The Dark Knight vs Inception
  director: ["nm0634240", "nm0000233"], // Christopher Nolan vs Quentin Tarantino
  decade: ["1970", "2010"],
};

export async function generateMetadata({ searchParams }: PageProps<"/versus">): Promise<Metadata> {
  const sp = await searchParams;
  const kind = (first(sp.type) as VsKind) || "film";
  const a = entity(kind, first(sp.a) || DEFAULTS[kind]?.[0] || "");
  const b = entity(kind, first(sp.b) || DEFAULTS[kind]?.[1] || "");
  return { title: a && b ? `${a.label} vs ${b.label}` : "Versus", description: "Two films, directors or decades, head to head across every source." };
}

export default async function VersusPage({ searchParams }: PageProps<"/versus">) {
  const sp = await searchParams;
  const kind: VsKind = KINDS.some((k) => k.key === first(sp.type)) ? (first(sp.type) as VsKind) : "film";
  const idA = first(sp.a) || DEFAULTS[kind][0];
  const idB = first(sp.b) || DEFAULTS[kind][1];
  const a = entity(kind, idA);
  const b = entity(kind, idB);
  const params = { a: idA, b: idB };
  const lines = a && b ? versusLines(a, b) : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <div className="text-xs font-semibold uppercase tracking-wider text-text-3">Head to head</div>
      <h1 className="font-display text-4xl sm:text-6xl">Versus</h1>
      <div className="mt-5 flex gap-2" role="tablist" aria-label="What to compare">
        {KINDS.map((k) => (
          <Link
            key={k.key}
            href={`/versus?type=${k.key}`}
            role="tab"
            aria-selected={kind === k.key}
            className={`rounded-full border px-4 py-1.5 text-sm ${kind === k.key ? "border-text bg-text text-bg" : "border-line text-text-2 hover:bg-surface-2"}`}
          >
            {k.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-6">
        {(["a", "b"] as const).map((side) => {
          const e = side === "a" ? a : b;
          return (
            <div key={side} className="space-y-3">
              {kind === "decade" ? (
                <div className="flex flex-wrap gap-1.5">
                  {DECADES.map((d) => (
                    <Link
                      key={d}
                      href={`/versus?type=decade&a=${side === "a" ? d : idA}&b=${side === "b" ? d : idB}`}
                      className={`rounded-full border px-2.5 py-1 text-xs ${e?.id === String(d) ? "border-text bg-text text-bg" : "border-line text-text-2 hover:bg-surface-2"}`}
                    >
                      {d}s
                    </Link>
                  ))}
                </div>
              ) : (
                <VersusPicker kind={kind} side={side} current={e?.label} params={params} />
              )}
              <Header e={e} />
            </div>
          );
        })}
      </div>

      {a && b ? (
        <>
          {lines.length > 0 && (
            <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
              {lines.map((l) => (
                <p key={l} className="font-display text-xl leading-snug sm:text-2xl [&+p]:mt-2 [&+p]:font-sans [&+p]:text-sm [&+p]:text-text-2">
                  {l}
                </p>
              ))}
            </div>
          )}
          <section className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-label="Source by source">
            <div className="mb-3 grid grid-cols-[1fr_auto_1fr] gap-3 text-[11px] uppercase tracking-wider text-text-3">
              <span className="truncate">{a.label}</span>
              <span>Percentile</span>
              <span className="truncate text-right">{b.label}</span>
            </div>
            {[
              ...SOURCES.map((s) => ({ key: s.key as string, name: s.name, color: s.color, a: a.p[s.key] ?? null, b: b.p[s.key] ?? null })),
              { key: "audience", name: "Audiences", color: "var(--text-2)", a: a.audience, b: b.audience },
              { key: "critics", name: "Critics", color: "var(--text-2)", a: a.critics, b: b.critics },
              { key: "score", name: "Consensus score", color: "var(--text)", a: a.score, b: b.score },
            ].map((r, idx) => (
              <Row key={r.key} name={r.name} color={r.color} a={r.a} b={r.b} sep={idx === SOURCES.length} />
            ))}
          </section>
          <div className="mt-5 flex items-center gap-3">
            <ShareButton title={`${a.label} vs ${b.label} on Consensus`} />
            <span className="text-xs text-text-3">Directors and decades are averages over their films with that source; sources a film lacks are left out, not counted as zero.</span>
          </div>
        </>
      ) : (
        <p className="mt-8 text-text-2">Pick two to compare.</p>
      )}
    </div>
  );
}

function Header({ e }: { e: Entity | null }) {
  if (!e) return <div className="rounded-2xl border border-dashed border-line p-6 text-sm text-text-3">Nothing picked.</div>;
  const src = posterUrl(e.poster, "w185");
  return (
    <Link href={e.href} className="block rounded-2xl border border-line bg-surface p-3 hover:bg-surface-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-24 w-16 shrink-0 overflow-hidden rounded bg-surface-2">
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-display text-2xl leading-tight">{e.label}</div>
          <div className="text-xs text-text-3">{e.sub}</div>
          <div className="mt-2">
            <ScoreBadge score={e.score} size="sm" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function Row({ name, color, a, b, sep }: { name: string; color: string; a: number | null; b: number | null; sep?: boolean }) {
  const lead = a !== null && b !== null && Math.abs(a - b) >= 3 ? (a > b ? "a" : "b") : null;
  return (
    <div className={`grid grid-cols-[1fr_6.5rem_1fr] items-center gap-2 py-1.5 sm:grid-cols-[1fr_9rem_1fr] sm:gap-3 ${sep ? "mt-3 border-t border-line pt-4" : ""}`}>
      <Bar v={a} color={color} dir="right" win={lead === "a"} />
      <div className="text-center text-xs text-text-2 sm:text-sm">{name}</div>
      <Bar v={b} color={color} dir="left" win={lead === "b"} />
    </div>
  );
}

function Bar({ v, color, dir, win }: { v: number | null; color: string; dir: "left" | "right"; win: boolean }) {
  if (v === null) return <div className={`text-xs text-text-3 ${dir === "right" ? "text-right" : ""}`}>no data</div>;
  const num = <span className={`tabular w-8 shrink-0 text-sm ${win ? "font-semibold text-text" : "text-text-2"} ${dir === "right" ? "text-right" : ""}`}>{Math.round(v)}</span>;
  const bar = (
    <div className={`flex h-2.5 flex-1 rounded-full bg-surface-2 ${dir === "right" ? "justify-end" : ""}`}>
      <div className="h-full rounded-full" style={{ width: `${v}%`, background: color, opacity: win ? 1 : 0.55 }} />
    </div>
  );
  return <div className="flex items-center gap-2">{dir === "right" ? <>{bar}{num}</> : <>{num}{bar}</>}</div>;
}
