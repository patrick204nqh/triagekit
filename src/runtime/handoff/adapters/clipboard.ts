import type { TransportResult } from "./types";

export async function copyMarkdown(text: string): Promise<TransportResult> {
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Clipboard access denied" };
  }
}
