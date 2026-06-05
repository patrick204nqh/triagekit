// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { ghPaginate, GH_HEADERS } from "../../../src/runtime/ingest/github/paginate";

describe("ghPaginate", () => {
  it("follows Link rel=next and concatenates pages", async () => {
    const page1 = new Response(JSON.stringify([{ id: 1 }]), {
      status: 200,
      headers: { Link: '<https://api.github.com/x?page=2>; rel="next"' },
    });
    const page2 = new Response(JSON.stringify([{ id: 2 }]), { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2));
    const out: any[] = [];
    await ghPaginate("https://api.github.com/x", GH_HEADERS("t"), (p) => { out.push(...p); });
    expect(out.map(o => o.id)).toEqual([1, 2]);
  });
});
