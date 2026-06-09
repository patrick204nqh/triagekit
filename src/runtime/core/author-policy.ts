import type { Actor, ActorKind } from "../dataset/shared";
import type { Kind, TriageItem } from "../dataset/item";
import { detailsAs } from "../dataset/details";

// Bot if the adapter flagged it OR the login is on the user's allow-list.
export function classifyAuthor(author: Actor, botLogins: string[]): ActorKind {
  return author.kind === "bot" || botLogins.includes(author.login) ? "bot" : "human";
}

// Return an item whose author kind reflects the allow-list. Pure: clones only when the
// classification actually changes, otherwise returns the original reference.
export function withBotPolicy<T extends TriageItem>(item: T, botLogins: string[]): T {
  const author = detailsAs<{ author?: Actor }>(item)?.author;
  if (!author) return item;
  const kind = classifyAuthor(author, botLogins);
  if (kind === author.kind) return item;
  return { ...item, details: { ...(item.details as object), author: { ...author, kind } } } as T;
}

// Distinct, sorted logins the provider adapter itself flagged as bots, restricted to
// the active kinds. Reads the RAW item author.kind — must run against the store
// snapshot, not post-withBotPolicy rows (those overwrite kind, so manual allow-list
// logins would masquerade as adapter-flagged).
export function adapterBotLogins(items: readonly TriageItem[], activeKinds: readonly Kind[]): string[] {
  const logins = new Set<string>();
  for (const it of items) {
    if (!activeKinds.includes(it.kind)) continue;
    const author = detailsAs<{ author?: Actor }>(it)?.author;
    if (author?.kind === "bot") logins.add(author.login);
  }
  return [...logins].sort();
}
