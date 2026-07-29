import type {
  DelegationController,
  DelegationControllerSnapshot,
  DelegationValidationError,
  WorkPackageV1,
} from "../../delegation/types";
import { dismissible } from "../../shell/dismissible";
import { esc } from "../util";

function fieldId(
  pkg: WorkPackageV1,
  field: string,
): string {
  if (field === "intent.outcome") return `${pkg.id}-intent-outcome`;
  if (field === "intent.constraints") return `${pkg.id}-intent-constraints`;
  if (field === "intent.verification") {
    return `${pkg.id}-intent-verification`;
  }
  return `${pkg.id}-heading`;
}

function packageErrors(
  pkg: WorkPackageV1,
  errors: readonly DelegationValidationError[],
): string {
  const matching = errors.filter((error) => error.packageId === pkg.id);
  if (!matching.length) return "";
  return `<ul class="delegation-errors">${matching.map((error) =>
    `<li id="${esc(pkg.id)}-error-${errors.indexOf(error)}"><a href="#${esc(fieldId(pkg, error.field))}" data-package-error="${esc(pkg.id)}">${esc(error.message)}</a></li>`).join("")}</ul>`;
}

function fieldErrorAttributes(
  pkg: WorkPackageV1,
  errors: readonly DelegationValidationError[],
  field: string,
): string {
  const ids = errors
    .map((error, index) => ({ error, index }))
    .filter(
      ({ error }) => error.packageId === pkg.id && error.field === field,
    )
    .map(({ index }) => `${pkg.id}-error-${index}`);
  return ids.length
    ? ` aria-invalid="true" aria-describedby="${esc(ids.join(" "))}"`
    : "";
}

