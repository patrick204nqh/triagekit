import type {
  DelegationController,
  DelegationControllerSnapshot,
  DelegationValidationError,
  WorkPackageV1,
} from "../../delegation/types";
import { dismissible } from "../../shell/dismissible";
import { esc } from "../util";

function packageErrors(
  pkg: WorkPackageV1,
  errors: readonly DelegationValidationError[],
): string {
  const matching = errors.filter((error) => error.packageId === pkg.id);
  if (!matching.length) return "";
  return `<ul class="delegation-errors">${matching.map((error) =>
    `<li><a href="#${esc(pkg.id)}-heading" data-package-error="${esc(pkg.id)}">${esc(error.message)}</a></li>`).join("")}</ul>`;
}

function kindLabel(kind: string): string {
  if (kind === "dependency-vuln") return "Dependency vulnerabilities";
  if (kind === "code-scanning") return "Code scanning";
  if (kind === "change-request") return "Change requests";
  return kind.charAt(0).toUpperCase() + kind.slice(1).replaceAll("-", " ");
}

function targetState(target: WorkPackageV1["targets"][number]): string {
  const freshness = target.details.freshness as
    | { validatedAt?: string; stale?: boolean }
    | undefined;
  const truncation = target.details.truncation as
    | { field?: string; originalLength?: number }
    | undefined;
  const queue = target.details.queue as
    | {
        status?: string;
        reason?: string;
        changedFields?: readonly string[];
      }
    | undefined;
  return [
    queue?.status,
    queue?.changedFields?.length
      ? `changed ${queue.changedFields.join(", ")}`
      : undefined,
    queue?.reason,
    freshness?.validatedAt
      ? `${freshness.stale ? "stale" : "current"} · ${freshness.validatedAt}`
      : undefined,
    truncation?.field
      ? `${truncation.field} bounded ${truncation.originalLength}`
      : undefined,
  ].filter(Boolean).join(" · ") || "not revalidated";
}

function targetHtml(
  target: WorkPackageV1["targets"][number],
  expandedNotes: ReadonlySet<string>,
): string {
  const showNote = Boolean(target.note) || expandedNotes.has(target.id);
  return `<li class="delegation-target" data-target="${esc(target.id)}">
    <div class="delegation-target-main">
      <div><strong>${esc(target.title)}</strong><span class="delegation-target-meta">${esc(target.priority.tier)} · ${target.priority.score}</span></div>
      <div class="delegation-target-state">${esc(targetState(target))}</div>
    </div>
    <div class="delegation-target-actions">
      <button type="button" class="btn-ghost mini" data-add-item-note="${esc(target.id)}">${target.note ? "Edit note" : "Add note"}</button>
      <button type="button" class="btn-ghost mini" data-remove-target="${esc(target.id)}" aria-label="Deselect ${esc(target.title)} from package">Deselect</button>
    </div>
    ${showNote
      ? `<label class="delegation-item-note">Note for ${esc(target.title)}
          <textarea rows="2" data-item-note="${esc(target.id)}" placeholder="Only this target">${esc(target.note ?? "")}</textarea>
        </label>`
      : ""}
  </li>`;
}

function generatedInstructionHtml(pkg: WorkPackageV1): string {
  const intent = pkg.generatedIntent;
  return `<div class="delegation-generated-instruction">
    <span>Generated instruction</span>
    <p>${esc(intent.outcome)}</p>
    <ul>${intent.constraints.map((value) => `<li>${esc(value)}</li>`).join("")}${intent.verification.map((value) => `<li>${esc(value)}</li>`).join("")}</ul>
  </div>`;
}

function packageHtml(
  pkg: WorkPackageV1,
  errors: readonly DelegationValidationError[],
  expandedNotes: ReadonlySet<string>,
  showPackageActions: boolean,
): string {
  const packageActions = showPackageActions
    ? `<details class="delegation-action-menu" data-package-menu>
        <summary class="btn-ghost">Package actions</summary>
        <div class="delegation-action-menu-pop">
          <button type="button" class="btn-ghost" data-copy-package="${esc(pkg.id)}">Copy package</button>
          <button type="button" class="btn-ghost" data-download-package="${esc(pkg.id)}" data-format="md">Download Markdown</button>
          <button type="button" class="btn-ghost" data-download-package="${esc(pkg.id)}" data-format="json">Download JSON</button>
        </div>
      </details>`
    : "";
  return `<section class="delegation-package" id="${esc(pkg.id)}">
    <header class="delegation-package-head">
      <div><span class="delegation-order">${pkg.order}</span>
        <h3 id="${esc(pkg.id)}-heading" tabindex="-1">${esc(pkg.repository)}</h3></div>
      <span class="delegation-package-meta">${esc(kindLabel(pkg.kind))} · ${pkg.targets.length} ${pkg.targets.length === 1 ? "target" : "targets"}</span>
    </header>
    <p class="delegation-reason">${esc(pkg.selectionReason)}</p>
    ${packageErrors(pkg, errors)}
    ${generatedInstructionHtml(pkg)}
    <ul class="delegation-targets">${pkg.targets.map((target) =>
      targetHtml(target, expandedNotes)).join("")}</ul>
    ${packageActions}
  </section>`;
}

