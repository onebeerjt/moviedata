import type { Metadata } from "next";
import { Scatter, type ScatterFilm } from "@/components/scatter";
import { allFilms } from "@/lib/data";
import { SOURCES } from "@/lib/sources";

export const metadata: Metadata = { title: "Explore", description: "Every film plotted source against source." };

export default function ExplorePage() {
  const films = allFilms().filter((f) => (f.s.imdb?.n ?? 0) >= 15_000 && Object.keys(f.s).length >= 2);
  const genres = [...new Set(films.flatMap((f) => f.genres))].sort();
  const points: ScatterFilm[] = films.map((f) => ({
    id: f.id,
    t: f.title,
    y: f.year ?? 0,
    g: f.genres.map((g) => genres.indexOf(g)),
    p: SOURCES.map((s) => (f.s[s.key] ? Math.round(f.s[s.key]!.p * 10) / 10 : null)),
    v: SOURCES.map((s) => f.s[s.key]?.v ?? null),
  }));
  const available = SOURCES.map((s) => s.key).filter((_, i) => points.filter((p) => p.p[i] !== null).length >= 50);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-5xl">Explore</h1>
      <p className="mt-2 max-w-2xl text-text-2">
        Each dot is a film. Films on the diagonal score the same on both sites. The further a dot sits from the line, the
        more the two sites disagree. Tap or hover to see the film; click to open it.
      </p>
      {available.length >= 2 ? (
        <Scatter films={points} genres={genres} available={available} />
      ) : (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-8 text-text-2">
          The map needs at least two sources. IMDb is loaded; Letterboxd, Rotten Tomatoes and Metacritic will appear here once
          the data pipeline has collected them.
        </div>
      )}
    </div>
  );
}
