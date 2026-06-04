import type { TriageConfigT } from "../../config/schema";
import { TokenStore } from "./storage";

export function mountShell(config: TriageConfigT) {
  const bar = document.getElementById("appbar")!;
  bar.textContent = config.branding.title;
  // Minimal settings: a token field that persists via TokenStore.
  const store = new TokenStore();
  const input = document.createElement("input");
  input.type = "password";
  input.placeholder = "Paste your token (stored in this tab only)";
  input.value = store.get() ?? "";
  input.addEventListener("change", () => store.set(input.value.trim()));
  bar.appendChild(input);
}
