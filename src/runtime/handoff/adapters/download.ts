import type { TransportResult } from "../types";

function safeFilename(part: string): string {
  return part.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
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
