import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ServicesBar } from "@/components/services-bar";
import { Stream, type StreamService } from "@/components/stream";
import { buildStream, parseSubs, serviceName, streamServices } from "@/lib/free";
import { SUBSCRIPTIONS, SUBS_COOKIE } from "@/lib/subscriptions";

export const metadata: Metadata = {
  title: "Find a movie",
  description:
    "Every movie streaming free on Tubi, Pluto TV, Plex, The Roku Channel and more, plus your Netflix, Max, Hulu and other services, ranked by one balanced score.",
};

export default async function WatchPage({ searchParams }: PageProps<"/watch">) {
  const { service } = await searchParams;
  const subs = parseSubs((await cookies()).get(SUBS_COOKIE)?.value);
  const mySubs = SUBSCRIPTIONS.filter((s) => subs.includes(s.id));
  const { all, featured, updatedAt } = streamServices();
  // Tabs: the viewer's subscriptions first, then the free services.
  const tabs = [
    ...mySubs.map((s) => ({ id: s.id, label: s.name, logo: s.logo, mine: true })),
    ...featured.map((s) => ({ id: s.id, label: serviceName(s), logo: s.logo })),
  ];
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
        chunkParams={`service=${active?.id ?? ""}&subs=${subs.join("-")}`}
        header={
          <header key="header" className="px-5 pb-3 pt-5 sm:px-10 lg:px-14">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Find something to watch</h1>
            <p className="mt-0.5 text-sm text-white/55">Free movies plus your services, ranked by one balanced score.</p>
          </header>
        }
        intro={
          <ServicesBar
            key="services"
            selected={subs}
            tabs={tabs}
            active={active?.id ?? null}
            total={total}
          />
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
