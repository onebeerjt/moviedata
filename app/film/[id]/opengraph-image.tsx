import { ImageResponse } from "next/og";
import { getFilm, posterUrl } from "@/lib/data";
import { SOURCES } from "@/lib/sources";
import { why } from "@/lib/why";

export const alt = "Where the sources split";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Real data only: the film's own scores, and its real poster from TMDB.
const COLORS: Record<string, string> = { letterboxd: "#199e70", imdb: "#c98500", tmdb: "#3987e5", rt: "#d95926", metacritic: "#9085e9" };

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const film = getFilm((await params).id);
  if (!film) return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#0e0e0d", color: "#f4f3ee", fontSize: 64, alignItems: "center", justifyContent: "center" }}>Consensus</div>, size);
  const poster = posterUrl(film.poster, "w342");
  const headline = why(film).headline;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0e0e0d", color: "#f4f3ee", padding: 48, fontFamily: "sans-serif" }}>
        {poster && (
          <img src={poster} width={340} height={510} alt="" style={{ borderRadius: 12, objectFit: "cover" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: poster ? 48 : 0, justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#8a897f", textTransform: "uppercase" }}>Consensus · {film.year}</div>
            <div style={{ display: "flex", fontSize: film.title.length > 24 ? 54 : 70, lineHeight: 1.05, marginTop: 8, fontWeight: 700 }}>{film.title}</div>
            <div style={{ display: "flex", fontSize: 30, color: "#c3c2b7", marginTop: 12 }}>{headline}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", width: 150, height: 150, borderRadius: 75, border: "10px solid #f4f3ee", alignItems: "center", justifyContent: "center", fontSize: 72, fontWeight: 700 }}>{film.score ?? "–"}</div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 36 }}>
              {SOURCES.map((s) => {
                const x = film.s[s.key];
                return (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", height: 30, marginBottom: 4 }}>
                    <div style={{ display: "flex", width: 190, fontSize: 22, color: "#c3c2b7" }}>{s.name}</div>
                    <div style={{ display: "flex", flex: 1, height: 12, borderRadius: 6, background: "#242422", position: "relative" }}>
                      {x && <div style={{ display: "flex", width: `${x.p}%`, height: 12, borderRadius: 6, background: COLORS[s.key] }} />}
                    </div>
                    <div style={{ display: "flex", width: 60, justifyContent: "flex-end", fontSize: 22, color: x ? "#f4f3ee" : "#8a897f" }}>{x ? Math.round(x.p) : "–"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
