import type { Metadata } from "next";
import { MyTaste, type Suggestion } from "@/components/my-taste";
import { allFilms } from "@/lib/data";

export const metadata: Metadata = {
  title: "My taste",
  description: "Rate a handful of films and see which site (Letterboxd, IMDb, critics) agrees with you. Stays in your browser.",
};

/** Famous films where the sources split most: the ones whose ratings tell sources apart. */
function suggestions(): Suggestion[] {
  return allFilms()
    .filter((f) => (f.s.imdb?.n ?? 0) >= 200_000 && f.poster && Object.keys(f.s).length >= 4 && f.spread !== null)
    .sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0))
    .slice(0, 36)
    // Shuffle deterministically by id so the grid isn't all one genre of split.
    .sort((a, b) => ((a.id.charCodeAt(5) * 7 + a.id.charCodeAt(8)) % 11) - ((b.id.charCodeAt(5) * 7 + b.id.charCodeAt(8)) % 11))
    .map((f) => ({ id: f.id, title: f.title, year: f.year, poster: f.poster }));
}

export default function MePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <div className="text-xs font-semibold uppercase tracking-wider text-text-3">Personal</div>
      <h1 className="font-display text-4xl sm:text-6xl">My taste</h1>
      <p className="mb-8 mt-2 max-w-xl text-text-2">Your watchlist, your ratings, and which site&apos;s taste matches yours. Private: it lives in this browser.</p>
      <MyTaste suggestions={suggestions()} />
    </div>
  );
}
