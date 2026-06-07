import { describe, it, expect } from "vitest";
import { listArtifacts, artifactOf, GROUP_ORDER, GROUP_LABEL } from "../../src/runtime/dataset/artifact";
import { domainOf } from "../../src/runtime/dataset/taxonomy";

describe("artifacts", () => {
  it("groups finding and work as the two rail classes", () => {
    expect(GROUP_ORDER).toEqual(["finding", "work"]);
    expect(GROUP_LABEL).toEqual({ finding: "Findings", work: "Work" });
  });

  it("places each artifact in a known group", () => {
    const byId = Object.fromEntries(listArtifacts().map(a => [a.id, a.group]));
    expect(byId["dependency-vuln"]).toBe("finding");
    expect(byId["secret-scanning"]).toBe("finding");
    expect(byId["cloud-misconfig"]).toBe("finding");
    expect(byId.task).toBe("work");
  });

  it("exposes a Tasks artifact under work", () => {
    const a = listArtifacts().find(x => x.id === "task");
    expect(a).toBeDefined();
    expect(a!.label).toBe("Tasks");
    expect(a!.group).toBe("work");
    expect(a!.kinds).toEqual(["task"]);
    expect(listArtifacts().some(x => x.id === "tickets")).toBe(false);
  });

  it("maps a kind back to its artifact", () => {
    expect(artifactOf("dependency-vuln").id).toBe("dependency-vuln");
    expect(artifactOf("task").group).toBe("work");
  });

  it("registers a Threats artifact under finding for runtime-threat", () => {
    const t = listArtifacts().find(a => a.id === "runtime-threat");
    expect(t).toBeDefined();
    expect(t!.group).toBe("finding");
    expect(t!.kinds).toEqual(["runtime-threat"]);
    expect(artifactOf("runtime-threat").id).toBe("runtime-threat");
  });
});

describe("artifacts are one-kind-per-tab", () => {
  it("every artifact maps to exactly one kind", () => {
    expect(listArtifacts().filter(a => a.kinds.length !== 1)).toEqual([]);
  });

  it("dependency-vuln and code-scanning are separate tabs", () => {
    expect(artifactOf("dependency-vuln").id).toBe("dependency-vuln");
    expect(artifactOf("code-scanning").id).toBe("code-scanning");
  });

  it("change-request and issue are separate tabs", () => {
    expect(artifactOf("change-request").id).toBe("change-request");
    expect(artifactOf("issue").id).toBe("issue");
  });
});

it("every artifact's kinds share one domain (no cross-domain bucket)", () => {
  for (const a of listArtifacts()) {
    const domains = new Set(a.kinds.map(k => domainOf(k).id));
    expect(domains.size).toBe(1);
  }
});
it("has no 'misconfigurations' bucket spanning cloud + edge", () => {
  expect(listArtifacts().find(a => a.id === "misconfigurations")).toBeUndefined();
});
it("groups by class via GROUP_LABEL", () => {
  const work = listArtifacts().filter(a => a.group === "work").map(a => a.id);
  expect(work).toContain("change-request");
});
