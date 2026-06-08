import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const landing = resolve(root, "site/index.html");
const app = resolve(root, "site/app/index.html");

describe("site/ Pages layout", () => {
  it("ships a landing page at the web root", () => {
    expect(existsSync(landing)).toBe(true);
  });

  it("landing deep-links into the hosted app", () => {
    const html = readFileSync(landing, "utf8");
    // Relative link into ./app/ (resolves to site/app/index.html on Pages).
    expect(html).toMatch(/href="\.\/app\/"/);
  });

  it("landing shows the install snippet and tagline", () => {
    const html = readFileSync(landing, "utf8");
    expect(html).toContain("npx triagekit build");
    expect(html).toContain("Backend-free repo triage. One HTML file.");
  });

  it("landing pulls in no external scripts or stylesheets (no-CDN ethos)", () => {
    const html = readFileSync(landing, "utf8");
    expect(html).not.toMatch(/<script[^>]+src=["'](?:https?:)?\/\//i);
    expect(html).not.toMatch(/<link[^>]+href="https?:[^"]*\.css/i);
  });

  it("landing carries the GoatCounter no-JS pixel (analytics on our hosting only)", () => {
    const html = readFileSync(landing, "utf8");
    expect(html).toMatch(/goatcounter\.com\/count/);
    // Must be a no-JS pixel, not a script include.
    expect(html).not.toMatch(/<script[^>]+goatcounter/i);
  });

  it("the app artifact is tracker-free (invariant: build output never phones home)", () => {
    const html = readFileSync(app, "utf8");
    expect(html).not.toContain("goatcounter");
    expect(html).not.toMatch(/src=["']https?:/);
  });
});
