import type { Metadata } from "next";
import Link from "next/link";
import { Poster } from "@/components/film-bits";
import { allFilms } from "@/lib/data";
import type { Film } from "@/lib/types";

export const metadata: Metadata = {
  title: "Cult Consensus",
  description: "Beloved by audiences, dismissed by critics — ranked by how far apart they are.",
};

const MIN_AGE_YEARS = 10;
const MIN_AUDIENCE = 93;
const MAX_CRITICS = 65;
const TOP = 50;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Older films with all five sources, a 93+ audience percentile and a critic percentile of 65 or below, ranked by gap. */
function cultFilms() {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - MIN_AGE_YEARS);
  const rows: { film: Film; audience: number; critics: number; gap: number }[] = [];
  for (const film of allFilms()) {
    const { letterboxd, imdb, tmdb, rt, metacritic } = film.s;
    if (!letterboxd || !imdb || !tmdb || !rt || !metacritic || !film.releaseDate) continue;
    if (new Date(film.releaseDate) > cutoff) continue;
    const audience = mean([letterboxd.p, imdb.p, tmdb.p]);
    if (audience < MIN_AUDIENCE) continue;
    const critics = mean([rt.p, metacritic.p]);
    if (critics > MAX_CRITICS) continue;
    const gap = audience - critics;
    rows.push({ film, audience, critics, gap });
  }
  return rows.sort((a, b) => b.gap - a.gap).slice(0, TOP);
}

export default function CultPage() {
  const rows = cultFilms();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-5xl">Cult Consensus</h1>
      <p className="mt-2 max-w-2xl text-text-2">
        Beloved by audiences, dismissed by critics — ranked by how far apart they are. Films at least {MIN_AGE_YEARS} years old
        with all five sources, an audience percentile of {MIN_AUDIENCE}+ and a critic percentile of {MAX_CRITICS} or below.
      </p>
      <p className="mt-3 max-w-2xl text-xs text-text-3">
        A note on foreign films: critic scores for non-English and less-covered films often come from a handful of reviews, so
        gaps can look bigger than they are. Audience scores are more reliable here.
      </p>
      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-8 text-text-2">
          No films qualify yet. The Cult view needs films that are {MIN_AGE_YEARS}+ years old with scores from all five sources.
        </div>
      ) : (
        <ol className="mt-8 space-y-1">
          {rows.map(({ film, audience, critics, gap }, i) => (
            <li key={film.id}>
              <Link href={`/film/${film.id}`} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2 sm:items-center sm:gap-4">
                <span className="tabular w-7 shrink-0 self-center text-right text-sm text-text-3">{i + 1}</span>
                <Poster film={film} size="w185" className="w-12 shrink-0 rounded" />
                <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                  <div className="min-w-0 sm:flex-1">
                    <div className="break-words">{film.title}</div>
                    <div className="text-xs text-text-3">{film.year}</div>
                  </div>
                  <div className="tabular mt-2 flex gap-5 text-xs text-text-3 sm:mt-0 sm:gap-4 sm:text-right">
                    <span>
                      <span className="block text-sm text-text-2">{Math.round(audience)}</span>Audience
                    </span>
                    <span>
                      <span className="block text-sm text-text-2">{Math.round(critics)}</span>Critics
                    </span>
                    <span className="sm:w-10">
                      <span className="block text-sm text-text-2">+{Math.round(gap)}</span>gap
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
