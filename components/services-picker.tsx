"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { SUBSCRIPTIONS, SUBS_COOKIE } from "@/lib/subscriptions";

// "Add your services" on the Free page. Picks are kept in a cookie so the
// server can build the page with free movies plus the viewer's subscriptions.
const logo = (path: string) => `https://image.tmdb.org/t/p/w92${path}`;

export function ServicesPicker({ selected }: { selected: number[] }) {
  const [open, setOpen] = useState(false);
  const chosen = SUBSCRIPTIONS.filter((s) => selected.includes(s.id));
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 text-sm font-semibold whitespace-nowrap transition ${
          chosen.length ? "stream-glass pl-1.5 pr-4" : "bg-white/90 px-4 text-black hover:bg-white"
        }`}
      >
        {chosen.length ? (
          <>
            <span className="flex -space-x-2">
              {chosen.slice(0, 3).map((s) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={s.id} src={logo(s.logo)} alt="" className="h-6 w-6 rounded-full ring-2 ring-black" />
              ))}
            </span>
            My services{chosen.length > 3 ? ` +${chosen.length - 3}` : ""}
          </>
        ) : (
          <>
            <span aria-hidden className="text-base leading-none">＋</span> Add your services
          </>
        )}
      </button>
      {/* Portaled to <body>: the toolbar sits in a stacking context below the site header. */}
      {open && createPortal(<Sheet initial={selected} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Sheet({ initial, onClose }: { initial: number[]; onClose: () => void }) {
  const router = useRouter();
  const [picked, setPicked] = useState(() => new Set(initial));
  const [saving, startSaving] = useTransition();
  const done = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const toggle = (id: number) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function save() {
    const ids = SUBSCRIPTIONS.filter((s) => picked.has(s.id)).map((s) => s.id);
    document.cookie = ids.length
      ? `${SUBS_COOKIE}=${ids.join("-")}; path=/; max-age=31536000; samesite=lax`
      : `${SUBS_COOKIE}=; path=/; max-age=0; samesite=lax`;
    // Re-render the page on the server with the new services.
    startSaving(() => {
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="stream stream-fade fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="services-title"
        onClick={(e) => e.stopPropagation()}
        className="stream-pop max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[#1c1c1e] p-6 shadow-2xl sm:rounded-3xl sm:p-8"
      >
        <h2 id="services-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
          Your streaming services
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Pick the ones you pay for. You&apos;ll see their movies alongside everything that&apos;s free.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {SUBSCRIPTIONS.map((s) => {
            const on = picked.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                aria-pressed={on}
                className={`relative flex flex-col items-center gap-2 rounded-2xl p-3 text-center text-xs font-medium transition active:scale-95 ${
                  on ? "bg-white/15 ring-2 ring-white" : "bg-white/[0.06] text-white/70 hover:bg-white/10"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo(s.logo)} alt="" className={`h-12 w-12 rounded-xl transition ${on ? "" : "opacity-80 grayscale-[30%]"}`} />
                <span className="leading-tight">{s.name}</span>
                {on && (
                  <span aria-hidden className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={() => setPicked(new Set())} className="text-sm text-white/55 hover:text-white">
            Clear all
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold text-white/70 hover:text-white">
              Cancel
            </button>
            <button
              ref={done}
              onClick={save}
              disabled={saving}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Done"}
            </button>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-white/35">Saved on this device only. Availability from JustWatch, US.</p>
      </div>
    </div>
  );
}
