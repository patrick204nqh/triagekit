import type { AgentHandoffV1, HandoffIntent } from "./types";
import { renderMarkdown } from "./markdown";
import { esc } from "../layout/util";

export interface BriefSurfaceCallbacks {
  onOutcomeChange(value: string): void;
  onConstraintChange(index: number, value: string): void;
  onVerificationChange(index: number, value: string): void;
  onCopy(): void;
  onDownloadMarkdown(): void;
  onDownloadJSON(): void;
  onClose(): void;
}

export class BriefSurface {
  private drawer!: HTMLElement;
  private scrim!: HTMLElement;
  private head!: HTMLElement;
  private body!: HTMLElement;
  private preview!: HTMLElement;
  private status!: HTMLElement;
  private foot!: HTMLElement;
  private closeBtn!: HTMLElement;
  private copyBtn!: HTMLElement;
  private callbacks: BriefSurfaceCallbacks | null = null;
  private returnFocus: HTMLElement | null = null;

  mount(container: HTMLElement): void {
    this.drawer = document.createElement("aside");
    this.drawer.className = "brief-drawer";
    this.drawer.hidden = true;
    this.drawer.setAttribute("role", "dialog");
    this.drawer.setAttribute("aria-label", "Agent Brief");

    this.scrim = document.createElement("div");
    this.scrim.className = "brief-scrim";
    this.scrim.hidden = true;
    this.scrim.addEventListener("click", () => this.callbacks?.onClose());

    this.drawer.innerHTML = `
      <div class="brief-head">
        <h2 tabindex="-1">Agent Brief</h2>
        <button class="drawer-close" aria-label="Close brief">×</button>
      </div>
      <div class="brief-body"></div>
      <div class="brief-status" aria-live="polite"></div>
      <div class="brief-foot">
        <button class="btn" data-copy>Copy Markdown</button>
        <button class="btn ghost" data-dl-md>Download .md</button>
        <button class="btn ghost" data-dl-json>Download .json</button>
      </div>`;

    this.head = this.drawer.querySelector(".brief-head")!;
    this.body = this.drawer.querySelector(".brief-body")!;
    this.status = this.drawer.querySelector(".brief-status")!;
    this.foot = this.drawer.querySelector(".brief-foot")!;
    this.closeBtn = this.drawer.querySelector(".drawer-close")!;
    this.copyBtn = this.drawer.querySelector("[data-copy]")!;

    this.closeBtn.addEventListener("click", () => this.callbacks?.onClose());
    this.copyBtn.addEventListener("click", () => this.callbacks?.onCopy());
    this.foot.querySelector("[data-dl-md]")!.addEventListener("click", () => this.callbacks?.onDownloadMarkdown());
    this.foot.querySelector("[data-dl-json]")!.addEventListener("click", () => this.callbacks?.onDownloadJSON());

    container.appendChild(this.scrim);
    container.appendChild(this.drawer);
  }

  open(handoff: AgentHandoffV1, callbacks: BriefSurfaceCallbacks, returnFocus?: HTMLElement): void {
    this.callbacks = callbacks;
    this.returnFocus = returnFocus ?? null;
    this.renderContent(handoff);
    this.drawer.hidden = false;
    this.scrim.hidden = false;
    requestAnimationFrame(() => this.drawer.classList.add("open"));
    this.head.querySelector("h2")!.focus();
  }

  close(): void {
    this.drawer.classList.remove("open");
    this.drawer.hidden = true;
    this.scrim.hidden = true;
    this.status.textContent = "";
    if (this.returnFocus) this.returnFocus.focus();
  }

  showStatus(message: string): void {
    this.status.textContent = message;
  }

  private renderContent(handoff: AgentHandoffV1): void {
    const intent = handoff.intent;
    this.body.innerHTML = "";

    this.body.appendChild(this.fieldBlock("Outcome", "outcome", intent.outcome, true,
      v => this.callbacks?.onOutcomeChange(v)));

    const cBlock = document.createElement("div");
    cBlock.className = "brief-item";
    cBlock.innerHTML = "<label>Constraints</label><div id=\"brief-constraints\"></div>";
    this.renderListFields(cBlock.querySelector("#brief-constraints")!, intent.constraints, "constraint",
      (i, v) => this.callbacks?.onConstraintChange(i, v));
    this.body.appendChild(cBlock);

    const vBlock = document.createElement("div");
    vBlock.className = "brief-item";
    vBlock.innerHTML = "<label>Verification</label><div id=\"brief-verification\"></div>";
    this.renderListFields(vBlock.querySelector("#brief-verification")!, intent.verification, "verification",
      (i, v) => this.callbacks?.onVerificationChange(i, v));
    this.body.appendChild(vBlock);

    const disclosure = document.createElement("div");
    disclosure.className = "brief-item";
    disclosure.style.fontSize = "12px";
    disclosure.style.color = "var(--muted)";
    disclosure.textContent = "This brief contains the selected item's repository context and provider link. It does not contain your GitHub token.";
    this.body.appendChild(disclosure);

    const pBlock = document.createElement("div");
    pBlock.className = "brief-item";
    pBlock.innerHTML = "<label>Preview</label>";
    this.preview = document.createElement("div");
    this.preview.className = "brief-preview";
    this.preview.textContent = renderMarkdown(handoff);
    pBlock.appendChild(this.preview);
    this.body.appendChild(pBlock);
  }

  private fieldBlock(label: string, id: string, value: string, multiLine: boolean,
    onChange: (v: string) => void): HTMLElement {
    const block = document.createElement("div");
    block.className = "brief-item";
    const el = multiLine
      ? (() => { const t = document.createElement("textarea"); t.rows = 3; return t; })()
      : document.createElement("input");
    el.id = `brief-${id}`;
    el.value = value;
    el.addEventListener("input", () => onChange((el as HTMLInputElement).value));
    block.innerHTML = `<label for=\"brief-${id}\">${esc(label)}</label>`;
    block.appendChild(el);
    return block;
  }

  private renderListFields(container: HTMLElement, items: readonly string[],
    prefix: string, onChange: (i: number, v: string) => void): void {
    for (let i = 0; i < items.length; i++) {
      const input = document.createElement("input");
      input.value = items[i];
      input.placeholder = `Add ${prefix}...`;
      const idx = i;
      input.addEventListener("input", () => onChange(idx, (input as HTMLInputElement).value));
      container.appendChild(input);
    }
  }
}
