import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Film, Insights, Person } from "./types";

// The data pipeline (scripts/) writes these files; pages read them on the server.
const dir = join(process.cwd(), "data/site");
const load = <T,>(file: string, fallback: T): T => {
  try {
    return JSON.parse(readFileSync(join(dir, file), "utf8")) as T;
  } catch {
    return fallback;
  }
};

let cache: { films: Film[]; byId: Map<string, Film>; people: Record<string, Person>; insights: Insights | null } | null =
  null;

function db() {
  if (!cache) {
    const films = load<Film[]>("films.json", []);
    cache = {
      films,
      byId: new Map(films.map((f) => [f.id, f])),
      people: load<Record<string, Person>>("people.json", {}),
      insights: load<Insights | null>("insights.json", null),
    };
  }
  return cache;
}

export const allFilms = () => db().films;
export const getFilm = (id: string) => db().byId.get(id);
export const getPerson = (id: string) => db().people[id];
export const getInsights = () => db().insights;
export const filmsByIds = (ids: string[]) => ids.map((id) => db().byId.get(id)).filter((f): f is Film => !!f);
export const personName = (id: string) => db().people[id]?.name ?? "Unknown";

/** Films famous enough that most visitors will recognise them. */
export const isWellKnown = (f: Film, minVotes = 50_000) => (f.s.imdb?.n ?? 0) >= minVotes;

export function searchAll(q: string, limit = 8) {
  const needle = normalize(q);
  if (needle.length < 2) return { films: [], people: [] };
  const { films, people } = db();
  const filmHits = films
    .filter((f) => normalize(f.title).includes(needle))
    .sort((a, b) => rank(a.title, needle) - rank(b.title, needle) || (b.s.imdb?.n ?? 0) - (a.s.imdb?.n ?? 0))
    .slice(0, limit);
  const peopleHits = Object.values(people)
    .filter((p) => p.directed.length + p.actedIn.length >= 3 && normalize(p.name).includes(needle))
    .sort((a, b) => rank(a.name, needle) - rank(b.name, needle) || b.directed.length + b.actedIn.length - (a.directed.length + a.actedIn.length))
    .slice(0, 4);
  return { films: filmHits, people: peopleHits };
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "");
const rank = (s: string, needle: string) => {
  const n = normalize(s);
  return n === needle ? 0 : n.startsWith(needle) ? 1 : 2;
};

export const posterUrl = (path: string | undefined, size: "w185" | "w342" | "w500" | "w780" | "w1280" = "w342") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
