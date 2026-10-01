import Link from "next/link";
import { FilmCard, SplitRow } from "@/components/film-bits";
import { Search } from "@/components/search";
import { allFilms, isWellKnown } from "@/lib/data";
import { SITE_TAGLINE } from "@/lib/site";
import type { Film } from "@/lib/types";

export default function Home() {
  const films = allFilms();
  const nowPlaying = films.filter((f) => f.nowPlaying).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const year = new Date().getFullYear();
  const recent = films
    .filter((f) => !f.nowPlaying && (f.year ?? 0) >= year - 1 && f.score !== null && (f.s.imdb?.n ?? 0) >= 20_000)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 16);

  const known = films.filter((f) => isWellKnown(f));
  const lbGap = (f: Film) => (f.s.letterboxd && f.s.imdb ? f.s.letterboxd.p - f.s.imdb.p : 0);
  const lbLoves = [...known].sort((a, b) => lbGap(b) - lbGap(a)).filter((f) => lbGap(f) > 0).slice(0, 6);
  const imdbLoves = [...known].sort((a, b) => lbGap(a) - lbGap(b)).filter((f) => lbGap(f) < 0).slice(0, 6);

  const caGap = (f: Film) => (f.critics !== null && f.audience !== null ? f.critics - f.audience : 0);
  const criticsLove = [...known].sort((a, b) => caGap(b) - caGap(a)).filter((f) => caGap(f) > 0).slice(0, 6);
  const audiencesLove = [...known].sort((a, b) => caGap(a) - caGap(b)).filter((f) => caGap(f) < 0).slice(0, 6);

  const consensus = known
    .filter((f) => f.spread !== null && Object.keys(f.s).length >= 3)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 16);

  return (
    <div>
      <section className="mx-auto max-w-3xl px-4 pb-10 pt-14 text-center sm:pt-20">
        <h1 className="font-display text-5xl leading-[0.95] sm:text-7xl">
          Every score.
          <br />
          <span className="text-text-2">One you can trust.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-text-2">
          We pull Letterboxd, IMDb, Rotten Tomatoes, Metacritic and TMDB into a single balanced score, and show you exactly
          where they disagree.
        </p>
        <div className="mx-auto mt-8 max-w-xl text-left">
          <Search large />
        </div>
        <p className="sr-only">{SITE_TAGLINE}</p>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4">
        {nowPlaying.length > 0 && <Rail title="In theaters now" subtitle="Refreshed daily" films={nowPlaying} />}
        {recent.length > 0 && <Rail title="Best of the last year" films={recent} />}

        {lbLoves.length > 0 && imdbLoves.length > 0 && (
          <SplitSection
            title="Letterboxd vs IMDb"
            subtitle="Well-known films where the cinephile crowd and the mainstream crowd disagree most."
            left={{ title: "Letterboxd ranks higher", films: lbLoves, a: "letterboxd", b: "imdb" }}
            right={{ title: "IMDb ranks higher", films: imdbLoves, a: "imdb", b: "letterboxd" }}
          />
        )}

        {criticsLove.length > 0 && audiencesLove.length > 0 && (
          <SplitSection
            title="Critics vs audiences"
            subtitle="Where the professional reviews and the paying public part ways."
            left={{ title: "Critics like it more", films: criticsLove, a: "rt", b: "imdb" }}
            right={{ title: "Audiences like it more", films: audiencesLove, a: "imdb", b: "rt" }}
          />
        )}

        {consensus.length > 0 && (
          <Rail title="Everyone agrees: these are great" subtitle="Top balanced scores with at least three sources" films={consensus} />
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <PromoCard
            href="/explore"
            title="Explore the map"
            body="Every film plotted Letterboxd against IMDb (or any two sources). Filter by genre and decade and find the outliers."
          />
          <PromoCard
            href="/insights"
            title="What the gaps mean"
            body="Which genres, decades and directors does each site love or underrate?"
          />
        </section>
      </div>
    </div>
  );
}

function Rail({ title, subtitle, films }: { title: string; subtitle?: string; films: Film[] }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl">{title}</h2>
        {subtitle && <span className="text-xs text-text-3">{subtitle}</span>}
      </div>
      <div className="scroller -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
        {films.map((f) => (
          <FilmCard key={f.id} film={f} />
        ))}
      </div>
    </section>
  );
}

type Side = { title: string; films: Film[]; a: "letterboxd" | "imdb" | "rt"; b: "letterboxd" | "imdb" | "rt" };
function SplitSection({ title, subtitle, left, right }: { title: string; subtitle: string; left: Side; right: Side }) {
  return (
    <section>
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mb-5 mt-1 text-sm text-text-2">{subtitle}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {[left, right].map((side) => (
          <div key={side.title} className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex justify-between px-2 pb-2 pt-1 text-xs uppercase tracking-wider text-text-3">
              <span>{side.title}</span>
              <span>Gap</span>
            </div>
            {side.films.map((f) => (
              <SplitRow key={f.id} film={f} a={side.a} b={side.b} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function PromoCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-line bg-surface p-6 hover:bg-surface-2">
      <h3 className="font-display text-2xl">
        {title} <span className="inline-block transition group-hover:translate-x-1">→</span>
      </h3>
      <p className="mt-2 text-sm text-text-2">{body}</p>
    </Link>
  );
}
