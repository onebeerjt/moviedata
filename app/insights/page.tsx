import type { Metadata } from "next";
import { LeanChart, type LeanRow } from "@/components/lean-chart";
import Link from "next/link";
import { Poster } from "@/components/film-bits";
import { SplitStrip } from "@/components/split-strip";
import { allFilms, getInsights } from "@/lib/data";
import { fmtDay, freshness } from "@/lib/fresh";
import { describeShape } from "@/lib/shape";
import type { Film } from "@/lib/types";
import { SOURCE } from "@/lib/sources";
import type { GroupStat } from "@/lib/types";

export const metadata: Metadata = {
  title: "Insights",
  description: "Which genres, decades and directors each review site overrates or underrates.",
};

const grp = (kind: string, axis: string) => (s: GroupStat) => `/insights/group?kind=${kind}&key=${encodeURIComponent(s.key)}&axis=${axis}`;
const lbRows = (stats: GroupStat[], min: number, href?: (s: GroupStat) => string): LeanRow[] =>
  stats
    .filter((s) => s.lbVsImdb !== null && s.lbN >= min)
    .map((s) => ({ key: s.key, label: s.label, value: s.lbVsImdb!, n: s.lbN, href: href?.(s) }));
const caRows = (stats: GroupStat[], min: number, href?: (s: GroupStat) => string): LeanRow[] =>
  stats
    .filter((s) => s.criticsVsAudience !== null && s.caN >= min)
    .map((s) => ({ key: s.key, label: s.label, value: s.criticsVsAudience!, n: s.caN, href: href?.(s) }));

const LB = { label: "Letterboxd higher", color: SOURCE.letterboxd.color };
const IMDB = { label: "IMDb higher", color: SOURCE.imdb.color };
const CRITICS = { label: "Critics higher", color: SOURCE.rt.color };
const AUDIENCE = { label: "Audiences higher", color: SOURCE.tmdb.color };

export const revalidate = 3600;

