import { createHash } from "node:crypto";

// Build-time map of provider id → origins the runtime must reach. Kept here (Node
// side) so the CLI can compute connect-src without importing the browser runtime's
// adapter registry. Mirrors each adapter's declared `connectSrc`.
export const PROVIDER_CONNECT_SRC: Record<string, string[]> = {
  github: ["https://api.github.com"],
};

const PLACEHOLDER = "<!--CSP-META-PLACEHOLDER-->";

function hashesOf(html: string, tag: "script" | "style"): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const digest = createHash("sha256").update(m[1], "utf8").digest("base64");
    out.push(`'sha256-${digest}'`);
  }
  return out;
}

// Compute a strict, hash-based CSP meta tag for fully-inlined HTML and splice it in
// at the placeholder. No 'unsafe-inline' anywhere: every inline <script>/<style> is
// allowed by its sha256 hash only.
export function buildCspMeta(html: string, connectSrc: string[]): string {
  const scriptSrc = ["script-src", ...hashesOf(html, "script")].join(" ");
  const styleSrc = ["style-src 'self'", ...hashesOf(html, "style")].join(" ");
  const connect = ["connect-src 'self'", ...connectSrc].join(" ");
  const policy = [
    "default-src 'none'",
    scriptSrc,
    styleSrc,
    connect,
    "img-src 'self' data:",
    "base-uri 'none'",
  ].join("; ");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  return html.replace(PLACEHOLDER, meta);
}