function targetHtml(
  target: WorkPackageV1["targets"][number],
): string {
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
  const state = [
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
  return `<li class="delegation-target" data-target="${esc(target.id)}">
    <div><strong>${esc(target.title)}</strong><span class="delegation-target-meta">${esc(target.priority.tier)} · ${target.priority.score}</span></div>
    <div class="delegation-target-state">${esc(state)}</div>
    <button type="button" class="btn-ghost mini" data-remove-target="${esc(target.id)}" aria-label="Deselect ${esc(target.title)} from package">Deselect</button>
  </li>`;
}

function packageHtml(
  pkg: WorkPackageV1,
  errors: readonly DelegationValidationError[],
  showPackageActions: boolean,
): string {
  const kindLabel = pkg.kind === "dependency-vuln"
    ? "Dependency vulnerabilities"
    : pkg.kind === "code-scanning"
    ? "Code scanning"
    : pkg.kind === "change-request"
    ? "Change requests"
    : pkg.kind.charAt(0).toUpperCase() + pkg.kind.slice(1).replaceAll("-", " ");
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
      <span class="delegation-package-meta">${esc(kindLabel)} · ${pkg.targets.length} ${pkg.targets.length === 1 ? "target" : "targets"}</span>
    </header>
    <p class="delegation-reason">${esc(pkg.selectionReason)}</p>
    ${packageErrors(pkg, errors)}
    <label for="${esc(pkg.id)}-intent-outcome">Outcome</label>
    <textarea id="${esc(pkg.id)}-intent-outcome" data-intent-outcome="${esc(pkg.id)}" rows="2"${fieldErrorAttributes(pkg, errors, "intent.outcome")}>${esc(pkg.intent.outcome)}</textarea>
    <div class="delegation-intent-grid">
      <label>Constraints <span class="delegation-optional">(optional)</span>
        <textarea id="${esc(pkg.id)}-intent-constraints" data-intent-constraints="${esc(pkg.id)}" rows="3" placeholder="e.g. Keep public APIs stable"${fieldErrorAttributes(pkg, errors, "intent.constraints")}>${esc(pkg.intent.constraints.join("\n"))}</textarea>
      </label>
      <label>Verification <span class="delegation-optional">(optional)</span>
        <textarea id="${esc(pkg.id)}-intent-verification" data-intent-verification="${esc(pkg.id)}" rows="3" placeholder="e.g. Tests pass and the finding is resolved"${fieldErrorAttributes(pkg, errors, "intent.verification")}>${esc(pkg.intent.verification.join("\n"))}</textarea>
      </label>
    </div>
    <ul class="delegation-targets">${pkg.targets.map(targetHtml).join("")}</ul>
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

export function mountDelegationComposer(
  host: HTMLElement,
  controller: DelegationController,
): () => void {
  let wasOpen = false;
  let activeDismiss: ReturnType<typeof dismissible> | null = null;
  let lastBodyHtml = "";

  const bindBodyActions = () => {
    const intent = (
      selector: string,
      field: "outcome" | "constraints" | "verification",
    ) => {
      host.querySelectorAll<HTMLTextAreaElement>(selector).forEach((area) =>
        area.addEventListener("change", () => {
          const packageId = area.dataset[
            field === "outcome"
              ? "intentOutcome"
              : field === "constraints"
                ? "intentConstraints"
                : "intentVerification"
          ]!;
          controller.updateIntent(packageId, {
            [field]: field === "outcome"
              ? area.value
              : area.value.split("\n").map((line) => line.trim())
                .filter(Boolean),
          });
        }));
    };
    intent("[data-intent-outcome]", "outcome");
    intent("[data-intent-constraints]", "constraints");
    intent("[data-intent-verification]", "verification");

    host.querySelectorAll<HTMLElement>("[data-remove-target]")
      .forEach((button) => button.addEventListener("click", () => {
        const targets = [...host.querySelectorAll<HTMLElement>(
          "[data-remove-target]",
        )];
        const index = targets.indexOf(button);
        const nextId = targets[index + 1]?.dataset.removeTarget
          ?? targets[index - 1]?.dataset.removeTarget;
        controller.removeTarget(button.dataset.removeTarget!);
        queueMicrotask(() => {
          if (nextId) {
            [...host.querySelectorAll<HTMLElement>("[data-remove-target]")]
              .find((candidate) =>
                candidate.dataset.removeTarget === nextId)?.focus();
          }
        });
      }));
    host.querySelectorAll<HTMLElement>("[data-remove-queue-item]")
      .forEach((button) => button.addEventListener("click", () => {
        controller.removeQueueItem(button.dataset.removeQueueItem!);
      }));
    host.querySelectorAll<HTMLElement>("[data-copy-package]")
      .forEach((button) => button.addEventListener("click", () => {
        void controller.copyPackage(button.dataset.copyPackage!);
      }));
    host.querySelectorAll<HTMLElement>("[data-download-package]")
      .forEach((button) => button.addEventListener("click", () => {
        controller.downloadPackage(
          button.dataset.downloadPackage!,
          button.dataset.format as "md" | "json",
        );
      }));
  };

  const bindLiveActions = () => {
    host.querySelector<HTMLElement>("[data-confirm-handoff]")
      ?.addEventListener("click", () => controller.confirmHandoff());
    host.querySelector<HTMLElement>("[data-undo-handoff]")
      ?.addEventListener("click", () => controller.undoHandoff());
    host.querySelector<HTMLElement>("[data-revalidate]")
      ?.addEventListener("click", () => {
        void controller.revalidate();
      });
  };

  const bindShellActions = () => {
    host.querySelector<HTMLElement>("[data-delegation-close]")
      ?.addEventListener("click", () => controller.close());
    host.querySelector<HTMLElement>("[data-copy-all]")
      ?.addEventListener("click", () => {
        void controller.copyBundle();
      });
    host.querySelectorAll<HTMLElement>("[data-download-all]")
      .forEach((button) => button.addEventListener("click", () => {
        controller.downloadBundle(button.dataset.format as "md" | "json");
      }));
  };

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
            <div><h2 id="delegation-title" tabindex="-1">Delegation queue</h2>
              <p data-delegation-summary></p></div>
            <button type="button" class="drawer-close" data-delegation-close aria-label="Close delegation queue">×</button>
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
      bindShellActions();
      wasOpen = true;
    }

    const packageCount = snapshot.packages.length;
    const targetCount = snapshot.packages.reduce(
      (total, pkg) => total + pkg.targets.length,
      0,
    );
    const readyLabel =
      `${targetCount} ${targetCount === 1 ? "target" : "targets"} ready`;
    const bundleLabel = `${packageCount} ${packageCount === 1 ? "package" : "packages"} in next bundle`;
    const laterLabel = snapshot.remainingPackages
      ? ` · ${snapshot.remainingPackages} later`
      : "";
    const handedOffLabel = snapshot.handedOff.length
      ? ` · ${snapshot.handedOff.length} handed off`
      : "";
    host.querySelector<HTMLElement>("[data-delegation-summary]")!.textContent =
      `${readyLabel} · ${bundleLabel}${laterLabel}${handedOffLabel}`;

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
    bindLiveActions();

    const bodyHtml = `${
      snapshot.packages.length
        ? snapshot.packages.map((pkg) =>
          packageHtml(
            pkg,
            snapshot.errors,
            snapshot.packages.length > 1,
          )).join("")
        : `<div class="delegation-empty"><h3>No targets ready</h3><p>Select rows from the table to prepare the next bundle.</p></div>`
    }
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
      bindBodyActions();
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
      : `Copy next bundle — ${packageCount} ${packageCount === 1 ? "package" : "packages"}, ${targetCount} ${targetCount === 1 ? "target" : "targets"}`;

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
