# Consensus (moviedata)

One balanced movie score built from Letterboxd, IMDb, TMDB, Rotten Tomatoes and Metacritic, with every source shown side by side so you can see where they disagree.

- **Film pages**: balanced score, every source on one 0–100 scale, plain-English notes on where sources split.
- **People pages**: a director's or actor's career, source by source, and how each site leans on their work.
- **Explore**: every film plotted one source against another; outliers are colored by which site likes them more.
- **Insights**: which genres, decades and directors each site rates higher.

## How the score works

1. Each source's rating is shrunk toward that site's average when it has relatively few votes (Bayesian average).
2. It's converted to a percentile within that site, which cancels out each site's built-in inflation.
3. Audience sources (Letterboxd, IMDb, TMDB) and critic sources (RT, Metacritic) are averaged separately, then weighted 50/50.

Details are in `scripts/build.ts` and on the site's `/about` page.

## Data pipeline

Everything lives in `scripts/` and writes JSON to `data/`:

| Command | Source | Needs |
| --- | --- | --- |
| `npm run data:imdb` | IMDb non-commercial datasets (top ~12k films + recent releases) | nothing |
| `npm run data:tmdb` | Posters, overviews, TMDB ratings, now playing | `TMDB_API_KEY` or `TMDB_READ_TOKEN` |
| `npm run data:letterboxd` | Letterboxd public film pages (polite, rate-limited) | nothing |
| `npm run data:omdb` | Rotten Tomatoes + Metacritic via OMDb | `OMDB_API_KEY` |
| `npm run data:build` | Merges everything into `data/site/*.json` | — |
| `npm run data:daily` | All of the above in order | — |

Refresh cadence is by film age: released in the last 60 days, daily; last year, weekly; older, every ~6 weeks. A GitHub Action (`.github/workflows/daily-data.yml`) runs the pipeline every morning and commits the new data, which triggers a redeploy.

Keys go in `.env.local` locally (see `.env.example`) and in the repo's **Settings → Secrets → Actions** for the daily job.

## Run locally

```bash
npm install
npm run data:imdb && npm run data:build   # first time only, ~5 min
npm run dev
```

Note: IMDb's datasets are for non-commercial use, and Letterboxd's terms don't allow scraping. Fine for a personal project; revisit before monetizing.
