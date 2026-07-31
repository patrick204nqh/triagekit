import { describe, expect, it } from "vitest";
import type {
  DelegationBundleV1,
  WorkPackageV1,
} from "../../src/runtime/delegation/types";
import type { HandoffTargetV1 } from "../../src/runtime/handoff/types";
import {
  validateHandoffBundle,
} from "../../src/runtime/delegation/validator";

const target = (
  id: string,
  details: HandoffTargetV1["details"] = {},
): HandoffTargetV1 => ({
  id,
  kind: "issue",
  provider: "github",
  providerReference: { number: 1 },
  title: id,
  location: "acme-corp/core",
  url: `https://example.test/${id}`,
  createdAt: "2026-07-29T00:00:00.000Z",
  priority: { signal: 50, score: 50, tier: "P2" },
  details,
});

const packageOf = (
  id: string,
  details: HandoffTargetV1["details"] = {},
  order = 1,
): WorkPackageV1 => ({
  id,
  order,
  repository: "acme-corp/core",
  kind: "issue",
  generatedIntent: {
    outcome: "Investigate the selected issues",
    constraints: ["Do not modify files."],
    verification: ["Outline a concrete action plan."],
  },
  intent: {
    outcome: "Investigate the selected issues",
    constraints: ["Do not modify files."],
    verification: ["Outline a concrete action plan."],
  },
  targets: [target(`${id}-target`, details)],
  selectionReason: "Repository priority 1 · P2 1",
});

const packages = (count: number): WorkPackageV1[] =>
  Array.from({ length: count }, (_, index) =>
    packageOf(`pkg-${index + 1}`, {}, index + 1));

const bundle = (
  overrides: Partial<DelegationBundleV1> = {},
): DelegationBundleV1 => ({
  schema: "triagekit.handoff-bundle",
  version: 1,
  createdAt: "2026-07-29T00:00:00.000Z",
  focus: {
    provider: "github",
    repositoryOrder: ["acme-corp/core"],
    includeLabels: ["security"],
    excludeLabels: ["jira-ticket-created"],
  },
  instructions: {
    mode: "investigate",
    generatedBoundary: [
      "Do not modify files.",
      "Do not create commits or pushes.",
      "Do not perform provider mutations or other external actions.",
    ],
    processPackagesInOrder: true,
    generatedFrom: "explicit-session-queue",
  },
  packages: [packageOf("pkg-1")],
  ...overrides,
});

describe("handoff bundle validator", () => {
  it("accepts five packages and rejects a sixth", () => {
    expect(validateHandoffBundle(bundle({ packages: packages(5) })))
      .toEqual({ valid: true });
    expect(validateHandoffBundle(bundle({ packages: packages(6) })))
      .toEqual({
        valid: false,
        errors: expect.arrayContaining([
          expect.objectContaining({ field: "packages" }),
        ]),
      });
  });

  it("blocks only the package containing a secret-suggesting field", () => {
    const result = validateHandoffBundle(bundle({
      packages: [
        packageOf("safe", { ruleId: "js/xss" }, 1),
        packageOf(
          "blocked",
          { authToken: "redacted-looking-but-forbidden" },
          2,
        ),
      ],
    }));
    expect(result).toEqual({
      valid: false,
      errors: [
        expect.objectContaining({
          packageId: "blocked",
          field: expect.stringContaining("authToken"),
        }),
      ],
    });
  });

  it("rejects more than ten targets in one package and fifty total", () => {
    const oversized = {
      ...packageOf("oversized"),
      targets: Array.from({ length: 11 }, (_, index) =>
        target(`target-${index}`)),
    };
    const result = validateHandoffBundle(bundle({
      packages: [oversized],
    }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          packageId: "oversized",
          field: "targets",
        }),
      ]));
    }
  });

  it("rejects an investigation bundle without its generated boundary", () => {
    const result = validateHandoffBundle(bundle({
      instructions: {
        mode: "investigate",
        generatedBoundary: [],
        processPackagesInOrder: true,
        generatedFrom: "explicit-session-queue",
      },
    }));

    expect(result).toEqual({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          field: "instructions.generatedBoundary",
        }),
      ]),
    });
  });

  it("keeps the generated boundary authoritative over human notes", () => {
    const withConflict = bundle({
      instructions: {
        mode: "investigate",
        missionNote: "Fix this and push it",
        generatedBoundary: [
          "Do not modify files.",
          "Do not create commits or pushes.",
          "Do not perform provider mutations or other external actions.",
        ],
        processPackagesInOrder: true,
        generatedFrom: "explicit-session-queue",
      },
    });

    expect(validateHandoffBundle(withConflict)).toEqual({ valid: true });
  });
});
