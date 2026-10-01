import { createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync, statSync, renameSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

export const ROOT = join(import.meta.dirname, "..");
export const RAW = join(ROOT, "data/raw");
export const SOURCES = join(ROOT, "data/sources");
export const SITE = join(ROOT, "data/site");

// Load KEY=value pairs from .env.local / .env without a dependency.
for (const file of [".env.local", ".env"]) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

export function writeJson(path: string, data: unknown, pretty = false) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, pretty ? JSON.stringify(data, null, 1) : JSON.stringify(data));
}

/** Download a file (resumable, with retries) unless a copy younger than maxAgeHours exists. */
export async function download(url: string, dest: string, maxAgeHours = 20) {
  if (existsSync(dest) && (Date.now() - statSync(dest).mtimeMs) / 3.6e6 < maxAgeHours) return;
  mkdirSync(dirname(dest), { recursive: true });
  console.log(`  downloading ${url}`);
  execFileSync("curl", ["-fsSL", "--retry", "8", "--retry-all-errors", "-C", "-", "-o", dest + ".part", url], {
    stdio: "inherit",
  });
  renameSync(dest + ".part", dest);
}

/** Stream rows of a gzipped IMDb TSV file. */
export async function* tsvRows(path: string): AsyncGenerator<string[]> {
  const rl = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
  let header = true;
  for await (const line of rl) {
    if (header) {
      header = false;
      continue;
    }
    yield line.split("\t");
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

/** How many days since the film's release year/date — used to decide refresh cadence. */
export function staleAfterDays(year: number | null, releaseDate?: string | null) {
  const released = releaseDate ? new Date(releaseDate) : year ? new Date(`${year}-07-01`) : null;
  if (!released) return 30;
  const age = (Date.now() - released.getTime()) / 864e5;
  if (age < 60) return 1; // in theaters / just released: daily
  if (age < 365) return 7; // this year: weekly
  return 45; // catalogue: every ~6 weeks
}

export function isStale(fetchedAt: string | undefined, days: number) {
  return !fetchedAt || (Date.now() - new Date(fetchedAt).getTime()) / 864e5 >= days;
}
