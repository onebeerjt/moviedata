import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-5xl">Not in our index</h1>
      <p className="mt-3 text-text-2">We track the ~12,000 most-rated films. Try searching for another title.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-text px-5 py-2 text-sm text-bg">
        Back home
      </Link>
    </div>
  );
}
