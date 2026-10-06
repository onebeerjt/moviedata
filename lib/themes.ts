// The five site designs. The id is stored in localStorage and set as
// <html data-theme>; all the styling lives in app/globals.css.
export const THEMES = [
  { id: "cinema", name: "Cinema", blurb: "Dark screening room" },
  { id: "broadsheet", name: "Broadsheet", blurb: "Newspaper film section" },
  { id: "marquee", name: "Marquee", blurb: "Old movie palace" },
  { id: "rewind", name: "Rewind", blurb: "Neon video store" },
  { id: "index", name: "Index", blurb: "Swiss poster grid" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "cinema";
export const THEME_STORAGE_KEY = "consensus-theme";

/** Runs in <head> before paint so the saved design shows without a flash. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(${JSON.stringify(
  THEMES.map((t) => t.id),
)}.indexOf(t)>-1)document.documentElement.dataset.theme=t}catch(e){}`;
