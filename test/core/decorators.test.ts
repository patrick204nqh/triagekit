import { describe, expect, it } from "vitest";
import { applyDecorators, listDecorators, registerDecorator } from "../../src/runtime/core/decorators";
import type { Kind, TriageItem } from "../../src/runtime/dataset/item";
import type { Actor } from "../../src/runtime/dataset/shared";

const item = (kind: Kind, details: unknown): TriageItem =>
  ({ id: "x", source: "github", kind, title: "", location: "", signal: 0, createdAt: "", url: "", details } as TriageItem);

describe("decorator registry", () => {
  it("ships the bot-policy built-in", () => {
    expect(listDecorators().some((d) => d.id === "bot-policy")).toBe(true);
  });

  it("bot-policy reclassifies an allow-listed login via ctx.botLogins", () => {
    const out = applyDecorators(item("issue", { author: { login: "deploy", avatarUrl: "", kind: "human" } }), { botLogins: ["deploy"] });
    expect((out.details as { author: Actor }).author.kind).toBe("bot");
  });

  it("applies a decorator only to its declared kinds", () => {
    registerDecorator({ id: "tag-issue", kinds: ["issue"], decorate: (i) => ({ ...i, title: i.title + "!" }) });
    expect(applyDecorators(item("issue", {}), { botLogins: [] }).title).toBe("!");
    expect(applyDecorators(item("change-request", {}), { botLogins: [] }).title).toBe("");
  });

  it("composes matching decorators in registration order", () => {
    registerDecorator({ id: "tag-a", decorate: (i) => ({ ...i, title: i.title + "A" }) });
    registerDecorator({ id: "tag-b", decorate: (i) => ({ ...i, title: i.title + "B" }) });
    expect(applyDecorators(item("issue", {}), { botLogins: [] }).title.endsWith("AB")).toBe(true);
  });
});
