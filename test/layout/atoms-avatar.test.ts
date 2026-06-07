import { describe, it, expect } from "vitest";
import { actorChipHtml } from "../../src/runtime/layout/atoms";
import type { Actor } from "../../src/runtime/dataset/shared";

const human: Actor = { login: "dkohl", avatarUrl: "https://avatars.githubusercontent.com/u/1", kind: "human" };
const noPic: Actor = { login: "rb", avatarUrl: "", kind: "human" };

describe("actorChipHtml avatars", () => {
  it("renders an img with the avatar url and login alt when present", () => {
    const html = actorChipHtml(human);
    expect(html).toContain("<img");
    expect(html).toContain('src="https://avatars.githubusercontent.com/u/1"');
    expect(html).toContain('alt="dkohl"');
    expect(html).toContain('data-initials="DK"');   // fallback payload for the error listener
  });
  it("renders initials (no img) when avatarUrl is empty", () => {
    const html = actorChipHtml(noPic);
    expect(html).not.toContain("<img");
    expect(html).toContain(">RB<");
  });
});
