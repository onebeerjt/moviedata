import { posterUrl, searchAll } from "@/lib/data";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const { films, people } = searchAll(q);
  return Response.json({
    films: films.map((f) => ({
      id: f.id,
      title: f.title,
      year: f.year,
      score: f.score,
      poster: posterUrl(f.poster, "w185"),
    })),
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.directed.length >= p.actedIn.length ? "Director" : "Actor",
      count: p.directed.length + p.actedIn.length,
    })),
  });
}
