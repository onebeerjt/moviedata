import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SplitRow } from "@/components/film-bits";
import { ShareButton } from "@/components/share-button";
import { allFilms, getInsights, personName } from "@/lib/data";
import type { Film } from "@/lib/types";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function resolve(kind: string, key: string): { label: string; films: Film[]; stat?: ReturnType<typeof statFor> } | null {
  const all = allFilms();
  if (kind === "genre") return { label: key, films: all.filter((f) => f.genres.includes(key)), stat: statFor("genres", key) };
  if (kind === "decade") return { label: `${key}s`, films: all.filter((f) => f.year !== null && Math.floor(f.year / 10) * 10 === Number(key)), stat: statFor("decades", key) };
  if (kind === "director") return { label: personName(key), films: all.filter((f) => f.directors.includes(key)), stat: statFor("directors", key) };
  return null;
}
const statFor = (list: "genres" | "decades" | "directors", key: string) => getInsights()?.[list].find((s) => s.key === key);

export async function generateMetadata({ searchParams }: PageProps<"/insights/group">): Promise<Metadata> {
  const sp = await searchParams;
  const r = resolve(first(sp.kind), first(sp.key));
  return r ? { title: `${r.label}: where the sources split` } : {};
}

export default async function GroupPage({ searchParams }: PageProps<"/insights/group">) {
  const sp = await searchParams;
  const kind = first(sp.kind);
  const axis = first(sp.axis) === "ca" ? "ca" : "lb";
  const r = resolve(kind, first(sp.key));
  if (!r || !r.films.length) notFound();

  // Gap per film: Letterboxd − IMDb, or critics − audiences, in percentile points.
  const gapOf = (f: Film) => (axis === "lb" ? (f.s.letterboxd && f.s.imdb ? f.s.letterboxd.p - f.s.imdb.p : null) : f.critics !== null && f.audience !== null ? f.critics - f.audience : null);
  // Thin catalogs are noisy: for genres and decades keep films people have rated.
  const pool = r.films.filter((f) => gapOf(f) !== null && (kind === "director" || (f.s.imdb?.n ?? 0) >= 10_000));
  const sorted = [...pool].sort((a, b) => gapOf(b)! - gapOf(a)!);
  const pos = sorted.filter((f) => gapOf(f)! > 0).slice(0, 12);
  const neg = sorted.filter((f) => gapOf(f)! < 0).reverse().slice(0, 12);
  const lean = axis === "lb" ? r.stat?.lbVsImdb : r.stat?.criticsVsAudience;
  const [A, B] = axis === "lb" ? (["letterboxd", "imdb"] as const) : (["rt", "imdb"] as const);
  const posName = axis === "lb" ? "Letterboxd ranks higher" : "Critics like it more";
  const negName = axis === "lb" ? "IMDb ranks higher" : "Audiences like it more";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <Link href="/insights" className="text-xs text-text-3 hover:text-text">← Insights</Link>
      <h1 className="font-display mt-2 text-4xl sm:text-6xl">{r.label}</h1>
      <p className="mt-2 max-w-2xl text-text-2">
        {axis === "lb" ? "Letterboxd against IMDb" : "Critics against audiences"}
        {lean !== null && lean !== undefined && (
          <>
            : on average {Math.abs(lean).toFixed(1)} points in favor of{" "}
            {lean > 0 ? (axis === "lb" ? "Letterboxd" : "critics") : axis === "lb" ? "IMDb" : "audiences"} across {axis === "lb" ? r.stat?.lbN : r.stat?.caN} films.
          </>
        )}{" "}
        Here are the films behind that number{kind !== "director" ? " (10,000+ IMDb ratings)" : ""}.
      </p>
      <div className="mt-3 flex gap-2">
        <Link href={`/insights/group?kind=${kind}&key=${encodeURIComponent(first(sp.key))}&axis=${axis === "lb" ? "ca" : "lb"}`} className="rounded-full border border-line px-4 py-2 text-sm text-text-2 hover:bg-surface-2">
          Switch to {axis === "lb" ? "critics vs audiences" : "Letterboxd vs IMDb"}
        </Link>
        <ShareButton title={`${r.label} on Consensus`} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[
          { title: posName, films: pos, a: A, b: B },
          { title: negName, films: neg, a: B, b: A },
        ].map((side) => (
          <div key={side.title} className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex justify-between px-2 pb-2 pt-1 text-xs uppercase tracking-wider text-text-3">
              <span>{side.title}</span>
              <span>Gap</span>
            </div>
            {side.films.length === 0 && <div className="px-2 py-4 text-sm text-text-3">No films lean this way.</div>}
            {side.films.map((f) => (
              <SplitRow key={f.id} film={f} a={side.a} b={side.b} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
