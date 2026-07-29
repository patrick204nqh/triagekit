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
    <button type="button" class="btn-ghost mini" data-remove-target="${esc(target.id)}" aria-label="Remove ${esc(target.title)} from package">Remove</button>
  </li>`;
}

function packageHtml(
  pkg: WorkPackageV1,
  errors: readonly DelegationValidationError[],
): string {
  return `<section class="delegation-package" id="${esc(pkg.id)}">
    <header class="delegation-package-head">
      <div><span class="delegation-order">${pkg.order}</span>
        <h3 id="${esc(pkg.id)}-heading" tabindex="-1">${esc(pkg.repository)}</h3></div>
      <span class="delegation-package-meta">${esc(pkg.id)} · ${esc(pkg.kind)} · ${pkg.targets.length} targets</span>
    </header>
    <p class="delegation-reason">${esc(pkg.selectionReason)}</p>
    ${packageErrors(pkg, errors)}
    <label for="${esc(pkg.id)}-intent-outcome">Outcome</label>
    <textarea id="${esc(pkg.id)}-intent-outcome" data-intent-outcome="${esc(pkg.id)}" rows="2"${fieldErrorAttributes(pkg, errors, "intent.outcome")}>${esc(pkg.intent.outcome)}</textarea>
    <div class="delegation-intent-grid">
      <label>Constraints
        <textarea id="${esc(pkg.id)}-intent-constraints" data-intent-constraints="${esc(pkg.id)}" rows="3"${fieldErrorAttributes(pkg, errors, "intent.constraints")}>${esc(pkg.intent.constraints.join("\n"))}</textarea>
      </label>
      <label>Verification
        <textarea id="${esc(pkg.id)}-intent-verification" data-intent-verification="${esc(pkg.id)}" rows="3"${fieldErrorAttributes(pkg, errors, "intent.verification")}>${esc(pkg.intent.verification.join("\n"))}</textarea>
      </label>
    </div>
    <ul class="delegation-targets">${pkg.targets.map(targetHtml).join("")}</ul>
    <div class="delegation-package-actions">
      <button type="button" class="btn-ghost" data-copy-package="${esc(pkg.id)}">Copy package</button>
      <button type="button" class="btn-ghost" data-download-package="${esc(pkg.id)}" data-format="md">Download .md</button>
      <button type="button" class="btn-ghost" data-download-package="${esc(pkg.id)}" data-format="json">Download .json</button>
    </div>
  </section>`;
}

export function mountDelegationComposer(
  host: HTMLElement,
  controller: DelegationController,
): () => void {
  let wasOpen = false;
  let activeDismiss: ReturnType<typeof dismissible> | null = null;

  const render = (snapshot: DelegationControllerSnapshot) => {
    activeDismiss?.destroy();
    activeDismiss = null;
    if (!snapshot.open) {
      host.innerHTML = "";
      if (wasOpen) {
        document.querySelector<HTMLElement>("[data-queue-badge]")?.focus();
      }
      wasOpen = false;
      return;
    }
    const opening = !wasOpen;
    wasOpen = true;
    host.innerHTML = `<div class="scrim open" data-delegation-scrim></div>
      <aside class="delegation-composer open" role="dialog" aria-modal="true" aria-labelledby="delegation-title">
        <header class="delegation-composer-head">
          <div><h2 id="delegation-title" tabindex="-1">Delegation queue</h2>
            <p>${snapshot.selectedCount} selected · ${snapshot.retainedCount} retained · ${snapshot.remainingPackages} packages remaining</p></div>
          <button type="button" class="drawer-close" data-delegation-close aria-label="Close delegation queue">×</button>
        </header>
        <div class="delegation-live" aria-live="polite">${esc(snapshot.error ?? `${snapshot.packages.length} packages ready`)}</div>
        <div class="delegation-composer-body">
          ${snapshot.packages.length
            ? snapshot.packages.map((pkg) =>
              packageHtml(pkg, snapshot.errors)).join("")
            : `<div class="empty"><h3>No selected targets</h3><p class="muted">Select focused rows or use Add visible.</p></div>`}
          ${snapshot.error
            ? `<label class="delegation-preview-label">Markdown preview<textarea class="delegation-preview" readonly>${esc(snapshot.previewMarkdown)}</textarea></label>`
            : ""}
        </div>
        <footer class="delegation-composer-foot">
          <button type="button" class="btn-ghost" data-revalidate>Revalidate targets</button>
          <button type="button" class="btn-ghost" data-download-all data-format="md" ${snapshot.canDownload ? "" : "disabled"}>Download all .md</button>
          <button type="button" class="btn-ghost" data-download-all data-format="json" ${snapshot.canDownload ? "" : "disabled"}>Download all .json</button>
          <button type="button" class="btn-primary" data-copy-all ${snapshot.packages.length && !snapshot.errors.length ? "" : "disabled"}>Copy all packages as Markdown</button>
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
    host.querySelector<HTMLElement>("[data-delegation-close]")
      ?.addEventListener("click", () => controller.close());
    scrim.addEventListener("click", () => controller.close());
    if (opening) {
      host.querySelector<HTMLElement>("#delegation-title")?.focus();
    }

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
    host.querySelector<HTMLElement>("[data-copy-all]")
      ?.addEventListener("click", () => {
        void controller.copyBundle();
      });
    host.querySelectorAll<HTMLElement>("[data-download-all]")
      .forEach((button) => button.addEventListener("click", () => {
        controller.downloadBundle(button.dataset.format as "md" | "json");
      }));
    host.querySelector<HTMLElement>("[data-revalidate]")
      ?.addEventListener("click", () => {
        void controller.revalidate();
      });
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
