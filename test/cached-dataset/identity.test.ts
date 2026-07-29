import { describe, expect, it } from "vitest";
import {
  canonicalGithubScope,
  createConnectionKey,
} from "../../src/runtime/cached-dataset/identity";

describe("Provider Connection identity", () => {
  it("treats repository order and duplicates as the same scope", async () => {
    const a = canonicalGithubScope({ repos: ["acme-corp/web", "acme-corp/api"] });
    const b = canonicalGithubScope({ repos: ["acme-corp/api", "acme-corp/web", "acme-corp/api"] });
    expect(a).toEqual(b);
    await expect(createConnectionKey("github", "token-a", a))
      .resolves.toEqual(await createConnectionKey("github", "token-a", b));
  });

  it("isolates different credential identities", async () => {
    const scope = canonicalGithubScope({ repos: ["acme-corp/web"] });
    expect(await createConnectionKey("github", "token-a", scope))
      .not.toEqual(await createConnectionKey("github", "token-b", scope));
  });
});
