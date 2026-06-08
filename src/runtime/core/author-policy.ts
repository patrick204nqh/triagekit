import type { Actor, ActorKind } from "../dataset/shared";
import type { TriageItem } from "../dataset/item";
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
