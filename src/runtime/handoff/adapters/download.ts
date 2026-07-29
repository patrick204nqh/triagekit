import type { AgentHandoffV1, TransportResult } from "../types";

function safeFilename(part: string): string {
  return part.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
}

export function filenameFor(handoff: AgentHandoffV1, format: "md" | "json"): string {
  const kind = safeFilename(handoff.targets[0]?.kind ?? "item");
  const id = safeFilename(handoff.targets[0]?.id ?? "unknown");
  return `triagekit-${kind}-${id}.${format}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadText(
  filename: string,
  text: string,
  mime: string,
): TransportResult {
  try {
    const blob = new Blob([text], { type: mime });
    triggerDownload(blob, safeFilename(filename));
    return { ok: true };
  } catch {
    return { ok: false, error: "Download failed" };
  }
}

export function downloadJson(
  filename: string,
  value: unknown,
): TransportResult {
  try {
    const json = JSON.stringify(value, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    triggerDownload(blob, safeFilename(filename));
    return { ok: true };
  } catch {
    return { ok: false, error: "Download failed" };
  }
}

export function downloadMarkdown(
  handoff: AgentHandoffV1,
  markdown: string,
): TransportResult {
  return downloadText(
    filenameFor(handoff, "md"),
    markdown,
    "text/markdown",
  );
}

export function downloadJSON(handoff: AgentHandoffV1): TransportResult {
  return downloadJson(filenameFor(handoff, "json"), handoff);
}
