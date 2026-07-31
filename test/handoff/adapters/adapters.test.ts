// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyMarkdown } from "../../../src/runtime/handoff/adapters/clipboard";
import {
  downloadJson,
  downloadText,
} from "../../../src/runtime/handoff/adapters/download";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn() },
    writable: true,
    configurable: true,
  });
});

describe("handoff transport adapters", () => {
  it("copies Markdown through the browser clipboard", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    await expect(copyMarkdown("# Handoff")).resolves.toEqual({ ok: true });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("# Handoff");
  });

  it("reports clipboard denial", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );

    await expect(copyMarkdown("# Handoff")).resolves.toEqual({
      ok: false,
      error: "denied",
    });
  });

  it("downloads Markdown and JSON using explicit handoff filenames", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue();

    expect(
      downloadText(
        "triagekit-handoff.md",
        "# Handoff",
        "text/markdown",
      ),
    ).toEqual({ ok: true });
    expect(
      downloadJson("triagekit-handoff.json", {
        schema: "triagekit.handoff-bundle",
      }),
    ).toEqual({ ok: true });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
