import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Poster, ScoreBadge } from "@/components/film-bits";
import { Filmography } from "@/components/filmography";
import { filmsByIds, getPerson } from "@/lib/data";
import { SOURCE, SOURCES } from "@/lib/sources";
import type { Film } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/person/[id]">): Promise<Metadata> {
  const p = getPerson((await params).id);
  return p ? { title: p.name, description: `How ${p.name}'s films score on Letterboxd, IMDb, Rotten Tomatoes and more.` } : {};
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export default async function PersonPage({ params }: PageProps<"/person/[id]">) {
  const person = getPerson((await params).id);
  if (!person) notFound();
  const asDirector = person.directed.length >= person.actedIn.length;
  const films = filmsByIds(asDirector ? person.directed : person.actedIn).sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  const other = filmsByIds(asDirector ? person.actedIn : person.directed).filter((f) => !films.includes(f));

  const lean = avg(films.flatMap((f) => (f.s.letterboxd && f.s.imdb ? [f.s.letterboxd.p - f.s.imdb.p] : [])));
  const ca = avg(films.flatMap((f) => (f.critics !== null && f.audience !== null ? [f.critics - f.audience] : [])));
  const score = avg(films.flatMap((f) => (f.score !== null ? [f.score] : [])));
  const best = [...films].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-xs uppercase tracking-wider text-text-3">{asDirector ? "Director" : "Actor"}</div>
      <h1 className="font-display text-5xl sm:text-6xl">{person.name}</h1>
      <p className="mt-2 text-text-2">
        {films.length} {films.length === 1 ? "film" : "films"} {asDirector ? "directed" : "with top billing"} in our index
        {best && (
          <>
            {" "}
            · best rated: <Link href={`/film/${best.id}`} className="text-text hover:underline">{best.title}</Link>
          </>
        )}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Tile label="Average balanced score" value={score === null ? "—" : String(Math.round(score))} />
        <Tile
          label="Letterboxd vs IMDb"
          value={lean === null ? "—" : `${lean > 0 ? "+" : ""}${Math.round(lean)}`}
          hint={lean === null ? "Needs Letterboxd data" : lean > 3 ? "Letterboxd ranks their films higher" : lean < -3 ? "IMDb ranks their films higher" : "Both sites agree"}
        />
        <Tile
          label="Critics vs audiences"
          value={ca === null ? "—" : `${ca > 0 ? "+" : ""}${Math.round(ca)}`}
          hint={ca === null ? "Needs critic data" : ca > 3 ? "Critics like their films more" : ca < -3 ? "Audiences like their films more" : "Both agree"}
        />
      </div>

      {films.length >= 2 && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Career, source by source</h2>
          <p className="mb-4 text-sm text-text-2">Each film&apos;s rank on each site (0–100). Hover a film to compare.</p>
          <Filmography films={films.map(compact)} />
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-4 font-display text-3xl">Filmography</h2>
        <FilmTable films={[...films].reverse()} />
      </section>

      {other.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-2xl text-text-2">{asDirector ? "Also acted in" : "Also directed"}</h2>
          <FilmTable films={other.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))} />
        </section>
      )}
    </div>
  );
}

function compact(f: Film) {
  return {
    id: f.id,
    title: f.title,
    year: f.year,
    score: f.score,
    p: Object.fromEntries(Object.entries(f.s).map(([k, v]) => [k, Math.round(v.p)])),
    raw: Object.fromEntries(Object.entries(f.s).map(([k, v]) => [k, SOURCE[k as keyof typeof SOURCE].format(v.v)])),
  };
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="text-[11px] uppercase tracking-wider text-text-3">{label}</div>
      <div className="tabular mt-1 text-4xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-text-2">{hint}</div>}
    </div>
  );
}

function FilmTable({ films }: { films: Film[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-text-3">
            <th className="px-3 py-3 font-normal">Film</th>
            <th className="px-3 py-3 text-center font-normal">Score</th>
            {SOURCES.map((s) => (
              <th key={s.key} className="px-3 py-3 text-right font-normal">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.short}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {films.map((f) => (
            <tr key={f.id} className="border-b border-line/60 last:border-0 hover:bg-surface">
              <td className="px-3 py-2">
                <Link href={`/film/${f.id}`} className="flex items-center gap-3">
                  <Poster film={f} size="w185" className="w-8 shrink-0 rounded" />
                  <span>
                    {f.title} <span className="text-text-3">{f.year}</span>
                  </span>
                </Link>
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-center">
                  <ScoreBadge score={f.score} size="sm" />
                </div>
              </td>
              {SOURCES.map((s) => (
                <td key={s.key} className="tabular px-3 py-2 text-right text-text-2">
                  {f.s[s.key] ? s.format(f.s[s.key]!.v).replace(/ \/ (5|10|100)$/, "") : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
