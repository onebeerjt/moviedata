export type SourceKey = "letterboxd" | "imdb" | "tmdb" | "rt" | "metacritic";

export type SourceScore = {
  /** Raw value on the source's own scale (e.g. 4.12 of 5, 7.9 of 10, 93%). */
  v: number;
  /** Number of ratings, when the source reports it. */
  n?: number;
  /** Percentile 0–100 among all films we track on that source (after vote-count shrinkage). */
  p: number;
};

export type Film = {
  id: string; // IMDb id, e.g. tt0110912
  title: string;
  year: number | null;
  runtime: number | null;
  genres: string[];
  directors: string[];
  cast: string[];
  poster?: string;
  backdrop?: string;
  overview?: string;
  rated?: string;
  releaseDate?: string;
  nowPlaying?: boolean;
  letterboxdSlug?: string;
  s: Partial<Record<SourceKey, SourceScore>>;
  /** Mean percentile of audience sources (Letterboxd, IMDb, TMDB). */
  audience: number | null;
  /** Mean percentile of critic sources (Rotten Tomatoes, Metacritic). */
  critics: number | null;
  /** The balanced score, 0–100. */
  score: number | null;
  /** Largest gap between any two source percentiles. */
  spread: number | null;
  /** Daily snapshots for recent releases: [date, letterboxd, imdb, rt, metacritic] raw values. */
  h?: [string, number | null, number | null, number | null, number | null][];
};

export type Person = {
  id: string;
  name: string;
  directed: string[];
  actedIn: string[];
};

export type GroupStat = {
  key: string;
  label: string;
  count: number;
  /** Mean of (Letterboxd percentile − IMDb percentile). Positive = Letterboxd likes it more. */
  lbVsImdb: number | null;
  /** Mean of (critics − audience). Positive = critics like it more. */
  criticsVsAudience: number | null;
  avgScore: number | null;
  /** How many films in the group have both Letterboxd and IMDb / both critic and audience data. */
  lbN: number;
  caN: number;
};

export type Insights = {
  generatedAt: string;
  filmCount: number;
  sourceCounts: Partial<Record<SourceKey, number>>;
  genres: GroupStat[];
  decades: GroupStat[];
  directors: GroupStat[];
};
