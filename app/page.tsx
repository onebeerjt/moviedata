import Link from "next/link";
import { FilmCard, SplitRow } from "@/components/film-bits";
import { Search } from "@/components/search";
import { TheatersRail } from "@/components/theaters-rail";
import { QuadTeaser } from "@/components/quad-teaser";
import { WeeklyRail, type WeekBucket } from "@/components/weekly-rail";
import { Poster, ScoreBadge } from "@/components/film-bits";
import { SplitStrip } from "@/components/split-strip";
import { fmtDay, freshness } from "@/lib/fresh";
import { hiddenGems, movers, oneFilm, onThisDay } from "@/lib/stories";
import { why } from "@/lib/why";
import { allFilms, isWellKnown } from "@/lib/data";
import { SITE_TAGLINE } from "@/lib/site";
import { SUBSCRIPTIONS } from "@/lib/subscriptions";
import type { Film } from "@/lib/types";

// Re-rendered at most every 30 minutes so "today" stays today.
export const revalidate = 1800;

export default function Home() {
  const fresh = freshness();
  const one = oneFilm();
  const thisDay = onThisDay();
  const moved = movers();
  const gems = hiddenGems();
  const films = allFilms();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString().slice(0, 10);
  const nowPlaying = films
    .filter(
      (f) =>
        f.nowPlaying &&
        (f.releaseDate ?? "") >= cutoff &&
        f.score !== null &&
        Object.keys(f.s).length >= 2
    )
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const year = new Date().getFullYear();
  const recent = films
    .filter((f) => !f.nowPlaying && (f.year ?? 0) >= year - 1 && f.score !== null && (f.s.imdb?.n ?? 0) >= 20_000)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 16);

  const freeTonight = films
    .filter((f) => f.links && f.poster && isWellKnown(f))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
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

  // "New this week": releases with a poster and a date, bucketed by
  // Mon–Sun week. Weeks are anchored to the calendar; the freshest weeks
  // fill in as the daily TMDB pass dates more new releases.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const mondayOf = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const addDays = (iso: string, n: number) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const currentMonday = mondayOf(today);
  const byWeek = new Map<string, Film[]>();
  for (const f of films) {
    if (!f.poster || !f.releaseDate) continue;
    const wk = mondayOf(f.releaseDate);
    if (wk > currentMonday) continue;
    const arr = byWeek.get(wk);
    if (arr) arr.push(f);
    else byWeek.set(wk, [f]);
  }
  const weeks: WeekBucket[] = [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 12)
    .map(([start, wkFilms]) => ({
      start,
      end: addDays(start, 6),
      current: start === currentMonday,
      films: wkFilms
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.s.imdb?.n ?? 0) - (a.s.imdb?.n ?? 0))
        .slice(0, 24)
        .map((f) => ({
          id: f.id,
          title: f.title,
          year: f.year,
          poster: f.poster,
          score: f.score,
          releaseDate: f.releaseDate as string,
        })),
    }));

  return (
    <div>
      <section className="hero mx-auto max-w-6xl px-4 pb-6 pt-6 sm:pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2 text-xs text-text-3">
          <span className="font-semibold uppercase tracking-wider text-text-2">
            {new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" }).format(new Date())}
          </span>
          {fresh && (
            <span className={fresh.stale ? "text-[var(--quad-xdarling)]" : ""}>
              {fresh.label} · {fresh.when}
              {fresh.stale ? " · the daily refresh is behind; newer ratings aren't in yet" : ""}
            </span>
          )}
        </div>
        <div className="hero-search mt-4 hidden max-w-2xl sm:block">
          <Search large />
        </div>
        <p className="hero-sub sr-only">{SITE_TAGLINE}</p>
        <h1 className="hero-title sr-only">Consensus: one balanced movie score from five sites</h1>
        {one && <OneFilm film={one.film} anniversary={one.anniversary} yearsAgo={one.yearsAgo} />}
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4">
        {weeks.length > 0 && (
          <WeeklyRail
            weeks={weeks}
            note={!weeks[0].current ? `Nothing dated for this week yet. The newest releases we have are the week of ${fmtDay(weeks[0].start)}.` : undefined}
          />
        )}
        {nowPlaying.length > 0 && (
          <TheatersRail items={nowPlaying.map((f) => ({ id: f.id, releaseDate: f.releaseDate, card: <FilmCard film={f} /> }))} asOf={fresh?.theatersAt ? fmtDay(fresh.theatersAt) : undefined} />
        )}
        {moved.rows.length >= 3 && <Movers rows={moved.rows} from={moved.first} to={moved.last} />}
        <QuadTeaser />
        {freeTonight.length > 0 && (
          <Rail title="Free tonight" subtitle="Top-rated on Tubi, Pluto, Plex and more" films={freeTonight} href="/watch" />
        )}
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

        {gems.length > 0 && (
          <Rail title="Hidden gems" subtitle="Strong on every source, and under 40k ratings: few have seen them" films={gems} />
        )}
        {thisDay.length > 0 && <Rail title="On this day" subtitle="Released on this date in an earlier year" films={thisDay} />}
        {consensus.length > 0 && (
          <Rail title="Everyone agrees: these are great" subtitle="Top balanced scores with at least three sources" films={consensus} />
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <PromoCard href="/insights" title="What the gaps mean" body="Which genres, decades and directors does each site love or underrate?" />
          <PromoCard href="/versus" title="Versus" body="Two films, two directors or two decades, head to head across every source." />
          <PromoCard href="/me" title="Who agrees with you?" body="Rate a handful of films and see which site's taste matches yours." />
        </section>
      </div>
    </div>
  );
}

function Rail({ title, subtitle, films, href }: { title: string; subtitle?: string; films: Film[]; href?: string }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl">
          {href ? (
            <Link href={href} className="group">
              {title} <span className="inline-block text-2xl transition group-hover:translate-x-1">→</span>
            </Link>
          ) : (
            title
          )}
        </h2>
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

/** The way into /watch: free movies plus the viewer's own services. */
function WatchBanner() {
  const logos = [...SUBSCRIPTIONS.slice(0, 7).map((s) => ({ name: s.name, logo: s.logo })), { name: "Tubi", logo: "/9dEuvA8wg5TSeFBZlPxSVxFdimJ.png" }, { name: "Pluto TV", logo: "/fN4czqaMQNLeF6sSSIjGbAWzvwK.png" }];
  return (
    <Link
      href="/watch"
      className="group relative block overflow-hidden rounded-3xl border border-line bg-surface p-6 transition hover:bg-surface-2 sm:p-8"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-3">New · Find a movie</div>
          <h2 className="font-display mt-1 text-3xl sm:text-4xl">What should I watch tonight?</h2>
          <p className="mt-2 text-text-2">
            Tell us which services you have. We&apos;ll show every movie you can watch right now, free or on your
            subscriptions, ranked by the balanced score, with one tap to play.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-4 sm:items-end">
          <div className="flex -space-x-2">
            {logos.map((l) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={l.name} src={`https://image.tmdb.org/t/p/w92${l.logo}`} alt={l.name} title={l.name} className="h-10 w-10 rounded-full ring-2 ring-[var(--surface)]" />
            ))}
          </div>
          <span className="rounded-full bg-text px-5 py-2.5 text-sm font-semibold text-bg">
            Pick your services <span className="inline-block transition group-hover:translate-x-1">→</span>
          </span>
        </div>
      </div>
    </Link>
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

/** Today's single most interesting score story, above the fold. */
function OneFilm({ film, anniversary, yearsAgo }: { film: Film; anniversary: boolean; yearsAgo: number }) {
  const w = why(film);
  return (
    <Link href={`/film/${film.id}`} className="group mt-6 grid grid-cols-[6.5rem_1fr] gap-4 rounded-3xl border border-line bg-surface p-4 transition hover:bg-surface-2 sm:grid-cols-[9rem_1fr] sm:gap-6 sm:p-6">
      <Poster film={film} size="w342" className="w-full" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-3">
          One film today{anniversary ? ` · released ${yearsAgo} years ago today` : ""}
        </div>
        <h2 className="font-display mt-1 text-3xl leading-none sm:text-5xl">{film.title}</h2>
        <div className="mt-1 text-sm text-text-3">{film.year} · {film.directors.length ? "" : ""}{film.genres.slice(0, 2).join(", ")}</div>
        <p className="font-display mt-3 text-xl leading-snug text-text sm:text-3xl">{w.headline}</p>
        <div className="mt-3 flex items-center gap-3">
          <ScoreBadge score={film.score} size="md" />
          <div className="tabular text-sm text-text-2">
            Critics <b className="text-text">{film.critics}</b> · Audiences <b className="text-text">{film.audience}</b>
          </div>
        </div>
        <SplitStrip film={film} className="mt-3 max-w-md" />
        <p className="mt-3 hidden max-w-xl text-sm text-text-2 sm:block">{w.paragraphs[0]}</p>
      </div>
    </Link>
  );
}

function Movers({ rows, from, to }: { rows: ReturnType<typeof movers>["rows"]; from: string; to: string }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="font-display text-3xl">Score movers</h2>
        <span className="text-xs text-text-3">Recent releases, audience score {fmtDay(from)} → {fmtDay(to)}</span>
      </div>
      <div className="grid gap-x-6 sm:grid-cols-2">
        {rows.map(({ film, delta, detail }) => (
          <Link key={film.id} href={`/film/${film.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
            <Poster film={film} size="w185" className="w-10 shrink-0 rounded" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{film.title}</div>
              <div className="truncate text-xs text-text-3">{detail}</div>
            </div>
            <div className={`tabular text-sm font-semibold ${delta > 0 ? "text-[var(--quad-canon)]" : "text-[var(--quad-bomb)]"}`}>
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
