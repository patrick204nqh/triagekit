import { createHash } from "node:crypto";

// Build-time map of provider id → origins the runtime must reach. Kept here (Node
// side) so the CLI can compute connect-src without importing the browser runtime's
// adapter registry. Mirrors each adapter's declared `connectSrc`.
export const SOURCE_CONNECT_SRC: Record<string, string[]> = {
  github: ["https://api.github.com"],
};

// Image origins a provider's avatars / inline body images load from. Mirrors
// SOURCE_CONNECT_SRC; extends img-src the same way connect-src is extended.
export const SOURCE_IMG_SRC: Record<string, string[]> = {
  github: ["https://avatars.githubusercontent.com", "https://*.githubusercontent.com"],
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
export function buildCspMeta(html: string, connectSrc: string[], imgSrc: string[] = []): string {
  const scriptSrc = ["script-src", ...hashesOf(html, "script")].join(" ");
  const styleSrc = ["style-src 'self'", ...hashesOf(html, "style")].join(" ");
  const connect = ["connect-src 'self'", ...connectSrc].join(" ");
  const img = ["img-src 'self' data:", ...imgSrc].join(" ");
  const policy = [
    "default-src 'none'",
    scriptSrc,
    styleSrc,
    connect,
    img,
    "font-src 'self' data:",
    "base-uri 'none'",
  ].join("; ");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  return html.replace(PLACEHOLDER, meta);
}
