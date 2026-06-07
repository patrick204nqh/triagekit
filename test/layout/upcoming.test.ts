// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderUpcoming } from "../../src/runtime/layout/upcoming";
import type { Source } from "../../src/runtime/ingest/source";

const stub: Source = { id: "aws", domain: "cloud-posture", kinds: ["cloud-misconfig"],
  connectSrc: [], status: "upcoming", scopeSchema: [], fetch: async () => ({ items: [], errors: [] }) };

describe("renderUpcoming", () => {
  it("renders the source id, upcoming badge, and its kinds", () => {
    const root = document.createElement("div");
    renderUpcoming(root, stub);
    expect(root.innerHTML).toContain("upcoming");
    expect(root.innerHTML).toContain("aws");
    expect(root.innerHTML).toContain("cloud-misconfig");
  });
});
