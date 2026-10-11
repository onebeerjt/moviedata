import type { Metadata } from "next";
import Link from "next/link";
import { Stream, type StreamService } from "@/components/stream";
import { buildStream, serviceName, streamServices } from "@/lib/free";

export const metadata: Metadata = {
  title: "Free movies",
  description: "Every movie streaming free on Tubi, Pluto TV, Plex, The Roku Channel and more, ranked by one balanced score.",
};

export default async function FreePage({ searchParams }: PageProps<"/free">) {
  const { service } = await searchParams;
  const { all, featured, updatedAt } = streamServices();
  const active = featured.find((s) => String(s.id) === service) ?? null;
  const { hero, rows, films, total } = buildStream(active?.id ?? null);
  const services: Record<number, StreamService & { short: string }> = Object.fromEntries(
    all.map((s) => [s.id, { id: s.id, name: s.name, logo: s.logo, library: s.library, short: serviceName(s) }]),
  );

  return (
    <div className="stream">
      <Stream
        key={active?.id ?? "all"}
        films={films}
        services={services}
        hero={hero}
        rows={rows}
        preferred={active?.id ?? null}
        toolbar={
          <nav aria-label="Streaming services" className="scroller flex gap-2 overflow-x-auto px-5 py-3 sm:px-10 lg:px-14">
            <ServiceLink href="/free" label="All free" active={!active} count={total} />
            {featured.map((s) => (
              <ServiceLink
                key={s.id}
                href={`/free?service=${s.id}`}
                label={serviceName(s)}
                logo={s.logo}
                active={active?.id === s.id}
              />
            ))}
          </nav>
        }
      />

      <p className="px-5 pb-10 text-xs text-white/35 sm:px-10 lg:px-14">
        {total.toLocaleString()} movies streaming free in the US{active ? ` on ${serviceName(active)}` : ""}. Streaming
        availability from JustWatch via TMDB
        {updatedAt ? `, updated ${new Date(updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.
        Free services show ads; Kanopy and Hoopla need a library card.
      </p>
    </div>
  );
}

function ServiceLink({ href, label, logo, active, count }: { href: string; label: string; logo?: string; active: boolean; count?: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-4 text-sm font-medium whitespace-nowrap transition ${
        logo ? "pl-1.5" : "pl-4"
      } ${active ? "bg-white text-black" : "stream-glass text-white/85 hover:text-white"}`}
    >
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://image.tmdb.org/t/p/w92${logo}`} alt="" className="h-6 w-6 rounded-full" />
      )}
      {label}
      {count !== undefined && active && <span className="text-black/50 tabular-nums">{count.toLocaleString()}</span>}
    </Link>
  );
}
