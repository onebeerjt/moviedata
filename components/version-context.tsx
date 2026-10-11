"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_VERSION, VERSION_STORAGE_KEY, type VersionId } from "@/lib/version";

const CHANGE = "consensus-version-change";

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}

function read(): VersionId {
  try {
    return localStorage.getItem(VERSION_STORAGE_KEY) === "v2" ? "v2" : DEFAULT_VERSION;
  } catch {
    return DEFAULT_VERSION;
  }
}

type Ctx = { version: VersionId; setVersion: (v: VersionId) => void };
const VersionContext = createContext<Ctx>({ version: DEFAULT_VERSION, setVersion: () => {} });

/** Which site version is showing. The server and first paint are always V1; V2 applies after hydration. */
export function VersionProvider({ children }: { children: ReactNode }) {
  const version = useSyncExternalStore(subscribe, read, () => DEFAULT_VERSION);
  const setVersion = (v: VersionId) => {
    try {
      localStorage.setItem(VERSION_STORAGE_KEY, v);
    } catch {}
    window.dispatchEvent(new Event(CHANGE));
  };
  return <VersionContext.Provider value={{ version, setVersion }}>{children}</VersionContext.Provider>;
}

export const useVersion = () => useContext(VersionContext);
