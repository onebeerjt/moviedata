import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Search } from "@/components/search";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description:
    "One balanced movie score built from Letterboxd, IMDb, Rotten Tomatoes, Metacritic and TMDB, with every source side by side so you can see where they disagree.",
};

const nav = [
  { href: "/explore", label: "Explore" },
  { href: "/insights", label: "Insights" },
  { href: "/about", label: "How it works" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6">
            <Link href="/" className="font-display text-2xl leading-none whitespace-nowrap">
              {SITE_NAME}
            </Link>
            <div className="min-w-0 flex-1">
              <Search />
            </div>
            <nav className="hidden items-center gap-5 text-sm text-text-2 md:flex">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-text">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <nav className="scroller flex gap-5 overflow-x-auto px-4 pb-2 text-sm text-text-2 md:hidden">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap hover:text-text">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-8 text-xs leading-relaxed text-text-3">
            Ratings data from IMDb (non-commercial datasets), Letterboxd, TMDB and OMDb (Rotten Tomatoes and Metacritic). This
            product uses the TMDB API but is not endorsed or certified by TMDB. Scores belong to their respective sites;{" "}
            {SITE_NAME} links to every source.
          </div>
        </footer>
      </body>
    </html>
  );
}
