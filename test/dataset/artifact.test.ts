import { describe, it, expect } from "vitest";
import { listArtifacts, artifactOf, GROUP_ORDER, GROUP_LABEL } from "../../src/runtime/dataset/artifact";

describe("artifacts", () => {
  it("groups findings and work as the two rail classes", () => {
    expect(GROUP_ORDER).toEqual(["findings", "work"]);
    expect(GROUP_LABEL).toEqual({ findings: "Findings", work: "Work" });
  });

  it("places each artifact in a known group", () => {
    const byId = Object.fromEntries(listArtifacts().map(a => [a.id, a.group]));
    expect(byId.dependencies).toBe("findings");
    expect(byId.secrets).toBe("findings");
    expect(byId.misconfigurations).toBe("findings");
    expect(byId.tasks).toBe("work");
  });

  it("exposes a Tasks artifact (renamed from tickets) under work", () => {
    const a = listArtifacts().find(x => x.id === "tasks");
    expect(a).toBeDefined();
    expect(a!.label).toBe("Tasks");
    expect(a!.group).toBe("work");
    expect(a!.kinds).toEqual(["work-item"]);
    expect(listArtifacts().some(x => x.id === "tickets")).toBe(false);
  });

  it("maps a kind back to its artifact", () => {
    expect(artifactOf("dependency-vuln").id).toBe("dependencies");
    expect(artifactOf("work-item").group).toBe("work");
  });

  it("registers a Threats artifact under findings for runtime-threat", () => {
    const t = listArtifacts().find(a => a.id === "threats");
    expect(t).toBeDefined();
    expect(t!.group).toBe("findings");
    expect(t!.kinds).toEqual(["runtime-threat"]);
    expect(artifactOf("runtime-threat").id).toBe("threats");
  });
});

describe("artifacts are one-kind-per-tab", () => {
  it("every active artifact maps to exactly one kind", () => {
    const multi = listArtifacts().filter(a => a.kinds.length !== 1);
    // Only upcoming-only bundles may keep multiple kinds; the shipped ones must be single.
    const shippedMulti = multi.filter(a => ["vulnerabilities", "review"].includes(a.id));
    expect(shippedMulti).toEqual([]);
  });

  it("dependency-vuln and code-scanning are separate tabs", () => {
    expect(artifactOf("dependency-vuln").id).toBe("dependencies");
    expect(artifactOf("code-scanning").id).toBe("code-scanning");
  });

  it("pull-request and issue are separate tabs", () => {
    expect(artifactOf("pull-request").id).toBe("pull-requests");
    expect(artifactOf("issue").id).toBe("issues");
  });
});