function handedOffHtml(
  items: DelegationControllerSnapshot["handedOff"],
): string {
  if (!items.length) return "";
  return `<details class="delegation-queue-section" data-queue-section="handed-off">
    <summary>Handed off · ${items.length}</summary>
    <ul>${items.map((item) =>
      `<li data-queue-history-item>
        <div><strong>${esc(item.title)}</strong><span>${esc(item.repository)} · handed off</span>${item.reason ? `<span>${esc(item.reason)}</span>` : ""}</div>
        <button type="button" class="btn-ghost mini" data-remove-queue-item="${esc(item.key)}">Remove from queue</button>
      </li>`).join("")}</ul>
  </details>`;
}

function notInNextBundleHtml(
  items: DelegationControllerSnapshot["notInNextBundle"],
): string {
  if (!items.length) return "";
  const statusLabel = (status: string) =>
    status === "resolved"
      ? "No longer found"
      : status === "unavailable"
      ? "Could not verify"
      : "Blocked";
  return `<details class="delegation-queue-section" data-queue-section="not-in-next-bundle" open>
    <summary>Not in next bundle · ${items.length}</summary>
    <p class="delegation-queue-helper">These targets need review or no longer exist.</p>
    <ul>${items.map((item) => {
      const action = item.status === "resolved"
        ? `<button type="button" class="btn-ghost mini" data-remove-queue-item="${esc(item.key)}">Remove</button>`
        : `<button type="button" class="btn-ghost mini" data-remove-target="${esc(item.itemId)}">Deselect</button>`;
      return `<li data-queue-history-item>
        <div><strong>${esc(item.title)}</strong><span>${esc(item.repository)} · ${esc(statusLabel(item.status))}</span>${item.reason ? `<span>${esc(item.reason)}</span>` : ""}</div>
        ${action}
      </li>`;
    }).join("")}</ul>
  </details>`;
}

function modeHtml(snapshot: DelegationControllerSnapshot): string {
  return `<fieldset class="delegation-mode">
    <legend>Handoff mode</legend>
    <label>
      <input type="radio" name="handoff-mode" value="investigate"${snapshot.mode === "investigate" ? " checked" : ""}>
      <span><strong>Investigate</strong><small>Analyze and propose a plan. Make no changes.</small></span>
    </label>
    <label>
      <input type="radio" name="handoff-mode" value="implement"${snapshot.mode === "implement" ? " checked" : ""}>
      <span><strong>Implement</strong><small>Make scoped changes and verify the result.</small></span>
    </label>
  </fieldset>
  <label class="delegation-mission-note" for="handoff-mission-note">
    Mission note <span>(optional)</span>
    <textarea id="handoff-mission-note" data-mission-note rows="3" placeholder="Applies to every selected target">${esc(snapshot.missionNote ?? "")}</textarea>
  </label>`;
}

