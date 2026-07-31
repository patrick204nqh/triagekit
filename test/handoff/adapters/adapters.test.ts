// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadJson,
  downloadText,
} from "../../../src/runtime/handoff/adapters/download";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

describe("handoff transport adapters", () => {
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
