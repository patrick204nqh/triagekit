// Auto-refresh cadence — non-secret, localStorage, survives sessions. The data is
// snapshot-only (no backend/history), so "refresh" is just a periodic re-fetch.
// 0 = off. Pairs with the manual refresh control in the command bar.
const KEY = "triagekit.refresh";
export const REFRESH_OPTIONS: { value: number; label: string }[] = [
  { value: 0,   label: "Off" },
  { value: 300, label: "5m" },
  { value: 600, label: "10m" },
];
export function getRefreshInterval(): number {
  const v = Number(localStorage.getItem(KEY));
  return REFRESH_OPTIONS.some(o => o.value === v) ? v : 0;
}
export function setRefreshInterval(seconds: number): void {
  if (seconds > 0) localStorage.setItem(KEY, String(seconds));
  else localStorage.removeItem(KEY);
}
// "updated 3m ago" style relative stamp from an epoch-ms timestamp.
export function relativeSince(ts: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
