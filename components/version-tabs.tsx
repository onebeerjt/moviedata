"use client";

import { VERSIONS } from "@/lib/version";
import { useVersion } from "./version-context";

/** V1 / V2 switcher, shown in the top bar of every page. */
export function VersionTabs() {
  const { version, setVersion } = useVersion();
  return (
    <div role="tablist" aria-label="Site version" className="flex shrink-0 gap-1 py-1.5">
      {VERSIONS.map((v) => (
        <button
          key={v.id}
          role="tab"
          aria-selected={version === v.id}
          title={v.blurb}
          onClick={() => setVersion(v.id)}
          className={`theme-tab shrink-0 rounded-full px-3 py-1 text-xs whitespace-nowrap transition ${
            version === v.id ? "bg-text text-bg" : "text-text-2 hover:bg-surface-2 hover:text-text"
          }`}
        >
          {v.name}
        </button>
      ))}
    </div>
  );
}
