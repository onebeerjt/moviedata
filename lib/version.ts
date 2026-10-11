export type VersionId = "v1" | "v2";

export const VERSIONS: { id: VersionId; name: string; blurb: string }[] = [
  { id: "v1", name: "V1", blurb: "The original site" },
  { id: "v2", name: "V2", blurb: "New features" },
];

export const DEFAULT_VERSION: VersionId = "v2";
export const VERSION_STORAGE_KEY = "consensus-version";
