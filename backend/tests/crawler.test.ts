import { describe, it, expect } from "vitest";
import { crawlCompanySite } from "../src/fetch/crawler.js";
import { fakeSite } from "./fakeSite.js";

const noSleep = { sleep: async () => {} };

describe("crawlCompanySite", () => {
  it("finds a hiring page at an unpredictable path by ranking links, not a fixed list", async () => {
    const fetchImpl = fakeSite({
      "/": {
        body: `<html><title>Acme</title><body>
          <p>Acme builds developer tools.</p>
          <a href="/about">About</a>
          <a href="/engineering-handbook/how-we-hire">How We Hire</a>
          <a href="/blog">Blog</a>
        </body></html>`,
      },
      "/about": { body: "<html><title>About</title><body>We are Acme.</body></html>" },
      "/engineering-handbook/how-we-hire": {
        body: `<html><title>How We Hire</title><body>
          Our interview process: a take-home project followed by a system design round.
        </body></html>`,
      },
      "/blog": { body: "<html><title>Blog</title><body>Latest news.</body></html>" },
      "/robots.txt": { body: "User-agent: *\n" },
    });

    const r = await crawlCompanySite("https://acme.com/", { fetchImpl, ...noSleep });
    expect(r.homepage?.text).toContain("developer tools");
    expect(r.hiringPage?.url).toBe("https://acme.com/engineering-handbook/how-we-hire");
    expect(r.hiringPage?.text).toContain("take-home");
    expect(r.pagesUsed).toContain("https://acme.com/");
    expect(r.skipped).toEqual([]);
  });

  it("returns homepage with hiringPage null when no hiring page exists", async () => {
    const fetchImpl = fakeSite({
      "/": { body: `<html><title>Acme</title><body>We sell widgets. <a href="/products">Products</a></body></html>` },
      "/products": { body: "<html><title>Products</title><body>Our widgets.</body></html>" },
      "/robots.txt": { body: "User-agent: *\n" },
    });
    const r = await crawlCompanySite("https://acme.com/", { fetchImpl, ...noSleep });
    expect(r.homepage).not.toBeNull();
    expect(r.hiringPage).toBeNull();
  });

  it("skips and reports rather than failing when the homepage 404s", async () => {
    const fetchImpl = fakeSite({ "/robots.txt": { body: "" } });
    const r = await crawlCompanySite("https://acme.com/", { fetchImpl, ...noSleep });
    expect(r.homepage).toBeNull();
    expect(r.skipped.length).toBeGreaterThan(0);
  });

  it("skips and reports on an invalid company URL instead of throwing", async () => {
    const r = await crawlCompanySite("not-a-url", { ...noSleep });
    expect(r.homepage).toBeNull();
    expect(r.skipped[0].reason).toMatch(/valid URL/);
  });

  it("respects robots.txt disallow rules", async () => {
    const fetchImpl = fakeSite({
      "/": { body: `<html><title>Acme</title><body><a href="/careers">Careers</a></body></html>` },
      "/careers": { body: "<html><title>Careers</title><body>Join our interview process.</body></html>" },
      "/robots.txt": { body: "User-agent: *\nDisallow: /careers" },
    });
    const r = await crawlCompanySite("https://acme.com/", { fetchImpl, ...noSleep });
    expect(r.hiringPage).toBeNull();
    expect(r.skipped.some((s) => s.reason.includes("robots"))).toBe(true);
  });

  it("allows a localhost target only when allowLocal is set (Appendix B batch case)", async () => {
    const fetchImpl = fakeSite({
      "/acme/": { body: `<html><title>Acme</title><body>Local co. <a href="/acme/careers">Careers</a></body></html>` },
      "/acme/careers": { body: "<html><title>Careers</title><body>Our interview process is two rounds.</body></html>" },
      "/robots.txt": { body: "" },
    });
    const blocked = await crawlCompanySite("http://localhost:8099/acme/", { fetchImpl, ...noSleep });
    expect(blocked.homepage).toBeNull();

    const allowed = await crawlCompanySite("http://localhost:8099/acme/", { fetchImpl, allowLocal: true, ...noSleep });
    expect(allowed.homepage).not.toBeNull();
    expect(allowed.hiringPage?.text).toContain("interview process");
  });

  it("does not follow links to a different origin", async () => {
    const fetchImpl = fakeSite({
      "/": { body: `<html><title>Acme</title><body><a href="https://jobs-board.com/careers?co=acme">External Careers</a></body></html>` },
      "/robots.txt": { body: "" },
    });
    const r = await crawlCompanySite("https://acme.com/", { fetchImpl, ...noSleep });
    expect(r.pagesUsed).toEqual(["https://acme.com/"]);
  });
});