export default function InsightsPage() {
  const ins = getInsights();
  if (!ins) return <div className="mx-auto max-w-6xl px-4 py-10 text-text-2">No data yet.</div>;

  const genreLb = lbRows(ins.genres, 40, grp("genre", "lb")).sort((a, b) => b.value - a.value);
  const genreCa = caRows(ins.genres, 40, grp("genre", "ca")).sort((a, b) => b.value - a.value);
  const decadeLb = lbRows(ins.decades, 20, grp("decade", "lb"));
  const decadeCa = caRows(ins.decades, 20, grp("decade", "ca"));
  const directors = lbRows(ins.directors, 5, (s) => `/person/${s.key}`).sort((a, b) => b.value - a.value);
  const topDirectors = [...directors.slice(0, 12), ...directors.slice(-12).filter((d) => !directors.slice(0, 12).includes(d))];

  const sections = [
    {
      id: "genres-lb",
      title: "Genres: Letterboxd vs IMDb",
      body: "Average gap in rank between the two sites for films in each genre. Bars to the right are genres the Letterboxd crowd rates higher than IMDb users do.",
      rows: genreLb,
      pos: LB,
      neg: IMDB,
    },
    {
      id: "genres-ca",
      title: "Genres: critics vs audiences",
      body: "Rotten Tomatoes and Metacritic against Letterboxd, IMDb and TMDB.",
      rows: genreCa,
      pos: CRITICS,
      neg: AUDIENCE,
    },
    { id: "decades-lb", title: "Decades: Letterboxd vs IMDb", body: "Does each site have a favourite era?", rows: decadeLb, pos: LB, neg: IMDB },
    { id: "decades-ca", title: "Decades: critics vs audiences", body: "", rows: decadeCa, pos: CRITICS, neg: AUDIENCE },
    {
      id: "directors",
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
        places that group 10 points higher. Tap any bar to see the films behind it.
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

      <Headlines />
      <div className="mt-10 space-y-8">
        {ready.map((s) => (
          <section key={s.title} id={s.id} className="scroll-mt-28 rounded-2xl border border-line bg-surface p-4 sm:p-6">
            <h2 className="text-lg font-semibold">
              <a href={`#${s.id}`} className="hover:underline">{s.title}</a>
            </h2>
            {s.body && <p className="mb-5 mt-1 text-sm text-text-2">{s.body}</p>}
            <LeanChart rows={s.rows} pos={s.pos} neg={s.neg} />
          </section>
        ))}
      </div>
    </div>
  );
}

const spread = (f: Film) => f.spread ?? 0;
const gap = (f: Film) => (f.critics !== null && f.audience !== null ? f.critics - f.audience : 0);

/** Screenshot-ready records: the most divisive films, and who wins each era's argument. */
function Headlines() {
  const fresh = freshness();
  const films = allFilms().filter((f) => f.poster && (f.s.imdb?.n ?? 0) >= 25_000 && Object.keys(f.s).length >= 4);
  const divisive = [...films].sort((a, b) => spread(b) - spread(a)).slice(0, 12);
  const criticsMost = [...films].sort((a, b) => gap(b) - gap(a))[0];
  const audienceMost = [...films].sort((a, b) => gap(a) - gap(b))[0];
  const decades = [...new Set(films.filter((f) => f.year).map((f) => Math.floor(f.year! / 10) * 10))].sort((a, b) => a - b);
  const eras = decades
    .map((d) => {
      const inDecade = films.filter((f) => Math.floor(f.year! / 10) * 10 === d && f.critics !== null && f.audience !== null);
      if (inDecade.length < 25) return null;
      const sorted = [...inDecade].sort((a, b) => gap(b) - gap(a));
      return { d, critics: sorted[0], audience: sorted[sorted.length - 1], n: inDecade.length };
    })
    .filter((e): e is NonNullable<typeof e> => !!e && gap(e.critics) >= 15 && gap(e.audience) <= -15);
  return (
    <div className="mt-8 space-y-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: "Biggest critics' darling", film: criticsMost, tone: "ydarling" },
          { label: "Biggest crowd pleaser", film: audienceMost, tone: "xdarling" },
        ].map(({ label, film, tone }) =>
          film ? (
            <Link key={label} href={`/film/${film.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
              <Poster film={film} size="w185" className="w-16 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: `var(--quad-${tone})` }}>{label}</div>
                <div className="font-display text-2xl leading-tight">{film.title}</div>
                <div className="tabular text-xs text-text-2">Critics {film.critics} · Audiences {film.audience} · {Math.abs(gap(film))}-point gap</div>
              </div>
            </Link>
          ) : null,
        )}
      </div>

      <section id="divisive" className="scroll-mt-28 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-lg font-semibold"><a href="#divisive" className="hover:underline">Most divisive films</a></h2>
        <p className="mb-4 mt-1 text-sm text-text-2">The widest gap between any two sources, among films with 25,000+ ratings and at least four sources.</p>
        <ol className="grid gap-x-6 sm:grid-cols-2">
          {divisive.map((f, i) => (
            <li key={f.id}>
              <Link href={`/film/${f.id}`} className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-surface-2">
                <span className="tabular w-5 shrink-0 text-right text-xs text-text-3">{i + 1}</span>
                <Poster film={f} size="w185" className="w-9 shrink-0 rounded" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{f.title} <span className="text-text-3">{f.year}</span></div>
                  <SplitStrip film={f} className="mt-1.5" />
                  <div className="mt-1 truncate text-[11px] text-text-3">{describeShape(f) ?? `${spread(f)}-point spread`}</div>
                </div>
                <span className="tabular text-sm font-semibold">{spread(f)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {eras.length >= 3 && (
        <section id="eras" className="scroll-mt-28 rounded-2xl border border-line bg-surface p-4 sm:p-6">
          <h2 className="text-lg font-semibold"><a href="#eras" className="hover:underline">The argument, era by era</a></h2>
          <p className="mb-4 mt-1 text-sm text-text-2">In each decade, the film critics rated furthest above audiences, and the one audiences rated furthest above critics (25,000+ ratings).</p>
          <div className="divide-y divide-line/60">
            {eras.map(({ d, critics, audience }) => (
              <div key={d} className="grid grid-cols-[3.2rem_1fr_1fr] items-center gap-3 py-2.5">
                <div className="font-display text-xl">{d}s</div>
                {[
                  { f: critics, tone: "ydarling", tag: "Critics" },
                  { f: audience, tone: "xdarling", tag: "Audiences" },
                ].map(({ f, tone, tag }) => (
                  <Link key={f.id} href={`/film/${f.id}`} className="flex min-w-0 items-center gap-2 rounded-lg p-1 hover:bg-surface-2">
                    <Poster film={f} size="w185" className="w-8 shrink-0 rounded" />
                    <div className="min-w-0">
                      <div className="truncate text-sm">{f.title}</div>
                      <div className="text-[11px]" style={{ color: `var(--quad-${tone})` }}>{tag} +{Math.abs(gap(f))}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="text-xs leading-relaxed text-text-3">
        Scores as of {fresh ? fmtDay(fresh.builtAt) : "the latest refresh"}. Rotten Tomatoes and Metacritic don&apos;t publish review counts with their scores, so an extreme critic gap on a small film can rest on a handful of reviews.
      </p>
    </div>
  );
}
