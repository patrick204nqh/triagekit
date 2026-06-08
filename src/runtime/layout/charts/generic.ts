import type { Tier } from "../../scoring/tier";
import type { ScoredItem } from "../table/kind-renderer";
import { registerChart, type TriageChart } from "./registry";
import { esc } from "../util";

const TIERS: Tier[] = ["P0", "P1", "P2", "P3"];
const VAR: Record<Tier, string> = { P0: "--p0", P1: "--p1", P2: "--p2", P3: "--p3" };
const rank = (t: Tier) => TIERS.indexOf(t);

export const tierChart: TriageChart = {
  id: "tier", title: "Priority distribution", kinds: "*",
  meta: (rows) => `<b>${rows.length}</b> open`,
  render(rows, el) {
    const total = rows.length || 1;
    const c = Object.fromEntries(TIERS.map(t => [t, rows.filter(r => r.tier === t).length])) as Record<Tier, number>;
    const segs = TIERS.filter(t => c[t]).map(t => `<span style="width:${(100 * c[t] / total).toFixed(2)}%;background:var(${VAR[t]})"></span>`).join("");
    const legend = TIERS.map(t => `<span class="it"><span class="sw" style="background:var(${VAR[t]})"></span>${t} <span class="n">${c[t]}</span></span>`).join("");
    el.innerHTML = `<div class="tierbar">${segs}</div><div class="legend">${legend}</div>`;
  },
};

const BUCKETS = [
  { label: "<7d", lo: 0, hi: 7 }, { label: "7–30d", lo: 7, hi: 30 },
  { label: "30–90d", lo: 30, hi: 90 }, { label: ">90d", lo: 90, hi: Infinity },
];
const ageDays = (r: ScoredItem) => (Date.now() - +new Date(r.createdAt)) / 86400000;

export const ageChart: TriageChart = {
  id: "age", title: "Age", kinds: "*",
  meta: (rows) => `oldest <b>${Math.max(0, ...rows.map(r => Math.round(ageDays(r))))}d</b>`,
  render(rows, el) {
    const b = BUCKETS.map(x => {
      const rs = rows.filter(r => { const a = ageDays(r); return a >= x.lo && a < x.hi; });
      const worst = rs.length ? rs.map(r => r.tier).sort((a, c) => rank(a) - rank(c))[0] : null;
      return { ...x, n: rs.length, worst };
    });
    const max = Math.max(1, ...b.map(x => x.n));
    el.innerHTML = `<div class="ages">${b.map(x => {
      const h = x.n ? Math.round(16 + 60 * x.n / max) : 4;
      const color = x.worst ? `var(${VAR[x.worst]})` : "var(--inert)";
      const hot = x.worst === "P0" || x.worst === "P1" ? "hot" : "";
      return `<div class="agecol ${hot}"><div class="agecount">${x.n}</div><div class="agebar" style="height:${h}px;background:${color}"></div><div class="agelabel">${x.label}</div></div>`;
    }).join("")}</div>`;
  },
};

export const topLocationsChart: TriageChart = {
  id: "top-locations", title: "Top locations by priority", kinds: "*", span: true,
  render(rows, el) {
    const by: Record<string, { total: number; t: Record<Tier, number> }> = {};
    for (const r of rows) { (by[r.location] ??= { total: 0, t: { P0: 0, P1: 0, P2: 0, P3: 0 } }); by[r.location].total++; by[r.location].t[r.tier]++; }
    const list = Object.entries(by)
      .sort(([, a], [, b]) => (b.t.P0 * 1000 + b.t.P1 * 100 + b.t.P2 * 10 + b.t.P3) - (a.t.P0 * 1000 + a.t.P1 * 100 + a.t.P2 * 10 + a.t.P3) || b.total - a.total)
      .slice(0, 5);
    const maxTotal = Math.max(1, ...list.map(([, r]) => r.total));
    el.innerHTML = `<div class="bars">${list.map(([loc, r]) => {
      const segs = TIERS.filter(t => r.t[t]).map(t => `<span style="width:${(100 * r.t[t] / maxTotal).toFixed(2)}%;background:var(${VAR[t]})"></span>`).join("");
      return `<div class="barrow"><div class="name">${esc(loc)}</div><div class="track">${segs}</div><div class="n">${r.total}</div></div>`;
    }).join("")}</div>`;
  },
};

[tierChart, ageChart, topLocationsChart].forEach(registerChart);
