import type { ScoredItem } from "./kind-renderer";
import type { ScoreExplanation } from "../../scoring/score-model";
import { esc } from "../util";

// Always-on-where-possible transparency: a per-signal factor table when a configured
// model scored the row, or a compact built-in note otherwise. Appends to `host`.
export function renderScoreBreakdown(host: HTMLElement, item: ScoredItem, explanation: ScoreExplanation | null): void {
  const block = document.createElement("div");
  block.className = "score-detail";
  if (!explanation) {
    block.innerHTML = `<h4>Score</h4>
      <p class="muted">Built-in scorer · score ${item.score} · <span class="tier tier-${item.tier}">${esc(item.tier)}</span></p>
      <p class="muted">Configure scoring in Settings to see the per-factor breakdown.</p>`;
  } else {
    const rows = Object.entries(explanation.signals).map(([name, s]) =>
      `<tr><td>${esc(name)}</td><td class="muted">${esc(s.from)}</td><td>${esc(s.raw)}</td><td class="num">${s.value.toFixed(2)}</td></tr>`).join("");
    block.innerHTML = `<h4>Score breakdown</h4>
      <table class="breakdown"><thead><tr><th>Signal</th><th>Field</th><th>Raw</th><th>0–1</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="bd-total">score <strong>${explanation.score}</strong> → <span class="tier tier-${item.tier}">${esc(item.tier)}</span></p>`;
  }
  host.appendChild(block);
}
