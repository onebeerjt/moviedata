import type { Metadata } from "next";
import { Quad, type QuadInitial } from "@/components/quad";
import { allFilms } from "@/lib/data";
import { freshness, fmtDay } from "@/lib/fresh";
import { AXES, QUAD_KEYS, axisOf, quadNames, type AxisKey } from "@/lib/quad";

export const metadata: Metadata = {
  title: "The Quad",
  description: "Every film as a dot: critics against audiences. The canon, the critics' darlings, the crowd pleasers and the bomb zone, built from the same ratings as the Consensus score.",
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const axis = (v: string, d: AxisKey): AxisKey => (AXES.some((a) => a.key === v) ? (v as AxisKey) : d);

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const sp = await searchParams;
  let x = axis(first(sp.x), "audience");
  let y = axis(first(sp.y), "critics");
  if (x === y) y = x === "critics" ? "audience" : "critics";
  const quadIdx = QUAD_KEYS.findIndex((k) => k === first(sp.quad));
  const initial: QuadInitial = {
    x,
    y,
    decade: Number(first(sp.decade)) || 0,
    genre: first(sp.genre),
    votes: Number(first(sp.votes)) || 0,
    quad: quadIdx,
    film: /^tt\d+$/.test(first(sp.film)) ? first(sp.film) : "",
  };
  const fresh = freshness();
  const films = allFilms();
  const names = quadNames(x, y);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <div className="text-xs font-semibold uppercase tracking-wider text-text-3">Explore</div>
      <h1 className="font-display text-4xl sm:text-6xl">The Quad</h1>
      <p className="mt-2 text-sm text-text-2 sm:hidden">Every film a dot: {axisOf(x).label.toLowerCase()} against {axisOf(y).label.toLowerCase()}.</p>
      <p className="mt-3 hidden max-w-2xl text-text-2 sm:block">
        Every film is a dot. {axisOf(x).label} run left to right, {axisOf(y).label} bottom to top, both on the same 0–100 percentile
        scale the Consensus score uses. Top right is {names.canon.name.toLowerCase()}; bottom left is {names.bomb.name.toLowerCase()}. The
        other two corners are where the sites disagree.
      </p>
      <div className="mt-6">
        <Quad initial={initial} asOf={fresh ? fmtDay(fresh.builtAt) : "the latest refresh"} totalFilms={films.length} />
      </div>
      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-text-3">
        How to read it: a percentile of 80 means the film is rated higher than 80% of films on that site, after each site&apos;s ratings
        are adjusted for how many votes they have. Films that one of the two axes doesn&apos;t cover can&apos;t be placed, and the count above
        says how many. Critics come from Rotten Tomatoes and Metacritic (via OMDb), which cover fewer films than the audience sites.
      </p>
    </div>
  );
}
