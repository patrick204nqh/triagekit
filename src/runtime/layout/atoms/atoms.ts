import { esc } from "../util";
import type { Tier } from "../../scoring/tier";
import type { Actor, Label, CheckStatus, Permalink, Relation } from "../../dataset/shared";
import { providerIcon } from "../../shell/provider-icons";
import type { DetailView } from "../table/detail-view";

export interface Sla { label: string; state: "ok" | "warn" | "breach"; }

export function tierBadgeHtml(tier: Tier): string {
  return `<span class="tier tier-${tier}">${tier}</span>`;
}

// Shared detail-panel header for plain (non-review) kinds: title + tier chip
// inline, then a muted sub-line. Reuses the existing `.drawer h3` / `.drawer .muted`
// styles, so no new CSS is needed. Escapes title and sub internally — pass raw strings.
export function detailHeaderHtml(opts: { title: string; tier: Tier; sub: string }): string {
  return `<h3>${esc(opts.title)} ${tierBadgeHtml(opts.tier)}</h3>`
    + `<p class="muted">${esc(opts.sub)}</p>`;
}

// The single detail-drawer header used by every kind: title + tier inline, then
// a sub-row with the provider mark and an optional linked ref (e.g. "#482").
// Replaces per-kind headers and the literal provider text. Escapes title/ref.
export function detailHeadHtml(header: DetailView["header"]): string {
  const ref = header.ref
    ? (header.ref.href
        ? `<a class="dh-ref-link" href="${esc(header.ref.href)}" target="_blank" rel="noreferrer">${esc(header.ref.text)} ↗</a>`
        : `<span>${esc(header.ref.text)}</span>`)
    : "";
  return `<div class="dh-title"><h3>${esc(header.title)} ${tierBadgeHtml(header.tier)}</h3></div>`
    + `<div class="dh-ref">${providerIcon(header.provider)}${ref}</div>`;
}

export function slaTagHtml(sla: Sla): string {
  return `<span class="sla sla-${sla.state}">${esc(sla.label)}</span>`;
}

export function actorChipHtml(a: Actor, role?: string, opts: { showName?: boolean } = {}): string {
  const init = esc(a.login.slice(0, 2).toUpperCase());
  const botCls = a.kind === "bot" ? " bot" : "";
  // GitHub bot logins carry a noisy "[bot]" suffix; the avatar's bot styling already
  // marks them, so drop it from the visible name (the full login stays in the tooltip).
  const display = a.login.replace(/\[bot\]$/i, "");
  const name = opts.showName ? ` <span class="actor-name">${esc(display)}</span>` : "";
  const r = role ? ` <span class="muted">${esc(role)}</span>` : "";
  const av = a.avatarUrl
    ? `<img class="av av-img${botCls}" src="${esc(a.avatarUrl)}" alt="${esc(a.login)}" data-initials="${init}" loading="lazy">`
    : `<span class="av${botCls}">${init}</span>`;
  return `<span class="actor" title="${esc(a.login)}">${av}${name}${r}</span>`;
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
