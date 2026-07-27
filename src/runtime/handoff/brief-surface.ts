import type { AgentHandoffV1 } from "./types";
import { renderMarkdown } from "./markdown";
import { esc } from "../layout/util";

export interface BriefSurfaceCallbacks {
  onCopy(): void;
  onDownloadMarkdown(): void;
  onDownloadJSON(): void;
  onClose(): void;
}

export class BriefSurface {
  private drawer!: HTMLElement;
  private scrim!: HTMLElement;
  private headMeta!: HTMLElement;
  private body!: HTMLElement;
  private status!: HTMLElement;
  private foot!: HTMLElement;
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
        <div class="brief-head-left">
          <h2 tabindex="-1">Agent Brief</h2>
          <span class="brief-meta"></span>
        </div>
        <button class="drawer-close" aria-label="Close brief">×</button>
      </div>
      <div class="brief-body"></div>
      <div class="brief-status" aria-live="polite"></div>
      <div class="brief-foot"></div>`;

    this.headMeta = this.drawer.querySelector(".brief-meta")!;
    this.body = this.drawer.querySelector(".brief-body")!;
    this.status = this.drawer.querySelector(".brief-status")!;
    this.foot = this.drawer.querySelector(".brief-foot")!;
    const closeBtn = this.drawer.querySelector(".drawer-close")!;
    closeBtn.addEventListener("click", () => this.callbacks?.onClose());

    container.appendChild(this.scrim);
    container.appendChild(this.drawer);
  }

  open(handoff: AgentHandoffV1, callbacks: BriefSurfaceCallbacks, returnFocus?: HTMLElement): void {
    this.callbacks = callbacks;
    this.returnFocus = returnFocus ?? null;

    const t = handoff.targets[0];
    this.headMeta.textContent = t
      ? `${esc(t.kind)} · ${esc(t.title)} · ${t.priority.tier}`
      : "";

    this.renderReadonly(handoff);
    this.renderFoot();

    this.drawer.hidden = false;
    this.scrim.hidden = false;
    requestAnimationFrame(() => this.drawer.classList.add("open"));
    this.drawer.querySelector("h2")!.focus();
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

  private renderReadonly(handoff: AgentHandoffV1): void {
    const body = this.body;
    body.innerHTML = "";
    const intent = handoff.intent;
    const t = handoff.targets[0];
    const s = handoff.context.session;

    const disclosure = document.createElement("p");
    disclosure.className = "brief-disclosure";
    disclosure.textContent = "This brief contains the selected item's repository context and provider link. It does not contain your GitHub token.";
    body.appendChild(disclosure);

    const outcomeGroup = document.createElement("div");
    outcomeGroup.className = "brief-item";
    outcomeGroup.innerHTML = `<label>Outcome</label><p class="brief-outcome">${esc(intent.outcome)}</p>`;
    body.appendChild(outcomeGroup);

    if (t) {
      const infoGroup = document.createElement("div");
      infoGroup.className = "brief-item";
      let infoHtml = `<label>Target</label><div class="brief-info">`;
      infoHtml += `<span>Kind</span><span>${esc(t.kind)}</span>`;
      infoHtml += `<span>Provider</span><span>${esc(t.provider)}</span>`;
      infoHtml += `<span>Location</span><span>${esc(t.location)}</span>`;
      infoHtml += `<span>Tier</span><span>${t.priority.tier} (score ${t.priority.score}, signal ${t.priority.signal})</span>`;
      if (t.url) {
        infoHtml += `<span>URL</span><span><a href="${esc(t.url)}" target="_blank" rel="noreferrer">${esc(t.url)}</a></span>`;
      }
      infoHtml += `</div>`;
      infoGroup.innerHTML = infoHtml;
      body.appendChild(infoGroup);

      if (t.priority.explanation && t.priority.explanation.length > 0) {
        const evGroup = document.createElement("div");
        evGroup.className = "brief-item";
        evGroup.innerHTML = `<label>Evidence</label><ul class="brief-evidence">${t.priority.explanation.map(e =>
          `<li><strong>${esc(e.label)}</strong> ${esc(String(e.value))}${e.reason ? ` — ${esc(e.reason)}` : ""}</li>`
        ).join("")}</ul>`;
        body.appendChild(evGroup);
      }
    }

    if (intent.constraints.length > 0) {
      const cGroup = document.createElement("div");
      cGroup.className = "brief-item";
      cGroup.innerHTML = `<label>Constraints</label><ul>${intent.constraints.map(c => `<li>${esc(c)}</li>`).join("")}</ul>`;
      body.appendChild(cGroup);
    }

    if (intent.verification.length > 0) {
      const vGroup = document.createElement("div");
      vGroup.className = "brief-item";
      vGroup.innerHTML = `<label>Verification</label><ul>${intent.verification.map(v => `<li>${esc(v)}</li>`).join("")}</ul>`;
      body.appendChild(vGroup);
    }

    const ctxGroup = document.createElement("div");
    ctxGroup.className = "brief-item";
    let ctxHtml = `<label>Context</label><div class="brief-info">`;
    ctxHtml += `<span>Kind</span><span>${esc(s.kind)}</span>`;
    ctxHtml += `<span>Provider</span><span>${esc(s.provider)}</span>`;
    if (s.repository) ctxHtml += `<span>Repository</span><span>${esc(s.repository)}</span>`;
    ctxHtml += `</div>`;
    ctxGroup.innerHTML = ctxHtml;
    body.appendChild(ctxGroup);

    const md = renderMarkdown(handoff);
    const mdGroup = document.createElement("div");
    mdGroup.className = "brief-item";
    mdGroup.innerHTML = `<label>Raw Markdown</label><pre class="brief-raw">${esc(md)}</pre>`;
    body.appendChild(mdGroup);
  }

  private renderFoot(): void {
    this.foot.innerHTML = `
      <button class="btn brief-copy" data-copy>Copy Markdown</button>
      <button class="btn ghost" data-dl-md>Download .md</button>
      <button class="btn ghost" data-dl-json>Download .json</button>`;
    this.foot.querySelector("[data-copy]")!.addEventListener("click", () => this.callbacks?.onCopy());
    this.foot.querySelector("[data-dl-md]")!.addEventListener("click", () => this.callbacks?.onDownloadMarkdown());
    this.foot.querySelector("[data-dl-json]")!.addEventListener("click", () => this.callbacks?.onDownloadJSON());
  }
}
