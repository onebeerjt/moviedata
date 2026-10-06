import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Poster, ScoreBadge } from "@/components/film-bits";
import { SourceBars } from "@/components/source-bars";
import { getFilm, personName, posterUrl } from "@/lib/data";
import { agreement, notes, scoreLabel } from "@/lib/verdict";

export async function generateMetadata({ params }: PageProps<"/film/[id]">): Promise<Metadata> {
  const film = getFilm((await params).id);
  if (!film) return {};
  return {
    title: `${film.title} (${film.year})`,
    description: `${film.title}: balanced score ${film.score ?? "n/a"}. See how Letterboxd, IMDb, Rotten Tomatoes and Metacritic compare.`,
  };
}

export default async function FilmPage({ params }: PageProps<"/film/[id]">) {
  const film = getFilm((await params).id);
  if (!film) notFound();
  const agree = agreement(film.spread);
  const filmNotes = notes(film);
  const backdrop = posterUrl(film.backdrop, "w1280");

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        {backdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${backdrop})`, maskImage: "linear-gradient(to bottom, black, transparent)" }}
          />
        )}
        <div className="relative mx-auto flex max-w-6xl gap-5 px-4 py-8 sm:gap-8 sm:py-12">
          <Poster film={film} size="w500" className="w-28 shrink-0 shadow-2xl sm:w-52" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-4xl leading-none sm:text-6xl">{film.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-text-2">
              {film.year && <span>{film.year}</span>}
              {film.rated && <span>{film.rated}</span>}
              {film.runtime && <span>{Math.floor(film.runtime / 60)}h {film.runtime % 60}m</span>}
              {film.genres.length > 0 && <span>{film.genres.join(", ")}</span>}
              {film.nowPlaying && <span className="rounded-full bg-text px-2 text-xs leading-5 text-bg">In theaters</span>}
            </div>
            {film.directors.length > 0 && (
              <div className="mt-2 text-sm text-text-2">
                Directed by{" "}
                {film.directors.map((d, i) => (
                  <span key={d}>
                    {i > 0 && ", "}
                    <Link href={`/person/${d}`} className="text-text hover:underline">
                      {personName(d)}
                    </Link>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-6 flex items-center gap-4 sm:mt-8">
              <ScoreBadge score={film.score} size="lg" />
              <div>
                <div className="text-[11px] uppercase tracking-wider text-text-3">Balanced score</div>
                <div className="text-xl">{scoreLabel(film.score)}</div>
                <div
                  className={`mt-1 text-sm ${agree.tone === "split" ? "text-[var(--src-rt)]" : agree.tone === "mixed" ? "text-text-2" : "text-text-2"}`}
                >
                  {agree.label}
                  {film.spread !== null && <span className="text-text-3"> · {film.spread} pt spread</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Every source, one scale</h2>
          <SourceBars film={film} />
          {(film.audience !== null || film.critics !== null) && (
            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5">
              <Stat label="Audiences" value={film.audience} hint="Letterboxd · IMDb · TMDB" />
              <Stat label="Critics" value={film.critics} hint="Rotten Tomatoes · Metacritic" />
            </div>
          )}
        </section>

        <aside className="space-y-6">
          {filmNotes.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-3">What stands out</h2>
              <ul className="space-y-3 text-sm leading-relaxed">
                {filmNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          {film.overview && <p className="text-sm leading-relaxed text-text-2">{film.overview}</p>}
          {film.cast.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-3">Starring</h2>
              <div className="flex flex-wrap gap-2">
                {film.cast.map((c) => (
                  <Link key={c} href={`/person/${c}`} className="rounded-full border border-line px-3 py-1 text-sm hover:bg-surface-2">
                    {personName(c)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-text-3">{label}</div>
      <div className="tabular text-2xl font-semibold">{value ?? "—"}</div>
      <div className="text-xs text-text-3">{hint}</div>
    </div>
  );
}
