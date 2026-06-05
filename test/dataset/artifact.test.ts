import { describe, it, expect } from "vitest";
import { listArtifacts, artifactOf, GROUP_ORDER, GROUP_LABEL } from "../../src/runtime/dataset/artifact";

describe("artifacts", () => {
  it("groups findings and work as the two rail classes", () => {
    expect(GROUP_ORDER).toEqual(["findings", "work"]);
    expect(GROUP_LABEL).toEqual({ findings: "Findings", work: "Work" });
  });

  it("places each artifact in a known group", () => {
    const byId = Object.fromEntries(listArtifacts().map(a => [a.id, a.group]));
    expect(byId.vulnerabilities).toBe("findings");
    expect(byId.secrets).toBe("findings");
    expect(byId.misconfigurations).toBe("findings");
    expect(byId.tickets).toBe("work");
  });

  it("maps a kind back to its artifact", () => {
    expect(artifactOf("dependency-vuln").id).toBe("vulnerabilities");
    expect(artifactOf("work-item").group).toBe("work");
  });
});

describe("review artifact", () => {
  it("registers a Review artifact under the work group for PR + issue kinds", () => {
    const review = listArtifacts().find(a => a.id === "review");
    expect(review).toBeDefined();
    expect(review!.group).toBe("work");
    expect(review!.kinds).toEqual(["pull-request", "issue"]);
  });
  it("maps pull-request and issue kinds to the review artifact", () => {
    expect(artifactOf("pull-request").id).toBe("review");
    expect(artifactOf("issue").id).toBe("review");
  });
});
