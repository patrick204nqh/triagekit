// Theme: "auto" follows the OS, "light"/"dark" pin a choice. Persisted (non-secret)
// in localStorage. A no-flash bootstrap in index.html applies the resolved theme
// before first paint; this module owns runtime changes + the auto/system watch.
export type ThemeChoice = "auto" | "light" | "dark";
const KEY = "triagekit.theme";

export function getThemeChoice(): ThemeChoice {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "auto";
}
function systemDark(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}
export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  return choice === "auto" ? (systemDark() ? "dark" : "light") : choice;
}
export function applyTheme(choice: ThemeChoice = getThemeChoice()): void {
  document.documentElement.setAttribute("data-theme", resolveTheme(choice));
}
export function setThemeChoice(choice: ThemeChoice): void {
  if (choice === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice);
  applyTheme(choice);
}
// Advance the explicit choice (auto → light → dark → auto) and apply it. The
// top-right toggle uses this so it never silently destroys an "auto" preference.
const CYCLE: ThemeChoice[] = ["auto", "light", "dark"];
export function cycleTheme(from: ThemeChoice = getThemeChoice()): ThemeChoice {
  const next = CYCLE[(CYCLE.indexOf(from) + 1) % CYCLE.length];
  setThemeChoice(next);
  return next;
}
// Keep "auto" live when the OS flips between light/dark.
export function watchSystemTheme(): void {
  if (typeof matchMedia !== "function") return;
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemeChoice() === "auto") applyTheme("auto");
  });
}
