import type { Kind, TriageItem } from "../dataset/item";
import { withBotPolicy } from "./author-policy";

export interface DecoratorCtx {
  botLogins: string[];
}

export interface Decorator {
  id: string;
  kinds?: Kind[];
  decorate(item: TriageItem, ctx: DecoratorCtx): TriageItem;
}

const decorators: Decorator[] = [];

export function registerDecorator(decorator: Decorator): void {
  decorators.push(decorator);
}

export function listDecorators(): Decorator[] {
  return [...decorators];
}

export function applyDecorators(item: TriageItem, ctx: DecoratorCtx): TriageItem {
  let out = item;
  for (const decorator of decorators) {
    if (decorator.kinds && !decorator.kinds.includes(out.kind)) continue;
    out = decorator.decorate(out, ctx);
  }
  return out;
}

registerDecorator({
  id: "bot-policy",
  decorate: (item, ctx) => withBotPolicy(item, ctx.botLogins),
});
