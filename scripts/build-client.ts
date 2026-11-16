// Compact, column-oriented copies of the catalog for the browser (Quad, search,
// Versus, "My taste"). Reads only data/site/*.json and writes public/data/*, so it
// always matches the films the site was built from. Runs before `next dev|build`.
import { join } from "node:path";
import { ROOT, SITE, readJson, writeJson } from "./util.ts";
import type { Film, Person, SourceKey } from "../lib/types.ts";

const OUT = join(ROOT, "public/data");
const KEYS: SourceKey[] = ["letterboxd", "imdb", "tmdb", "rt", "metacritic"];

const films = readJson<Film[]>(join(SITE, "films.json"), []);
const people = readJson<Record<string, Person>>(join(SITE, "people.json"), {});
if (!films.length) throw new Error("data/site/films.json is missing: run `npm run data:build`");

// Genres by size so the mask bit order is stable between builds.
const genreCount = new Map<string, number>();
for (const f of films) for (const g of f.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
const genres = [...genreCount].sort((a, b) => b[1] - a[1]).map(([g]) => g);
const bit = new Map(genres.map((g, i) => [g, i]));

const tenths = (x: number | undefined) => (x === undefined ? -1 : Math.round(x * 10));
const num = (id: string) => {
  const n = Number(id.slice(2));
  // The browser rebuilds ids as "tt" + zero-padded number (lib/lite.ts); make sure that round-trips.
  if (`tt${String(n).padStart(7, "0")}` !== id) throw new Error(`Unexpected IMDb id shape: ${id}`);
  return n;
};

const lite = {
  // id = IMDb number without "tt"; yr 0 = unknown; sc/au/cr in whole points, -1 = missing;
  // p.<source> = percentile in tenths (0–1000), -1 = missing; v = IMDb votes; lb = Letterboxd ratings count.
  n: films.length,
  genres,
  id: films.map((f) => num(f.id)),
  t: films.map((f) => f.title),
  yr: films.map((f) => f.year ?? 0),
  g: films.map((f) => f.genres.reduce((m, g) => m | (1 << bit.get(g)!), 0)),
  sc: films.map((f) => f.score ?? -1),
  au: films.map((f) => f.audience ?? -1),
  cr: films.map((f) => f.critics ?? -1),
  v: films.map((f) => f.s.imdb?.n ?? 0),
  p: Object.fromEntries(KEYS.map((k) => [k, films.map((f) => tenths(f.s[k]?.p))])),
};
writeJson(join(OUT, "lite.json"), lite);

// Poster paths, "/abc.jpg" -> "abc" ("" when none). Loaded lazily, after the first search or tap.
writeJson(join(OUT, "posters.json"), films.map((f) => (f.poster ? f.poster.replace(/^\//, "").replace(/\.jpg$/, "") : "")));

// People with at least three credits, for search: [id number, name, directed count, acted count].
const rows = Object.values(people)
  .filter((p) => p.directed.length + p.actedIn.length >= 3 && p.name !== p.id)
  .sort((a, b) => b.directed.length + b.actedIn.length - (a.directed.length + a.actedIn.length))
  .map((p) => [Number(p.id.slice(2)), p.name, p.directed.length, p.actedIn.length]);
writeJson(join(OUT, "people.json"), rows);
console.log(`client data: ${films.length} films, ${rows.length} people -> public/data`);