export function mountHandoffComposer(
  host: HTMLElement,
  controller: DelegationController,
): () => void {
  let wasOpen = false;
  let activeDismiss: ReturnType<typeof dismissible> | null = null;
  let lastBodyHtml = "";
  const expandedNotes = new Set<string>();

  const render = (snapshot: DelegationControllerSnapshot) => {
    if (!snapshot.open) {
      activeDismiss?.destroy();
      activeDismiss = null;
      host.innerHTML = "";
      lastBodyHtml = "";
      if (wasOpen) {
        document.querySelector<HTMLElement>("[data-queue-badge]")?.focus();
      }
      wasOpen = false;
      return;
    }

    const opening = !wasOpen;
    if (opening) {
      host.innerHTML = `<div class="scrim open" data-delegation-scrim></div>
        <aside class="delegation-composer open" role="dialog" aria-modal="true" aria-labelledby="delegation-title">
          <header class="delegation-composer-head">
            <div><h2 id="delegation-title" tabindex="-1">Handoff queue</h2>
              <p data-delegation-summary></p></div>
            <button type="button" class="drawer-close" data-delegation-close aria-label="Close Handoff queue">×</button>
          </header>
          <div class="delegation-live" role="status" aria-live="polite" aria-atomic="true"></div>
          <div class="delegation-composer-body"></div>
          <footer class="delegation-composer-foot">
            <details class="delegation-action-menu" data-download-menu>
              <summary class="btn-ghost">Download…</summary>
              <div class="delegation-action-menu-pop">
                <button type="button" class="btn-ghost" data-download-all data-format="md">Download Markdown</button>
                <button type="button" class="btn-ghost" data-download-all data-format="json">Download JSON</button>
              </div>
            </details>
            <button type="button" class="btn-primary" data-copy-all></button>
          </footer>
        </aside>`;
      const composer = host.querySelector<HTMLElement>(
        ".delegation-composer",
      )!;
      const scrim = host.querySelector<HTMLElement>(
        "[data-delegation-scrim]",
      )!;
      activeDismiss = dismissible(composer, {
        scrim,
        modal: true,
        restoreFocus: false,
        onDismiss: () => controller.close(),
      });
      activeDismiss.activate();
      scrim.addEventListener("click", () => controller.close());
      host.querySelector<HTMLElement>("[data-delegation-close]")
        ?.addEventListener("click", () => controller.close());
      host.querySelector<HTMLElement>("[data-copy-all]")
        ?.addEventListener("click", () => void controller.copyBundle());
      host.querySelectorAll<HTMLElement>("[data-download-all]")
        .forEach((button) => button.addEventListener("click", () => {
          controller.downloadBundle(button.dataset.format as "md" | "json");
        }));
      wasOpen = true;
    }

    const packageCount = snapshot.packages.length;
    const targetCount = snapshot.packages.reduce(
      (total, pkg) => total + pkg.targets.length,
      0,
    );
    const later = snapshot.remainingPackages
      ? ` · ${snapshot.remainingPackages} later`
      : "";
    const handedOff = snapshot.handedOff.length
      ? ` · ${snapshot.handedOff.length} handed off`
      : "";
    host.querySelector<HTMLElement>("[data-delegation-summary]")!.textContent =
      `${targetCount} ${targetCount === 1 ? "target" : "targets"} ready · ${packageCount} ${packageCount === 1 ? "package" : "packages"}${later}${handedOff}`;

    const notice = snapshot.notice
      ? `<span class="delegation-notice ${snapshot.notice.tone}" data-delegation-notice>${esc(snapshot.notice.message)}</span>`
      : `<span>${packageCount} ${packageCount === 1 ? "package" : "packages"} ready</span>`;
    const confirmation = snapshot.pendingConfirmation
      ? `<button type="button" class="btn-ghost" data-confirm-handoff>Confirm handed off</button>`
      : "";
    const undo = snapshot.canUndoHandoff
      ? `<button type="button" class="btn-ghost" data-undo-handoff>Undo handoff</button>`
      : "";
    const live = host.querySelector<HTMLElement>(".delegation-live")!;
    live.innerHTML = `${notice}<span class="delegation-live-actions">${confirmation}${undo}<button type="button" class="btn-ghost mini" data-revalidate ${snapshot.busyAction !== null || snapshot.selectedCount === 0 ? "disabled" : ""}>${snapshot.busyAction === "revalidate" ? "Checking…" : "Check again"}</button></span>`;
    live.querySelector<HTMLElement>("[data-confirm-handoff]")
      ?.addEventListener("click", () => controller.confirmHandoff());
    live.querySelector<HTMLElement>("[data-undo-handoff]")
      ?.addEventListener("click", () => controller.undoHandoff());
    live.querySelector<HTMLElement>("[data-revalidate]")
      ?.addEventListener("click", () => void controller.revalidate());

    const bodyHtml = `${modeHtml(snapshot)}
      ${snapshot.packages.length
        ? snapshot.packages.map((pkg) =>
          packageHtml(
            pkg,
            snapshot.errors,
            expandedNotes,
            snapshot.packages.length > 1,
          )).join("")
        : `<div class="delegation-empty"><h3>No targets ready</h3><p>Select rows from the table to prepare the next Handoff bundle.</p></div>`}
      ${notInNextBundleHtml(snapshot.notInNextBundle)}
      ${handedOffHtml(snapshot.handedOff)}
      ${snapshot.error
        ? `<label class="delegation-preview-label">Markdown preview<textarea class="delegation-preview" readonly>${esc(snapshot.previewMarkdown)}</textarea></label>`
        : ""}`;
    const body = host.querySelector<HTMLElement>(
      ".delegation-composer-body",
    )!;
    if (bodyHtml !== lastBodyHtml) {
      const activeElement = document.activeElement;
      const focusedField = activeElement instanceof HTMLTextAreaElement
        && body.contains(activeElement)
        && activeElement.id
        ? {
            id: activeElement.id,
            start: activeElement.selectionStart,
            end: activeElement.selectionEnd,
          }
        : null;
      const scrollTop = body.scrollTop;
      body.innerHTML = bodyHtml;
      body.scrollTop = scrollTop;
      lastBodyHtml = bodyHtml;

      body.querySelectorAll<HTMLInputElement>("[name='handoff-mode']")
        .forEach((input) => input.addEventListener("click", () => {
          if (input.checked) {
            controller.setMode(input.value as "investigate" | "implement");
          }
        }));
      body.querySelector<HTMLTextAreaElement>("[data-mission-note]")
        ?.addEventListener("change", (event) => {
          controller.setMissionNote(
            (event.currentTarget as HTMLTextAreaElement).value,
          );
        });
      body.querySelectorAll<HTMLElement>("[data-add-item-note]")
        .forEach((button) => button.addEventListener("click", () => {
          const itemId = button.dataset.addItemNote!;
          expandedNotes.add(itemId);
          lastBodyHtml = "";
          render(controller.snapshot());
          queueMicrotask(() => {
            [...body.querySelectorAll<HTMLTextAreaElement>("[data-item-note]")]
              .find((field) => field.dataset.itemNote === itemId)?.focus();
          });
        }));
      body.querySelectorAll<HTMLTextAreaElement>("[data-item-note]")
        .forEach((field) => field.addEventListener("change", () => {
          controller.setItemNote(field.dataset.itemNote!, field.value);
        }));
      body.querySelectorAll<HTMLElement>("[data-remove-target]")
        .forEach((button) => button.addEventListener("click", () => {
          controller.removeTarget(button.dataset.removeTarget!);
        }));
      body.querySelectorAll<HTMLElement>("[data-remove-queue-item]")
        .forEach((button) => button.addEventListener("click", () => {
          controller.removeQueueItem(button.dataset.removeQueueItem!);
        }));
      body.querySelectorAll<HTMLElement>("[data-copy-package]")
        .forEach((button) => button.addEventListener("click", () => {
          void controller.copyPackage(button.dataset.copyPackage!);
        }));
      body.querySelectorAll<HTMLElement>("[data-download-package]")
        .forEach((button) => button.addEventListener("click", () => {
          controller.downloadPackage(
            button.dataset.downloadPackage!,
            button.dataset.format as "md" | "json",
          );
        }));

      if (focusedField) {
        const candidate = document.getElementById(focusedField.id);
        const field = candidate instanceof HTMLTextAreaElement
          && body.contains(candidate)
          ? candidate
          : null;
        field?.focus();
        field?.setSelectionRange(focusedField.start, focusedField.end);
      }
    }

    host.querySelectorAll<HTMLButtonElement>("[data-download-all]")
      .forEach((button) => {
        button.disabled = !snapshot.canDownload;
      });
    const copy = host.querySelector<HTMLButtonElement>("[data-copy-all]")!;
    copy.disabled = !snapshot.packages.length
      || snapshot.errors.length > 0
      || snapshot.busyAction === "copy";
    copy.textContent = snapshot.busyAction === "copy"
      ? "Copying…"
      : snapshot.mode === "implement"
      ? "Copy implementation handoff"
      : "Copy investigation handoff";

    if (opening) {
      host.querySelector<HTMLElement>("#delegation-title")?.focus();
    }
  };

  const unsubscribe = controller.subscribe(render);
  render(controller.snapshot());
  return () => {
    unsubscribe();
    activeDismiss?.destroy();
    activeDismiss = null;
    host.innerHTML = "";
  };
}

/** Transitional export removed in the final Handoff cutover. */
export const mountDelegationComposer = mountHandoffComposer;
