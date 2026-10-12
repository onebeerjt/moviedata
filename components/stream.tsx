"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { StreamFilm, StreamRow } from "@/lib/free";
import { SOURCES } from "@/lib/sources";

// The /free page: a streaming-service front end over the free catalog.
// Server code (lib/free.ts) picks the rows; everything here is presentation.

export type StreamService = { id: number; name: string; logo?: string; library?: boolean; /** A paid subscription the viewer added. */ sub?: boolean };

const img = (path: string | undefined, size: string) => (path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined);


type Ctx = {
  films: Record<string, StreamFilm>;
  services: Record<number, StreamService & { short: string }>;
  /** The service tab being browsed, if any: it leads every Watch button. */
  preferred: number | null;
  open: (id: string) => void;
  /** Play the trailer or (when free on YouTube) the full movie in the site's own player. */
  play: (id: string, what: "trailer" | "movie") => void;
};
const StreamCtx = createContext<Ctx | null>(null);
const useStream = () => useContext(StreamCtx)!;

export function Stream({
  films,
  services,
  hero,
  rows,
  toolbar,
  preferred = null,
}: {
  films: Record<string, StreamFilm>;
  services: Record<number, StreamService & { short: string }>;
  hero: string[];
  rows: StreamRow[];
  /** Service tabs, laid over the bottom edge of the hero. */
  toolbar: React.ReactNode;
  preferred?: number | null;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = useCallback((id: string) => setOpenId(id), []);
  const [playing, setPlaying] = useState<{ id: string; what: "trailer" | "movie" } | null>(null);
  const play = useCallback((id: string, what: "trailer" | "movie") => setPlaying({ id, what }), []);
  return (
    <StreamCtx.Provider value={{ films, services, preferred, open, play }}>
      {hero.length > 0 && <Hero ids={hero} />}
      <div className={`relative z-20 ${hero.length ? "-mt-8 sm:-mt-10" : "pt-4"}`}>{toolbar}</div>
      <div className="relative z-10 mt-4 space-y-10 pb-16 sm:space-y-12">
        {rows.map((r) => (
          <Row key={r.key} row={r} />
        ))}
      </div>
      {openId && films[openId] && <Sheet film={films[openId]} onClose={() => setOpenId(null)} />}
      {playing && films[playing.id] && <Player film={films[playing.id]} what={playing.what} onClose={() => setPlaying(null)} />}
    </StreamCtx.Provider>
  );
}

/* ------------------------------------------------------------------ hero */

const HERO_MS = 8000;

function Hero({ ids }: { ids: string[] }) {
  const { films, open } = useStream();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const go = useCallback((n: number) => setI((n + ids.length) % ids.length), [ids.length]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => go(i + 1), HERO_MS);
    return () => clearTimeout(t);
  }, [i, paused, go]);

  const f = films[ids[i]];
  const heroMode = usePlayMode(f);
  return (
    <section
      className="stream-hero relative -mt-px h-[clamp(520px,80vh,840px)] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
      aria-roledescription="carousel"
    >
      {ids.map((id, n) => (
        <div key={id} className={`absolute inset-0 transition-opacity duration-1000 ${n === i ? "opacity-100" : "opacity-0"}`} aria-hidden={n !== i}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img(films[id].backdrop, "original")}
            alt=""
            className={`h-full w-full object-cover ${n === i ? "stream-kenburns" : ""}`}
            loading={n === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/30" />

      <div className="absolute inset-x-0 bottom-0 px-5 pb-20 sm:px-10 sm:pb-24 lg:px-14">
        <div key={f.id} className="stream-rise max-w-xl">
          <ServiceTag ids={f.services} />
          <h1 className="mt-3 text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl">{f.title}</h1>
          <Meta f={f} className="mt-3" />
          <div className="mt-4 flex items-center gap-3">
            <Ring score={f.score} size={46} />
            <div className="text-sm leading-tight">
              <div className="font-semibold">{f.label}</div>
              <div className="text-white/60">{f.agree}</div>
            </div>
          </div>
          {f.overview && <p className="mt-4 line-clamp-2 text-[15px] leading-relaxed text-white/75 sm:line-clamp-3">{f.overview}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <PlayButton film={f} primary />
            <WatchButton film={f} primary={!heroMode} full />
            <button onClick={() => open(f.id)} className="stream-glass rounded-full px-6 py-3 text-[15px] font-semibold">
              Details
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-14 right-5 flex gap-1.5 sm:right-10 lg:right-14">
        {ids.map((id, n) => (
          <button
            key={id}
            onClick={() => go(n)}
            aria-label={`Show ${films[id].title}`}
            className={`relative h-1.5 overflow-hidden rounded-full bg-white/25 transition-all duration-500 ${n === i ? "w-10" : "w-1.5 hover:bg-white/50"}`}
          >
            {n === i && (
              <span
                className="stream-progress absolute inset-y-0 left-0 rounded-full bg-white"
                style={{ animationDuration: `${HERO_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
              />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ rows */

function Row({ row }: { row: StreamRow }) {
  const { films } = useStream();
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);
  useEffect(update, [update]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="group/row relative">
      <div className="mb-3 flex items-baseline gap-3 px-5 sm:px-10 lg:px-14">
        <h2 className="text-xl font-bold tracking-tight sm:text-[22px]">{row.title}</h2>
        {row.subtitle && <span className="hidden text-sm text-white/50 sm:inline">{row.subtitle}</span>}
      </div>
      <div
        ref={scroller}
        onScroll={update}
        className="scroller stream-row flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 py-4 sm:gap-4 sm:scroll-px-10 sm:px-10 lg:scroll-px-14 lg:px-14"
      >
        {row.ids.map((id, n) =>
          row.style === "wide" ? (
            <WideCard key={id} film={films[id]} />
          ) : row.style === "top10" ? (
            <TopCard key={id} film={films[id]} rank={n + 1} />
          ) : (
            <PosterCard key={id} film={films[id]} />
          ),
        )}
      </div>
      {!edges.start && <Arrow dir={-1} onClick={() => page(-1)} />}
      {!edges.end && <Arrow dir={1} onClick={() => page(1)} />}
    </section>
  );
}

function Arrow({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 1 ? "Scroll right" : "Scroll left"}
      className={`stream-glass absolute top-1/2 z-10 hidden h-11 w-11 items-center justify-center rounded-full text-xl opacity-0 transition-opacity group-hover/row:opacity-100 sm:flex ${
        dir === 1 ? "right-3" : "left-3"
      }`}
    >
      {dir === 1 ? "›" : "‹"}
    </button>
  );
}

/** tvOS-style card: tilts toward the pointer with a moving highlight. */
function Tilt({ children, className = "", onClick, label }: { children: React.ReactNode; className?: string; onClick: () => void; label: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-label={label}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        ref.current.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
        ref.current.style.setProperty("--ry", `${(x - 0.5) * 12}deg`);
        ref.current.style.setProperty("--gx", `${x * 100}%`);
        ref.current.style.setProperty("--gy", `${y * 100}%`);
      }}
      onPointerLeave={() => {
        ref.current?.style.removeProperty("--rx");
        ref.current?.style.removeProperty("--ry");
      }}
      className={`stream-tilt snap-start shrink-0 text-left ${className}`}
    >
      {children}
    </button>
  );
}

function PosterCard({ film }: { film: StreamFilm }) {
  const { open } = useStream();
  return (
    <Tilt onClick={() => open(film.id)} label={film.title} className="w-[38vw] max-w-[190px] sm:w-[170px]">
      <div className="stream-art relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(film.poster, "w342")} alt="" loading="lazy" className="h-full w-full object-cover" />
        <ScoreChip film={film} />
      </div>
      <div className="mt-2.5 truncate text-[13px] font-medium text-white/85">{film.title}</div>
      <div className="text-xs text-white/45">{film.year}</div>
    </Tilt>
  );
}

function WideCard({ film }: { film: StreamFilm }) {
  const { open } = useStream();
  return (
    <Tilt onClick={() => open(film.id)} label={film.title} className="w-[78vw] max-w-[400px] sm:w-[360px]">
      <div className="stream-art relative aspect-video overflow-hidden rounded-xl bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(film.backdrop, "w780")} alt="" loading="lazy" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="truncate text-lg font-bold leading-tight">{film.title}</div>
            <div className="truncate text-xs text-white/65">
              {[film.year, film.genres.slice(0, 2).join(" · ")].filter(Boolean).join(" · ")}
            </div>
          </div>
          <Ring score={film.score} size={38} />
        </div>
      </div>
    </Tilt>
  );
}

function TopCard({ film, rank }: { film: StreamFilm; rank: number }) {
  const { open } = useStream();
  return (
    <Tilt onClick={() => open(film.id)} label={`${rank}. ${film.title}`} className="flex w-[54vw] max-w-[270px] items-end sm:w-[250px]">
      <span className="stream-rank -mr-4 select-none text-[120px] font-black leading-[0.8] tracking-tighter sm:text-[150px]" aria-hidden>
        {rank}
      </span>
      <div className="stream-art relative aspect-[2/3] w-[58%] shrink-0 overflow-hidden rounded-xl bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(film.poster, "w342")} alt="" loading="lazy" className="h-full w-full object-cover" />
        <ScoreChip film={film} />
      </div>
    </Tilt>
  );
}

function ScoreChip({ film }: { film: StreamFilm }) {
  if (film.score === null) return null;
  return (
    <span className="stream-glass absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">{film.score}</span>
  );
}

/* ----------------------------------------------------------------- sheet */

function Sheet({ film: f, onClose }: { film: StreamFilm; onClose: () => void }) {
  const { play } = useStream();
  const mode = usePlayMode(f);
  const sorted = useSorted(f.services);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="stream-fade fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={f.title}
        onClick={(e) => e.stopPropagation()}
        className="stream-pop relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-[#1c1c1e] shadow-2xl sm:rounded-3xl"
      >
        {/* The smaller image is usually cached from the row card, so it shows at once. */}
        <div
          className="relative aspect-[16/8] w-full bg-cover bg-center"
          style={{ backgroundImage: f.backdrop ? `url(${img(f.backdrop, "w780")})` : undefined }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img(f.backdrop ?? f.poster, "w1280")} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1e] via-[#1c1c1e]/30 to-transparent" />
          {mode && (
            <button
              onClick={() => play(f.id, mode)}
              aria-label={mode === "movie" ? "Play movie" : "Play trailer"}
              className="stream-glass absolute left-1/2 top-[42%] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-2xl transition hover:scale-105"
            >
              <span className="ml-1">▶</span>
            </button>
          )}
          <button
            ref={close}
            onClick={onClose}
            aria-label="Close"
            className="stream-glass absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-lg"
          >
            ×
          </button>
          <div className="absolute inset-x-0 bottom-0 px-6 pb-2 sm:px-10">
            <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{f.title}</h2>
            <Meta f={f} className="mt-2" />
          </div>
        </div>

        <div className="grid gap-8 px-6 pb-8 pt-5 sm:grid-cols-[1fr_17rem] sm:px-10 sm:pb-10">
          <div>
            <div className="flex flex-wrap gap-3">
              <PlayButton film={f} primary />
              {mode === "movie" && f.trailer && <PlayButton film={f} trailerOnly />}
              <WatchButton film={f} primary={!mode} full />
              {sorted.slice(1, 4).map((sid) => (
                <WatchButton key={sid} film={f} serviceId={sid} />
              ))}
            </div>
            <FreeNote film={f} />
            {f.overview && <p className="mt-5 text-[15px] leading-relaxed text-white/80">{f.overview}</p>}
            <dl className="mt-5 space-y-1.5 text-sm">
              {f.directors.length > 0 && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-white/45">Director</dt>
                  <dd>{f.directors.join(", ")}</dd>
                </div>
              )}
              {f.cast.length > 0 && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-white/45">Starring</dt>
                  <dd>{f.cast.join(", ")}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-2xl bg-white/[0.06] p-5">
            <div className="flex items-center gap-3">
              <Ring score={f.score} size={60} />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Consensus</div>
                <div className="text-lg font-semibold leading-tight">{f.label}</div>
                <div className="text-xs text-white/55">{f.agree}</div>
              </div>
            </div>
            <div className="mt-5 space-y-2.5">
              {SOURCES.map((src) => {
                const p = f.s[src.key];
                return (
                  <div key={src.key} className="text-xs">
                    <div className="mb-1 flex justify-between text-white/70">
                      <span>{src.name}</span>
                      <span className="tabular-nums">{p ?? "—"}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10">
                      {p !== undefined && <div className="h-full rounded-full" style={{ width: `${p}%`, background: src.color }} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href={`/film/${f.id}`} className="mt-5 block text-sm font-medium text-white/90 hover:text-white">
              Full score breakdown →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FreeNote({ film }: { film: StreamFilm }) {
  const { services } = useStream();
  const library = film.services.filter((sid) => services[sid]?.library).map((sid) => services[sid].short);
  const mine = film.services.filter((sid) => services[sid]?.sub).map((sid) => services[sid].short);
  const free = film.services.some((sid) => !services[sid]?.sub);
  const parts = [
    mine.length ? `Included with your ${mine.join(" and ")}` : "",
    free ? `free with ads${library.length ? ` (${library.join(" and ")} need a library card)` : ""}` : "",
  ].filter(Boolean);
  const text = parts.join("; ");
  return <p className="mt-2 text-xs text-white/40">{text.charAt(0).toUpperCase() + text.slice(1)}. Availability changes daily.</p>;
}

/* ---------------------------------------------------------------- player */

// Most of YouTube's free movies refuse to play outside youtube.com, and its
// Data API can't tell which. YouTube's own player can: it reports error 150
// within a moment. So before offering "Play movie" we load the movie into a
// hidden, muted player and see whether YouTube allows it. Results are cached
// for the page's lifetime.
const embedChecks = new Map<string, Promise<boolean>>();
function checkEmbed(videoId: string) {
  let check = embedChecks.get(videoId);
  if (!check) {
    check = loadYouTube().then(
      (YT) =>
        new Promise<boolean>((resolve) => {
          const host = document.createElement("div");
          host.style.cssText = "position:fixed;left:-10000px;top:0;width:256px;height:144px;pointer-events:none";
          host.setAttribute("aria-hidden", "true");
          document.body.appendChild(host);
          const el = document.createElement("div");
          host.appendChild(el);
          let settled = false;
          const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            try {
              player.stopVideo?.();
              player.destroy();
            } catch {}
            host.remove();
            resolve(ok);
          };
          // Callbacks only fire after construction, so `player` is set by then.
          const player: YTPlayer & { mute?: () => void; playVideo?: () => void; stopVideo?: () => void } = new YT.Player(el, {
            videoId,
            host: "https://www.youtube-nocookie.com",
            playerVars: { autoplay: 0, mute: 1, controls: 0, playsinline: 1 },
            events: {
              onReady: () => {
                player.mute?.();
                player.playVideo?.();
                // No refusal shortly after loading means YouTube allows it here.
                setTimeout(() => finish(true), 2500);
              },
              onError: () => finish(false),
              onStateChange: (e: { data: number }) => (e.data === 1 || e.data === 3) && finish(true),
            },
          });
          // Never heard back: don't offer it.
          setTimeout(() => finish(false), 10000);
        }),
    );
    embedChecks.set(videoId, check);
  }
  return check;
}

/** "movie" once YouTube confirmed the full movie plays here, else "trailer", else null. */
function usePlayMode(film: StreamFilm): "movie" | "trailer" | null {
  const [movieOk, setMovieOk] = useState<{ id: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!film.ytMovie) return;
    let live = true;
    const id = film.ytMovie;
    checkEmbed(id).then((ok) => live && setMovieOk({ id, ok }));
    return () => {
      live = false;
    };
  }, [film.ytMovie]);
  if (film.ytMovie && movieOk?.id === film.ytMovie && movieOk.ok) return "movie";
  return film.trailer ? "trailer" : null;
}

/** Full movie when YouTube allows it here, otherwise the trailer. Nothing if neither. */
function PlayButton({ film, primary = false, trailerOnly = false }: { film: StreamFilm; primary?: boolean; trailerOnly?: boolean }) {
  const { play } = useStream();
  const mode = usePlayMode(film);
  const what = trailerOnly ? (film.trailer ? "trailer" : null) : mode;
  if (!what) return null;
  return (
    <button
      onClick={() => play(film.id, what)}
      className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold transition active:scale-[0.97] ${
        primary ? "bg-white text-black hover:bg-white/90" : "stream-glass"
      }`}
    >
      <span aria-hidden>▶</span> {what === "movie" ? "Play movie" : "Trailer"}
    </button>
  );
}

/**
 * The site's own player. Trailers and YouTube's free movies play here (both
 * embeddable); Watch buttons underneath go on to the free services, which
 * don't allow embedding.
 */
function Player({ film: f, what, onClose }: { film: StreamFilm; what: "trailer" | "movie"; onClose: () => void }) {
  const { play } = useStream();
  const mode = usePlayMode(f);
  const id = what === "movie" ? f.ytMovie : f.trailer;
  const sorted = useSorted(f.services);
  const back = useRef<HTMLButtonElement>(null);
  // Set when YouTube refuses to play the video here (removed, restricted...).
  const [failedId, setFailedId] = useState<string | null>(null);
  const failed = failedId === id;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    back.current?.focus();
    // Capture phase so Escape closes only the player, not the sheet under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);
  if (!id) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={`${f.title} ${what}`} className="stream-fade fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <button
          ref={back}
          onClick={onClose}
          aria-label="Close player"
          className="stream-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
        >
          ×
        </button>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold">{f.title}</div>
          <div className="text-xs text-white/55">{what === "movie" ? "Full movie · free on YouTube" : "Official trailer"}</div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-0 sm:px-6">
        <div className="aspect-video w-full max-w-[min(100%,calc((100vh-12rem)*16/9))] overflow-hidden bg-black sm:rounded-2xl">
          {failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#111] px-6 text-center">
              <div className="text-lg font-semibold">This {what === "movie" ? "movie" : "trailer"} can&apos;t play here</div>
              <p className="max-w-sm text-sm text-white/55">YouTube only allows it on youtube.com. You can still watch it free below.</p>
            </div>
          ) : (
            <YouTube key={id} id={id} title={`${f.title} ${what}`} onError={() => setFailedId(id)} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-5 sm:py-6">
        {what === "trailer" || failed ? (
          <>
            <span className="w-full text-center text-sm text-white/60 sm:w-auto">{failed ? "Watch it free on" : "Like what you see?"}</span>
            {mode === "movie" && what === "trailer" && !failed && (
              <button
                onClick={() => play(f.id, "movie")}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-black"
              >
                ▶ Play the movie here
              </button>
            )}
            <WatchButton film={f} primary={mode !== "movie" || failed} full />
            {sorted.slice(1, 3).map((sid) => (
              <WatchButton key={sid} film={f} serviceId={sid} />
            ))}
          </>
        ) : (
          <span className="text-sm text-white/55">Streaming from YouTube, free with ads.</span>
        )}
      </div>
    </div>
  );
}

type YTPlayer = { destroy: () => void };
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host: string;
      playerVars: Record<string, number>;
      events: { onReady?: () => void; onError: () => void; onStateChange?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApi: Promise<YTNamespace> | null = null;
/** YouTube's IFrame API, loaded once. It reports when a video refuses to play. */
function loadYouTube() {
  ytApi ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApi;
}

function YouTube({ id, title, onError }: { id: string; title: string; onError: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });
  useEffect(() => {
    let player: YTPlayer | undefined;
    let cancelled = false;
    loadYouTube().then((YT) => {
      if (cancelled || !box.current) return;
      const el = document.createElement("div");
      box.current.appendChild(el);
      player = new YT.Player(el, {
        videoId: id,
        host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: { onError: () => onErrorRef.current() },
      });
    });
    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, [id]);
  return <div ref={box} title={title} className="stream-yt h-full w-full" />;
}

/* ---------------------------------------------------------------- shared */

function WatchButton({
  film,
  serviceId,
  primary = false,
  full = false,
}: {
  film: StreamFilm;
  serviceId?: number;
  primary?: boolean;
  /** "Watch free on Tubi" rather than just "Tubi". */
  full?: boolean;
}) {
  const { services } = useStream();
  const sorted = useSorted(film.services);
  const sid = serviceId ?? sorted[0] ?? film.services[0];
  const s = sid !== undefined ? services[sid] : undefined;
  // Straight to the film on the service (scripts/free-links.ts).
  const href = sid !== undefined ? film.links?.[sid] : undefined;
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2.5 rounded-full py-2.5 pl-2.5 pr-5 text-[15px] font-semibold transition active:scale-[0.97] ${
        primary ? "bg-white text-black hover:bg-white/90" : "stream-glass"
      }`}
    >
      {s?.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img(s.logo, "w92")} alt="" className="h-7 w-7 rounded-md" />
      ) : (
        <span className="pl-2">▶</span>
      )}
      {primary || full ? (s?.sub ? `Watch on ${s.short}` : `Watch free${s ? ` on ${s.short}` : ""}`) : s?.short ?? "Watch"}
    </a>
  );
}

// Which service to lead with when a film is on several: the viewer's own
// subscriptions first (no ads), then the big ad-supported apps, library
// services last.
const PREFERRED = [
  "Tubi TV",
  "Pluto TV",
  "The Roku Channel",
  "Plex",
  "Amazon Prime Video Free with Ads",
  "Fandango at Home Free",
  "Xumo Play",
  "YouTube Free",
  "Fawesome",
];
const rank = (s: StreamService | undefined) => {
  if (!s) return 99;
  if (s.sub) return -1;
  const i = PREFERRED.indexOf(s.name);
  return i > -1 ? i : s.library ? 50 : 20;
};
/** Services in lead order: the tab being browsed first, then by PREFERRED. */
function useSorted(ids: number[]) {
  const { services, preferred } = useStream();
  return ids
    .filter((sid) => services[sid])
    .sort((a, b) => Number(b === preferred) - Number(a === preferred) || rank(services[a]) - rank(services[b]));
}

function ServiceTag({ ids }: { ids: number[] }) {
  const { services } = useStream();
  const known = useSorted(ids);
  if (!known.length) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {known.slice(0, 4).map((sid) =>
          services[sid].logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={sid} src={img(services[sid].logo, "w92")} alt={services[sid].short} title={services[sid].short} className="h-6 w-6 rounded-md ring-2 ring-black/60" />
          ) : null,
        )}
      </div>
      <span className="text-[13px] font-medium uppercase tracking-wider text-white/75">
        {services[known[0]].sub ? "On" : "Free on"} {services[known[0]].short}
        {known.length > 1 ? ` + ${known.length - 1} more` : ""}
      </span>
    </div>
  );
}

function Meta({ f, className = "" }: { f: StreamFilm; className?: string }) {
  const parts = [
    f.year,
    f.genres.slice(0, 3).join(", "),
    f.runtime ? `${Math.floor(f.runtime / 60)}h ${f.runtime % 60}m` : null,
  ].filter(Boolean);
  return (
    <div className={`flex flex-wrap items-center gap-x-2 text-sm text-white/70 ${className}`}>
      {f.rated && <span className="rounded border border-white/40 px-1.5 text-[11px] font-semibold leading-4 text-white/80">{f.rated}</span>}
      {parts.join("  ·  ")}
    </div>
  );
}

function Ring({ score, size }: { score: number | null; size: number }) {
  const stroke = size >= 50 ? 4 : 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Consensus score ${score ?? "unavailable"}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.18)" strokeWidth={stroke} />
        {score !== null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
        )}
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-bold tabular-nums ${size >= 50 ? "text-lg" : "text-[13px]"}`}>
        {score ?? "–"}
      </span>
    </div>
  );
}
