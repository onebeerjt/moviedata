import type { Metadata } from "next";
import Link from "next/link";
import { Poster } from "@/components/film-bits";
import { allFilms } from "@/lib/data";
import type { Film } from "@/lib/types";

export const metadata: Metadata = {
  title: "Cult Consensus",
  description: "Films audiences rescued: where audience love outruns critic reception.",
};

const MIN_AGE_YEARS = 10;
const TOP = 50;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Cult score = audience percentile − critic percentile, for older films with all five sources. */
function cultFilms() {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - MIN_AGE_YEARS);
  const rows: { film: Film; audience: number; critics: number; gap: number }[] = [];
  for (const film of allFilms()) {
    const { letterboxd, imdb, tmdb, rt, metacritic } = film.s;
    if (!letterboxd || !imdb || !tmdb || !rt || !metacritic || !film.releaseDate) continue;
    if (new Date(film.releaseDate) > cutoff) continue;
    const audience = mean([letterboxd.p, imdb.p, tmdb.p]);
    const critics = mean([rt.p, metacritic.p]);
    rows.push({ film, audience, critics, gap: audience - critics });
  }
  return rows.sort((a, b) => b.gap - a.gap).slice(0, TOP);
}

export default function CultPage() {
  const rows = cultFilms();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-5xl">Cult Consensus</h1>
      <p className="mt-2 max-w-2xl text-text-2">
        Films audiences rescued, ranked by how far audience love outruns critic reception. The cult score is the audience
        percentile minus the critic percentile, for films at least {MIN_AGE_YEARS} years old with all five sources.
      </p>
      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-8 text-text-2">
          No films qualify yet. The Cult view needs films that are {MIN_AGE_YEARS}+ years old with scores from all five sources.
        </div>
      ) : (
        <ol className="mt-8 space-y-1">
          {rows.map(({ film, audience, critics, gap }, i) => (
            <li key={film.id}>
              <Link href={`/film/${film.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2 sm:gap-4">
                <span className="tabular w-7 shrink-0 text-right text-sm text-text-3">{i + 1}</span>
                <Poster film={film} size="w185" className="w-12 shrink-0 rounded" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{film.title}</div>
                  <div className="text-xs text-text-3">{film.year}</div>
                </div>
                <div className="tabular flex gap-4 text-right text-xs text-text-3">
                  <span>
                    <span className="block text-sm text-text-2">{Math.round(audience)}</span>Audience
                  </span>
                  <span>
                    <span className="block text-sm text-text-2">{Math.round(critics)}</span>Critics
                  </span>
                </div>
                <div className="tabular w-14 shrink-0 text-right">
                  <span className="block text-xl font-semibold">+{Math.round(gap)}</span>
                  <span className="text-xs text-text-3">cult</span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
