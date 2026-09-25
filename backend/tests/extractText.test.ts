import { describe, it, expect } from "vitest";
import { extractFromHtml } from "../src/fetch/extractText.js";

describe("extractFromHtml", () => {
  it("extracts title, visible text, and resolves relative links", () => {
    const html = `<html><head><title>Acme &mdash; Home</title><script>evil()</script></head>
      <body><h1>Welcome</h1><p>We build widgets.</p>
      <a href="/careers">Careers</a><a href="https://other.com/x">Other</a></body></html>`;
    const r = extractFromHtml(html, "https://acme.com/");
    expect(r.title).toContain("Acme");
    expect(r.text).toContain("We build widgets");
    expect(r.text).not.toContain("evil()");
    expect(r.links.find((l) => l.text === "Careers")?.href).toBe("https://acme.com/careers");
  });

  it("ignores anchors without hrefs and fragment-only links", () => {
    const html = `<a href="#top">Top</a><a>No href</a><a href="/jobs">Jobs</a>`;
    const r = extractFromHtml(html, "https://acme.com/");
    expect(r.links).toHaveLength(1);
    expect(r.links[0].href).toBe("https://acme.com/jobs");
  });
});
