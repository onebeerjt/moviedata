// Pulls IMDb's free daily datasets (https://developer.imdb.com/non-commercial-datasets/)
// and keeps the most-voted feature films with their directors and top-billed cast.
// Usage: node scripts/ingest-imdb.ts [--limit 10000]
import { join } from "node:path";
import { RAW, SOURCES, arg, download, readJson, tsvRows, writeJson } from "./util.ts";

const LIMIT = Number(arg("limit", "10000"));
const BASE = "https://datasets.imdbws.com";
const files = ["title.ratings", "title.basics", "title.crew", "title.principals", "name.basics"];

export type ImdbFilm = {
  title: string;
  year: number | null;
  runtime: number | null;
  genres: string[];
  rating: number;
  votes: number;
  directors: string[];
  cast: string[];
};

console.log("IMDb: downloading datasets");
for (const f of files) await download(`${BASE}/${f}.tsv.gz`, join(RAW, `${f}.tsv.gz`));

console.log("IMDb: reading ratings");
const ratings = new Map<string, [number, number]>();
for await (const [id, rating, votes] of tsvRows(join(RAW, "title.ratings.tsv.gz"))) {
  if (Number(votes) >= 100) ratings.set(id, [Number(rating), Number(votes)]);
}

console.log("IMDb: reading titles");
const candidates: [string, ImdbFilm][] = [];
for await (const [id, type, title, , adult, start, , runtime, genres] of tsvRows(join(RAW, "title.basics.tsv.gz"))) {
  if (type !== "movie" || adult === "1") continue;
  const r = ratings.get(id);
  if (!r) continue;
  candidates.push([
    id,
    {
      title,
      year: start === "\\N" ? null : Number(start),
      runtime: runtime === "\\N" ? null : Number(runtime),
      genres: genres === "\\N" ? [] : genres.split(","),
      rating: r[0],
      votes: r[1],
      directors: [],
      cast: [],
    },
  ]);
}
// Keep the most-voted films, plus anything recent or in theaters even if it
// hasn't built up many votes yet.
candidates.sort((a, b) => b[1].votes - a[1].votes);
const recentYear = new Date().getFullYear() - 1;
const nowPlaying = new Set(readJson<{ ids: string[] }>(join(SOURCES, "now-playing.json"), { ids: [] }).ids);
const films = new Map(
  candidates.filter(
    ([id, f], i) => i < LIMIT || nowPlaying.has(id) || ((f.year ?? 0) >= recentYear && f.votes >= 500),
  ),
);
ratings.clear();

console.log(`IMDb: kept ${films.size} films, reading crew`);
const people = new Set<string>();
for await (const [id, directors] of tsvRows(join(RAW, "title.crew.tsv.gz"))) {
  const film = films.get(id);
  if (!film || directors === "\\N") continue;
  film.directors = directors.split(",").slice(0, 3);
  film.directors.forEach((p) => people.add(p));
}

console.log("IMDb: reading cast (largest file, takes a minute)");
for await (const [id, ordering, person, category] of tsvRows(join(RAW, "title.principals.tsv.gz"))) {
  const film = films.get(id);
  if (!film || (category !== "actor" && category !== "actress")) continue;
  if (Number(ordering) <= 12 && film.cast.length < 6) {
    film.cast.push(person);
    people.add(person);
  }
}

console.log(`IMDb: resolving ${people.size} names`);
const names: Record<string, string> = {};
for await (const [id, name] of tsvRows(join(RAW, "name.basics.tsv.gz"))) {
  if (people.has(id)) names[id] = name;
}

writeJson(join(SOURCES, "imdb.json"), Object.fromEntries(films));
writeJson(join(SOURCES, "imdb-people.json"), names);
console.log("IMDb: done");
