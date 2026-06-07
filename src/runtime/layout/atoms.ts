import { esc } from "./triage-table";
import type { Tier } from "../scoring/tier";
import type { Actor, Label, CheckStatus, Permalink, Relation } from "../dataset/shared";

export interface Sla { label: string; state: "ok" | "warn" | "breach"; }

export function tierBadgeHtml(tier: Tier): string {
  return `<span class="tier tier-${tier}">${tier}</span>`;
}

export function slaTagHtml(sla: Sla): string {
  return `<span class="sla sla-${sla.state}">${esc(sla.label)}</span>`;
}

export function actorChipHtml(a: Actor, role?: string): string {
  const init = esc(a.login.slice(0, 2).toUpperCase());
  const botCls = a.kind === "bot" ? " bot" : "";
  const r = role ? ` <span class="muted">${esc(role)}</span>` : "";
  const av = a.avatarUrl
    ? `<img class="av av-img${botCls}" src="${esc(a.avatarUrl)}" alt="${esc(a.login)}" data-initials="${init}" loading="lazy">`
    : `<span class="av${botCls}">${init}</span>`;
  return `<span class="actor" title="${esc(a.login)}">${av}${r}</span>`;
}

export function labelChipHtml(l: Label): string {
  return `<span class="lbl" style="--lbl:#${esc(l.color)}">${esc(l.name)}</span>`;
}

export function checkIndicatorHtml(c: CheckStatus | null): string {
  if (!c) return "";
  const map = {
    pass: ["ci-pass", "✓ checks"],
    fail: ["ci-fail", "✗ checks"],
    pending: ["ci-pend", "… checks"],
  } as const;
  const [cls, text] = map[c.state];
  const conf = c.conflicts
    ? ` <span class="conflict">conflicts</span>`
    : ` <span class="muted">no conflicts</span>`;
  return `<span class="check ${cls}">${text}</span>${conf}`;
}

export function permalinkLinkHtml(p: Permalink): string {
  const text = esc(p.label ?? p.kind);
  return `<a class="plink plink-${p.kind}" href="${esc(p.href)}" target="_blank" rel="noreferrer">${text} ↗</a>`;
}

export function relationStripHtml(rels: Relation[], links: Permalink[]): string {
  const fixes = rels.find(r => r.type === "fixes");
  if (!fixes) return "";
  const adv = links.find(l => l.kind === "advisory" || l.kind === "alert");
  const label = adv?.label ?? "alert";
  return adv?.href
    ? `<a class="rel rel-fixes" href="${esc(adv.href)}" target="_blank" rel="noreferrer">Fixes ${esc(label)} ↗</a>`
    : `<span class="rel rel-fixes">Fixes ${esc(label)}</span>`;
}
