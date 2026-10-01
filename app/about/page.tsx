import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { SOURCES } from "@/lib/sources";

export const metadata: Metadata = { title: "How it works" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 leading-relaxed">
      <h1 className="font-display text-5xl">How it works</h1>
      <p className="mt-4 text-text-2">
        Every review site has its own crowd and its own inflation. A 7.0 on IMDb and a 3.5 on Letterboxd both mean
        &ldquo;about average&rdquo;, and a 90% on Rotten Tomatoes means &ldquo;90% of critics were positive&rdquo;, not
        &ldquo;9 out of 10&rdquo;. {SITE_NAME} puts them on one scale and shows you where they disagree.
      </p>

      <h2 className="mt-10 text-xl font-semibold">The sources</h2>
      <ul className="mt-3 space-y-2">
        {SOURCES.map((s) => (
          <li key={s.key} className="flex items-start gap-3">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span>
              <strong>{s.name}</strong>{" "}
              <span className="text-text-2">
                {
                  {
                    letterboxd: "Film-lover community. Average star rating, 0.5–5.",
                    imdb: "The biggest mainstream audience. Average user rating, 1–10.",
                    tmdb: "Community movie database. Average user rating, 0–10.",
                    rt: "Tomatometer: the share of approved critics whose review was positive.",
                    metacritic: "Weighted average of critic review scores, 0–100.",
                  }[s.key]
                }
              </span>
            </span>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-semibold">The balanced score</h2>
      <ol className="mt-3 list-decimal space-y-3 pl-5 text-text-2">
        <li>
          <strong className="text-text">Discount thin data.</strong> A film with 40 ratings averaging 4.8 shouldn&apos;t beat
          one with 400,000 averaging 4.2. Each rating is pulled toward that site&apos;s average in proportion to how few
          votes it has (a Bayesian average).
        </li>
        <li>
          <strong className="text-text">Rank within each site.</strong> We convert every score to a percentile among the
          films we track on that site: &ldquo;ranks higher than 82% of films on Letterboxd&rdquo;. This cancels out each
          site&apos;s built-in inflation, so the sources become comparable.
        </li>
        <li>
          <strong className="text-text">Weigh critics and audiences equally.</strong> We average the audience sources
          (Letterboxd, IMDb, TMDB) and the critic sources (Rotten Tomatoes, Metacritic) separately, then take the midpoint.
          No single crowd, or single marketing push, can dominate.
        </li>
      </ol>

      <h2 className="mt-10 text-xl font-semibold">Agreement</h2>
      <p className="mt-3 text-text-2">
        The spread is the gap between the highest and lowest source rank for a film. Under 12 points is strong agreement;
        over 40 is a split verdict. Split verdicts are often the most interesting films on the site.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Freshness</h2>
      <p className="mt-3 text-text-2">
        Films in theaters and recent releases are refreshed daily, films from the past year weekly, and the back catalogue
        every few weeks. Older scores barely move.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Caveats</h2>
      <p className="mt-3 text-text-2">
        Percentiles are relative to the roughly 12,000 most-rated films we track, not every film ever made. Rotten
        Tomatoes&apos; audience score isn&apos;t included yet. All scores belong to their sites, and every film page links
        straight to the source.
      </p>
    </div>
  );
}
