import { type Alert, getProvider } from "../../providers/registry";
import { registerView, type ViewContext, type ViewModule } from "../registry";
import { tierOf } from "./score";
// Ensure the GitHub adapter registers itself (side-effect import).
import "../../providers/github/adapter";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function fixVersion(a: Alert): string {
  const raw = a.raw as any;
  return raw?.security_vulnerability?.first_patched_version?.identifier ?? "";
}

interface Scored extends Alert { score: number; tier: ReturnType<typeof tierOf>; }

function statsHtml(rows: Scored[]): string {
  const total = rows.length;
  const p0 = rows.filter(r => r.tier === "P0").length;
  const p1 = rows.filter(r => r.tier === "P1").length;
  const fixable = total ? Math.round(100 * rows.filter(r => r.fixAvailable).length / total) : 0;
  const card = (label: string, value: string | number) =>
    `<div class="stat"><div class="stat-v">${value}</div><div class="stat-l">${label}</div></div>`;
  return `<div class="stats">${card("Total", total)}${card("P0", p0)}${card("P1", p1)}${card("Fixable", fixable + "%")}</div>`;
}

function tableHtml(rows: Scored[]): string {
  const head = `<tr><th>Repo</th><th>Package</th><th>Severity</th><th>Score</th><th>Tier</th></tr>`;
  const body = rows.map((r, i) => `
    <tr class="alert-row" data-i="${i}">
      <td>${esc(r.repo)}</td>
      <td>${esc(r.package)}</td>
      <td><span class="sev sev-${esc(r.severity)}">${esc(r.severity)}</span></td>
      <td>${r.score}</td>
      <td><span class="tier tier-${r.tier}">${r.tier}</span></td>
    </tr>`).join("");
  return `<table class="alerts"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function drawerHtml(r: Scored): string {
  const fix = fixVersion(r);
  return `
    <div class="drawer-inner">
      <h3>${esc(r.package)} <span class="tier tier-${r.tier}">${r.tier}</span></h3>
      <p class="muted">${esc(r.repo)} · score ${r.score}</p>
      <dl>
        <dt>Severity</dt><dd>${esc(r.severity)} (CVSS ${r.cvss})</dd>
        <dt>Scope</dt><dd>${esc(r.scope ?? "unknown")}</dd>
        <dt>Fix</dt><dd>${r.fixAvailable ? (fix ? "available: " + esc(fix) : "available") : "none yet"}</dd>
        <dt>Advisory</dt><dd>${r.ghsaUrl ? `<a href="${esc(r.ghsaUrl)}" target="_blank" rel="noreferrer">${esc(r.ghsaUrl)}</a>` : "—"}</dd>
      </dl>
      <button class="drawer-close">Close</button>
    </div>`;
}

export const securityAlertsView: ViewModule = {
  id: "security-alerts",
  needs: ["alerts"],
  mount(root: HTMLElement, ctx: ViewContext) {
    const token = ctx.token();
    if (!token) {
      root.innerHTML = `<p class="muted">Paste your token above, then click Refresh.</p>`;
      return;
    }
    root.innerHTML = `<p class="muted">Loading alerts…</p>`;
    getProvider("github").alerts({ org: ctx.org, repos: ctx.repos, token })
      .then((alerts) => {
        const rows: Scored[] = alerts
          .map((a) => { const score = ctx.score(a); return { ...a, score, tier: tierOf(score) }; })
          .sort((x, y) => y.score - x.score);
        if (!rows.length) {
          root.innerHTML = `<p class="muted">No open alerts for the configured repos. 🎉</p>`;
          return;
        }
        root.innerHTML = statsHtml(rows) + tableHtml(rows) + `<aside class="drawer" hidden></aside>`;
        const drawer = root.querySelector<HTMLElement>(".drawer")!;
        root.querySelectorAll<HTMLElement>(".alert-row").forEach((tr) => {
          tr.addEventListener("click", () => {
            drawer.innerHTML = drawerHtml(rows[Number(tr.dataset.i)]);
            drawer.hidden = false;
            drawer.querySelector(".drawer-close")?.addEventListener("click", () => { drawer.hidden = true; });
          });
        });
      })
      .catch((err) => {
        root.innerHTML = `<p class="error">Failed to load alerts: ${esc(err?.message ?? err)}</p>`;
      });
  },
};

registerView(securityAlertsView);
