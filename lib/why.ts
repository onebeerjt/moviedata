// "Why they split": a few plain sentences built only from numbers we hold. Every
// sentence is conditional on the data saying so; nothing here is boilerplate opinion.
import { getInsights } from "./data";
import type { Film, GroupStat } from "./types";

const standing = (p: number) => (p >= 50 ? `top ${Math.max(1, Math.round(100 - p))}%` : `bottom ${Math.max(1, Math.round(p))}%`);
const round = (n: number) => Math.round(n);

export type Why = { headline: string; paragraphs: string[]; quad: { key: "canon" | "ydarling" | "xdarling" | "bomb"; name: string } | null };

export function why(f: Film): Why {
  const ins = getInsights();
  const out: string[] = [];
  const { letterboxd: lb, imdb, rt, metacritic: mc } = f.s;
  const A = f.audience;
  const C = f.critics;
  let headline = "";
  let quad: Why["quad"] = null;

  if (A !== null && C !== null) {
    const gap = C - A;
    quad =
      C >= 50 && A >= 50
        ? { key: "canon", name: "The Canon" }
        : C >= 50
          ? { key: "ydarling", name: "Critics' darling" }
          : A >= 50
            ? { key: "xdarling", name: "Crowd pleaser" }
            : { key: "bomb", name: "The Bomb Zone" };
    if (Math.abs(gap) < 10) {
      headline = "Critics and audiences agree";
      out.push(`Critics put this in the ${standing(C)} of films and audiences in the ${standing(A)}. Close enough that there's no real argument here.`);
    } else if (gap >= 10) {
      headline = gap >= 30 ? "Critics love it. Audiences don't." : gap >= 15 ? "Critics like it more than audiences do" : "Critics lean a little higher";
      out.push(`Critics rank it in the ${standing(C)} of films; audiences in the ${standing(A)}. That's a ${round(gap)}-point gap.`);
    } else {
      headline = gap <= -30 ? "Audiences love it. Critics don't." : gap <= -15 ? "Audiences like it more than critics do" : "Audiences lean a little higher";
      out.push(`Audiences rank it in the ${standing(A)} of films; critics in the ${standing(C)}. That's a ${round(-gap)}-point gap.`);
    }
  } else if (A !== null) {
    headline = "Audience scores only, so far";
    out.push("There's no Rotten Tomatoes or Metacritic score yet, so there's no critic-versus-audience split to explain. The score below rests on audience sites alone.");
  } else if (C !== null) {
    headline = "Critic scores only, so far";
    out.push("Audience sites haven't rated this yet, so there's no split to explain. The score rests on critics alone.");
  } else {
    headline = "Not enough sources to compare";
  }

  // Letterboxd vs IMDb, with the genre/director context from the whole catalog.
  if (lb && imdb) {
    const d = lb.p - imdb.p;
    if (Math.abs(d) >= 12) {
      const higher = d > 0 ? "Letterboxd" : "IMDb";
      const lower = d > 0 ? "IMDb" : "Letterboxd";
      let s = `Among audiences, ${higher} ranks it ${round(Math.abs(d))} points above ${lower}.`;
      const lean = (st: GroupStat | undefined) => (st && st.lbN >= 40 && st.lbVsImdb !== null && Math.sign(st.lbVsImdb) === Math.sign(d) && Math.abs(st.lbVsImdb) >= 4 ? st : undefined);
      const genre = f.genres.map((g) => lean(ins?.genres.find((s) => s.key === g))).filter((s): s is GroupStat => !!s).sort((a, b) => Math.abs(b.lbVsImdb!) - Math.abs(a.lbVsImdb!))[0];
      const dir = f.directors
        .map((id) => ins?.directors.find((s) => s.key === id))
        .filter((s): s is GroupStat => !!s && s.lbN >= 5 && s.lbVsImdb !== null && Math.sign(s.lbVsImdb) === Math.sign(d) && Math.abs(s.lbVsImdb) >= 5)
        .sort((a, b) => Math.abs(b.lbVsImdb!) - Math.abs(a.lbVsImdb!))[0];
      if (genre) s += ` Part of that is the genre: across the catalog ${higher} ranks ${genre.label} films ${Math.abs(genre.lbVsImdb!).toFixed(0)} points above ${lower}.`;
      if (dir) s += ` ${dir.label} films get the same tilt (${higher} +${Math.abs(dir.lbVsImdb!).toFixed(0)} on average over ${dir.lbN} films).`;
      out.push(s);
    }
  }

  // Rotten Tomatoes counts thumbs-up; Metacritic averages scores.
  if (rt && mc) {
    const d = rt.p - mc.p;
    if (d >= 20) out.push("Rotten Tomatoes is well above Metacritic. RT counts how many critics gave a thumbs-up, Metacritic averages how much they liked it: lots of mild approval, not many raves.");
    else if (d <= -20) out.push("Metacritic is well above Rotten Tomatoes. Fewer critics gave it a thumbs-up, but those who did scored it high: a divisive film with real fans.");
  }

  if (A !== null && C !== null && Math.abs(C - A) >= 15 && ins) {
    const lean = f.genres
      .map((g) => ins.genres.find((s) => s.key === g))
      .filter((s): s is GroupStat => !!s && s.caN >= 40 && s.criticsVsAudience !== null && Math.sign(s.criticsVsAudience) === Math.sign(C - A) && Math.abs(s.criticsVsAudience) >= 4)
      .sort((a, b) => Math.abs(b.criticsVsAudience!) - Math.abs(a.criticsVsAudience!))[0];
    if (lean) out.push(`Genre plays a part: across the catalog, ${C > A ? "critics" : "audiences"} rank ${lean.label} films ${Math.abs(lean.criticsVsAudience!).toFixed(0)} points higher than ${C > A ? "audiences" : "critics"} do.`);
  }

  const votes = imdb?.n ?? 0;
  if (f.score !== null && votes < 5000) out.push(`Only ${votes.toLocaleString("en-US")} IMDb ratings so far. Early or small audiences swing the numbers, so expect these to move.`);

  // Real movement from the daily snapshots (recent releases only).
  if (f.h && f.h.length >= 2) {
    const first = f.h[0];
    const last = f.h[f.h.length - 1];
    const moves: string[] = [];
    if (first[1] !== null && last[1] !== null && Math.abs(last[1] - first[1]) >= 0.1) moves.push(`Letterboxd ${first[1].toFixed(2)} → ${last[1].toFixed(2)}`);
    if (first[2] !== null && last[2] !== null && Math.abs(last[2] - first[2]) >= 0.2) moves.push(`IMDb ${first[2].toFixed(1)} → ${last[2].toFixed(1)}`);
    if (first[3] !== null && last[3] !== null && Math.abs(last[3] - first[3]) >= 5) moves.push(`Rotten Tomatoes ${Math.round(first[3])}% → ${Math.round(last[3])}%`);
    if (moves.length) out.push(`Since ${first[0]}: ${moves.join(", ")}.`);
  }

  return { headline, paragraphs: out, quad };
}
