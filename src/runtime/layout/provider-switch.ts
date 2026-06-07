// src/runtime/layout/provider-switch.ts
import { esc } from "./triage-table";
import { providerIcon } from "../shell/provider-icons";

export interface SwitchProvider { id: string; label: string; on: boolean; live: boolean; }
export interface ProviderSwitchProps {
  providers: SwitchProvider[];
  onSelect: (id: string) => void;
}

// Single-select provider scope. >1 provider -> segmented selector (top-right);
// exactly 1 -> static brand chip; 0 -> nothing (shell shows an empty state).
export function renderProviderSwitch(host: HTMLElement, p: ProviderSwitchProps): void {
  if (p.providers.length === 0) { host.innerHTML = ""; return; }
  if (p.providers.length === 1) {
    const only = p.providers[0];
    host.innerHTML = `<span class="prov-chip">${providerIcon(only.id, 14)}${esc(only.label)}</span>`;
    return;
  }
  host.innerHTML = `<div class="prov-seg">` + p.providers.map(pr =>
    `<button class="prov-opt${pr.on ? " on" : ""}${pr.live ? "" : " up"}" data-prov="${esc(pr.id)}"${pr.live ? "" : ` aria-disabled="true"`}>`
    + `${providerIcon(pr.id, 14)}${esc(pr.label)}${pr.live ? "" : ` <span class="prov-soon">soon</span>`}</button>`
  ).join("") + `</div>`;

  host.querySelectorAll<HTMLElement>("[data-prov]").forEach(b =>
    b.addEventListener("click", () => {
      const id = b.dataset.prov!;
      const pr = p.providers.find(x => x.id === id);
      if (pr?.live) p.onSelect(id);     // upcoming providers are not selectable
    }));
}
