import { describe, it, expect } from "vitest";
import { parseRobots, allowAllRobots } from "../src/fetch/robots.js";

describe("robots", () => {
  it("allows everything with no rules", () => {
    expect(allowAllRobots.isAllowed("/anything")).toBe(true);
  });

  it("disallows matching prefixes for *", () => {
    const r = parseRobots("User-agent: *\nDisallow: /private/\nDisallow: /admin");
    expect(r.isAllowed("/private/page")).toBe(false);
    expect(r.isAllowed("/admin")).toBe(false);
    expect(r.isAllowed("/careers")).toBe(true);
  });

  it("more specific allow overrides a shorter disallow", () => {
    const r = parseRobots("User-agent: *\nDisallow: /\nAllow: /careers");
    expect(r.isAllowed("/careers")).toBe(true);
    expect(r.isAllowed("/other")).toBe(false);
  });

  it("reads crawl-delay", () => {
    const r = parseRobots("User-agent: *\nCrawl-delay: 2");
    expect(r.crawlDelayMs).toBe(2000);
  });
});
