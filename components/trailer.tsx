"use client";

import { useState } from "react";

/** Click-to-load YouTube trailer: nothing from YouTube loads until you press play. */
export function Trailer({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="relative aspect-video bg-black">
        {on ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
            title={`${title} trailer`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button onClick={() => setOn(true)} aria-label={`Play ${title} trailer`} className="group absolute inset-0 block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />
            <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-bg/80 text-2xl text-text backdrop-blur">▶</span>
          </button>
        )}
      </div>
      <div className="px-4 py-2 text-xs text-text-3">Official trailer · plays on YouTube</div>
    </div>
  );
}
