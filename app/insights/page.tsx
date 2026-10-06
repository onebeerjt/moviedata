import type { Metadata } from "next";
import { LeanChart, type LeanRow } from "@/components/lean-chart";
import { getInsights } from "@/lib/data";
import { SOURCE } from "@/lib/sources";
import type { GroupStat } from "@/lib/types";

export const metadata: Metadata = {
  title: "Insights",
  description: "Which genres, decades and directors each review site overrates or underrates.",
};

const lbRows = (stats: GroupStat[], min: number, href?: (s: GroupStat) => string): LeanRow[] =>
  stats
    .filter((s) => s.lbVsImdb !== null && s.lbN >= min)
    .map((s) => ({ key: s.key, label: s.label, value: s.lbVsImdb!, n: s.lbN, href: href?.(s) }));
const caRows = (stats: GroupStat[], min: number): LeanRow[] =>
  stats
    .filter((s) => s.criticsVsAudience !== null && s.caN >= min)
    .map((s) => ({ key: s.key, label: s.label, value: s.criticsVsAudience!, n: s.caN }));

const LB = { label: "Letterboxd higher", color: SOURCE.letterboxd.color };
const IMDB = { label: "IMDb higher", color: SOURCE.imdb.color };
const CRITICS = { label: "Critics higher", color: SOURCE.rt.color };
const AUDIENCE = { label: "Audiences higher", color: SOURCE.tmdb.color };

export default function InsightsPage() {
  const ins = getInsights();
  if (!ins) return <div className="mx-auto max-w-6xl px-4 py-10 text-text-2">No data yet.</div>;

  const genreLb = lbRows(ins.genres, 40).sort((a, b) => b.value - a.value);
  const genreCa = caRows(ins.genres, 40).sort((a, b) => b.value - a.value);
  const decadeLb = lbRows(ins.decades, 20);
  const decadeCa = caRows(ins.decades, 20);
  const directors = lbRows(ins.directors, 5, (s) => `/person/${s.key}`).sort((a, b) => b.value - a.value);
  const topDirectors = [...directors.slice(0, 12), ...directors.slice(-12).filter((d) => !directors.slice(0, 12).includes(d))];

  const sections = [
    {
      title: "Genres: Letterboxd vs IMDb",
      body: "Average gap in rank between the two sites for films in each genre. Bars to the right are genres the Letterboxd crowd rates higher than IMDb users do.",
      rows: genreLb,
      pos: LB,
      neg: IMDB,
    },
    {
      title: "Genres: critics vs audiences",
      body: "Rotten Tomatoes and Metacritic against Letterboxd, IMDb and TMDB.",
      rows: genreCa,
      pos: CRITICS,
      neg: AUDIENCE,
    },
    { title: "Decades: Letterboxd vs IMDb", body: "Does each site have a favourite era?", rows: decadeLb, pos: LB, neg: IMDB },
    { title: "Decades: critics vs audiences", body: "", rows: decadeCa, pos: CRITICS, neg: AUDIENCE },
    {
      title: "Directors each site loves more",
      body: "Directors with at least five films that have both Letterboxd and IMDb ratings: the strongest leans in each direction.",
      rows: topDirectors,
      pos: LB,
      neg: IMDB,
    },
  ];
  const ready = sections.filter((s) => s.rows.length >= 3);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-5xl">What the gaps mean</h1>
      <p className="mt-3 max-w-2xl text-text-2">
        Every site has its own crowd. Here&apos;s how they lean, measured across{" "}
        {ins.filmCount.toLocaleString()} films. Numbers are average differences in rank (0–100), so +10 means one site
        places that group 10 points higher.
      </p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-3">
        {Object.entries(ins.sourceCounts).map(([k, n]) => (
          <span key={k}>
            {SOURCE[k as keyof typeof SOURCE].name}: {n!.toLocaleString()} films
          </span>
        ))}
      </div>

      {ready.length === 0 && (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-8 text-text-2">
          Insights need at least two sources. They&apos;ll fill in as Letterboxd and critic scores are collected.
        </div>
      )}

      <div className="mt-10 space-y-8">
        {ready.map((s) => (
          <section key={s.title} className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
            <h2 className="text-lg font-semibold">{s.title}</h2>
            {s.body && <p className="mb-5 mt-1 text-sm text-text-2">{s.body}</p>}
            <LeanChart rows={s.rows} pos={s.pos} neg={s.neg} />
          </section>
        ))}
      </div>
    </div>
  );
}
