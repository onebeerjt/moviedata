import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Poster } from "@/components/film-bits";
import { MyShelf } from "@/components/my-shelf";
import { ScoreDial } from "@/components/score-dial";
import { ShareButton } from "@/components/share-button";
import { SourceBars } from "@/components/source-bars";
import { SplitStrip } from "@/components/split-strip";
import { Trailer } from "@/components/trailer";
import { freeInfo, getFilm, personName, posterUrl } from "@/lib/data";
import { fmtDay, freshness } from "@/lib/fresh";
import { serviceName } from "@/lib/free";
import { describeShape, sameShape } from "@/lib/shape";
import { SUBSCRIPTIONS } from "@/lib/subscriptions";
import { confidence } from "@/lib/trust";
import { why } from "@/lib/why";

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
  const explain = why(film);
  const trust = confidence(film);
  const fresh = freshness();
  const rhymes = sameShape(film);
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
            <ScoreDial film={film} />
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span
                title={trust.detail}
                className={`rounded-full border px-2.5 py-1 ${trust.tier === "solid" ? "border-line text-text-2" : "border-[var(--quad-xdarling)] text-[var(--quad-xdarling)]"}`}
              >
                {trust.label}
              </span>
              {fresh && <span className="text-text-3">{fresh.label}{fresh.stale ? ` (${fresh.when})` : ""}</span>}
              <ShareButton title={`${film.title} (${film.year}) on Consensus`} text={`${film.title}: Consensus score ${film.score ?? "n/a"}. See where the sources split.`} className="ml-auto sm:ml-2" />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-3">Why they split</div>
            <h2 className="font-display mt-1 text-3xl leading-tight sm:text-4xl">{explain.headline}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-text-2">
              {explain.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {explain.quad && (
              <Link
                href={`/explore?film=${film.id}&quad=${explain.quad.key}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-text-2 hover:bg-surface-2"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: `var(--quad-${explain.quad.key})` }} />
                On the Quad: {explain.quad.name} <span aria-hidden>→</span>
              </Link>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold">Every source, one scale</h2>
            <SourceBars film={film} />
            {(film.audience !== null || film.critics !== null) && (
              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5">
                <Stat label="Audiences" value={film.audience} hint="Letterboxd · IMDb · TMDB" />
                <Stat label="Critics" value={film.critics} hint="Rotten Tomatoes · Metacritic" />
              </div>
            )}
            <div className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-text-3">
              <p>
                <span className="font-semibold text-text-2">{trust.label}.</span> {trust.detail}
              </p>
              <p className="mt-1.5">
                Vote counts are shown for Letterboxd, IMDb and TMDB. Rotten Tomatoes and Metacritic don&apos;t publish a review count with the score, so a critic score from a dozen reviews looks the same as one from four hundred.
                {fresh && (
                  <>
                    {" "}
                    Scores as of {fmtDay(fresh.builtAt)}, {fresh.when}
                    {fresh.stale ? ": the daily refresh has fallen behind, so newer ratings aren't in yet" : ""}.
                  </>
                )}
              </p>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          {film.trailer && <Trailer id={film.trailer} title={film.title} />}
          <MyShelf id={film.id} />
          {film.links && <StreamingOn links={film.links} />}
          {film.links && <WatchFree links={film.links} />}
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

      {rhymes.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="font-display text-3xl">Same shape</h2>
          <p className="mb-5 mt-1 max-w-2xl text-sm text-text-2">
            Not similar films: films the sources split on the same way. {describeLine(film)}
          </p>
          <div className="scroller -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
            {rhymes.map(({ film: r, why: w }) => (
              <Link key={r.id} href={`/film/${r.id}`} className="group block w-40 shrink-0 sm:w-44">
                <div className="relative">
                  <Poster film={r} className="transition group-hover:brightness-110" />
                  <div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8">
                    <SplitStrip film={r} />
                  </div>
                </div>
                <div className="mt-2 truncate text-sm">{r.title}</div>
                <div className="text-xs text-text-3">{r.year}{w ? ` · ${w}` : ""}</div>
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-3">Each strip is one film&apos;s sources on the 0–100 scale (colors as in the source list); the white tick is its Consensus score.</p>
        </section>
      )}
    </div>
  );
}

function describeLine(film: import("@/lib/types").Film) {
  const d = describeShape(film);
  return d ? `Here: ${d}.` : "Here, the sources largely agree, so these are films that every source also ranks about the same.";
}

/** Free services for this film, from JustWatch via TMDB. */
function WatchFree({ links }: { links: Record<number, string> }) {
  const byId = new Map(freeInfo().services.map((s) => [s.id, s]));
  // Only services we can link straight to the film on, biggest first.
  const services = Object.keys(links)
    .flatMap((id) => (byId.get(Number(id)) ? [byId.get(Number(id))!] : []))
    .sort((a, b) => b.count - a.count);
  if (!services.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-3">Watch free</h2>
      <div className="flex flex-wrap gap-2">
        {services.slice(0, 8).map((s) => (
          <a
            key={s.id}
            href={links[s.id]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm hover:bg-surface-2"
          >
            {s.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl(s.logo, "w92")} alt="" className="h-6 w-6 rounded-full" />
            )}
            {serviceName(s)}
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-3">
        Free with ads{services.some((s) => s.library) ? " (Kanopy and Hoopla need a library card)" : ""}. Streaming data from
        JustWatch. <Link href="/watch" className="underline underline-offset-2">Find more to watch →</Link>
      </p>
    </div>
  );
}

/** Subscription services with a direct link to the film. */
function StreamingOn({ links }: { links: Record<number, string> }) {
  const subs = SUBSCRIPTIONS.filter((s) => links[s.id]);
  if (!subs.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-3">Streaming on</h2>
      <div className="flex flex-wrap gap-2">
        {subs.map((s) => (
          <a
            key={s.id}
            href={links[s.id]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm hover:bg-surface-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={posterUrl(s.logo, "w92")} alt="" className="h-6 w-6 rounded-full" />
            {s.name}
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-3">With a subscription. Streaming data from JustWatch.</p>
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
