"use client";

import { useState } from "react";

export function ShareButton({ title, text, className = "" }: { title: string; text?: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function share() {
    const url = window.location.href.split("#")[0];
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title, text, url });
      else {
        await navigator.clipboard.writeText(url);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }
    } catch {
      /* share sheet dismissed */
    }
  }
  return (
    <button onClick={share} className={`rounded-full border border-line px-4 py-2 text-sm text-text hover:bg-surface-2 ${className}`}>
      {done ? "Link copied ✓" : "Share"}
    </button>
  );
}
