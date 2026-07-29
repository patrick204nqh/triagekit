// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyMarkdown } from "../../../src/runtime/handoff/adapters/clipboard";
import {
  downloadJson,
  downloadJSON,
  downloadMarkdown,
  downloadText,
  filenameFor,
} from "../../../src/runtime/handoff/adapters/download";
import type { AgentHandoffV1 } from "../../../src/runtime/handoff/types";

const handoff: AgentHandoffV1 = {
  schema: "triagekit.agent-handoff",
  version: 1,
  createdAt: "2026-07-27T00:00:00.000Z",
  intent: { outcome: "Fix", constraints: [], verification: [] },
  targets: [{
    id: "gh:42", kind: "dependency-vuln", provider: "github",
    providerReference: { alertNumber: 42 },
    title: "lodash", location: "acme/app",
    url: "https://github.com/acme/app/security/42",
    createdAt: "2026-07-26T00:00:00.000Z",
    priority: { signal: 80, score: 85, tier: "P0" },
    details: {},
  }],
  context: { session: { kind: "dependency-vuln", provider: "github", repository: "acme/app" }, relatedItems: [] },
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn() },
    writable: true,
    configurable: true,
  });
});

describe("copyMarkdown", () => {
  it("returns ok when clipboard succeeds", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const r = await copyMarkdown("test");
    expect(r).toEqual({ ok: true });
  });

  it("returns error when clipboard fails", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    const r = await copyMarkdown("test");
    expect(r.ok).toBe(false);
  });
});

describe("filenameFor", () => {
  it("generates markdown filename", () => {
    const name = filenameFor(handoff, "md");
    expect(name).toMatch(/^triagekit-dependency-vuln-gh_42\.md$/);
  });

  it("generates json filename", () => {
    const name = filenameFor(handoff, "json");
    expect(name).toMatch(/\.json$/);
  });
});

describe("downloadMarkdown", () => {
  it("creates blob and triggers download", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue();
    const r = downloadMarkdown(handoff, "# test");
    expect(r).toEqual({ ok: true });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe("downloadJSON", () => {
  it("creates blob and triggers download", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue();
    const r = downloadJSON(handoff);
    expect(r).toEqual({ ok: true });
  });
});

describe("generic downloads", () => {
  it("downloads arbitrary safe text and JSON payloads", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue();
    expect(downloadText(
      "triagekit-delegation.md",
      "# bundle",
      "text/markdown",
    )).toEqual({ ok: true });
    expect(downloadJson(
      "triagekit-delegation.json",
      { schema: "triagekit.delegation-bundle" },
    )).toEqual({ ok: true });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });
});
