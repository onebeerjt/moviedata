import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ServicesPicker } from "@/components/services-picker";
import { Stream, type StreamService } from "@/components/stream";
import { buildStream, parseSubs, serviceName, streamServices } from "@/lib/free";
import { SUBSCRIPTIONS, SUBS_COOKIE } from "@/lib/subscriptions";

export const metadata: Metadata = {
  title: "Free movies",
  description:
    "Every movie streaming free on Tubi, Pluto TV, Plex, The Roku Channel and more, plus your Netflix, Max, Hulu and other services, ranked by one balanced score.",
};

export default async function FreePage({ searchParams }: PageProps<"/free">) {
  const { service } = await searchParams;
  const subs = parseSubs((await cookies()).get(SUBS_COOKIE)?.value);
  const mySubs = SUBSCRIPTIONS.filter((s) => subs.includes(s.id));
  const { all, featured, updatedAt } = streamServices();
  // Tabs: the viewer's subscriptions first, then the free services.
  const tabs = [...mySubs.map((s) => ({ id: s.id, label: s.name, logo: s.logo })), ...featured.map((s) => ({ id: s.id, label: serviceName(s), logo: s.logo }))];
  const active = tabs.find((t) => String(t.id) === service) ?? null;
  const { hero, rows, films, total } = buildStream(active?.id ?? null, subs);
  const services: Record<number, StreamService & { short: string }> = Object.fromEntries([
    ...all.map((s) => [s.id, { id: s.id, name: s.name, logo: s.logo, library: s.library, short: serviceName(s) }]),
    ...SUBSCRIPTIONS.map((s) => [s.id, { id: s.id, name: s.name, logo: s.logo, sub: true, short: s.name }]),
  ]);

  return (
    <div className="stream">
      <Stream
        key={`${active?.id ?? "all"}|${subs.join("-")}`}
        films={films}
        services={services}
        hero={hero}
        rows={rows}
        preferred={active?.id ?? null}
        toolbar={
          <nav aria-label="Streaming services" className="scroller flex items-center gap-2 overflow-x-auto px-5 py-3 sm:px-10 lg:px-14">
            <ServicesPicker selected={subs} />
            <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-white/15" />
            <ServiceLink href="/free" label={subs.length ? "All" : "All free"} active={!active} count={total} />
            {tabs.map((t) => (
              <ServiceLink key={t.id} href={`/free?service=${t.id}`} label={t.label} logo={t.logo} active={active?.id === t.id} />
            ))}
          </nav>
        }
      />

      <p className="px-5 pb-10 text-xs text-white/35 sm:px-10 lg:px-14">
        {total.toLocaleString()} movies {active ? `on ${active.label}` : subs.length ? "free or on your services" : "streaming free"} in
        the US. Streaming availability from JustWatch via TMDB
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
