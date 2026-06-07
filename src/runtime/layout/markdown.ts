// src/runtime/layout/markdown.ts
import { marked } from "marked";
import createDOMPurify from "dompurify";

// Lazily bind DOMPurify to the global window on first use, not at module load,
// so importing this module is side-effect-free (pure-data tests need no DOM).
let purify: ReturnType<typeof createDOMPurify> | null = null;
function purifier() {
  return (purify ??= createDOMPurify(window));
}

// Render a Markdown body to sanitized HTML. Full GFM (tables, task lists, code,
// links, images). Sanitized hard: no scripts, no inline event handlers, no
// javascript: URLs. Safe to inject under the strict CSP.
export function renderMarkdown(body: string): string {
  const raw = marked.parse(body ?? "", { gfm: true, breaks: true, async: false }) as string;
  return purifier().sanitize(raw, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "blockquote", "pre", "code",
      "a", "em", "strong", "del", "hr", "br", "table", "thead", "tbody", "tr", "th", "td", "img",
      "input"],   // task-list checkboxes
    ALLOWED_ATTR: ["href", "title", "src", "alt", "type", "checked", "disabled", "class", "align"],
    ALLOW_DATA_ATTR: false,
  });
}
