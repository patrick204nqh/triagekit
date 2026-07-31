import { describe, expect, it } from "vitest";
import {
  generatedIntentFor,
} from "../../src/runtime/handoff/intent";

describe("generated handoff intent", () => {
  it("generates a read-only investigation boundary", () => {
    const intent = generatedIntentFor("issue", "investigate");

    expect(intent.outcome).toBe("Investigate the selected issues");
    expect(intent.constraints).toEqual(expect.arrayContaining([
      "Do not modify files.",
      "Do not create commits or pushes.",
      "Do not perform provider mutations or other external actions.",
    ]));
    expect(intent.verification).toEqual([
      "Report evidence, risks, and unanswered questions.",
      "Outline a concrete action plan.",
    ]);
  });

  it("generates scoped implementation instructions without publication", () => {
    const intent = generatedIntentFor("change-request", "implement");

    expect(intent.outcome).toBe(
      "Implement the requested changes for the selected change requests",
    );
    expect(intent.constraints).toContain(
      "Do not commit, push, merge, deploy, or mutate provider state unless the human instructions explicitly request it.",
    );
    expect(intent.verification).toContain(
      "Run proportionate verification and report the result.",
    );
  });

  it("uses a provider-neutral fallback for future kinds", () => {
    expect(generatedIntentFor("secret-scanning", "investigate").outcome)
      .toBe("Investigate the selected items");
    expect(generatedIntentFor("secret-scanning", "implement").outcome)
      .toBe("Implement the requested changes for the selected items");
  });
});
