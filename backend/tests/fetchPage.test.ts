import { describe, it, expect } from "vitest";
import { fetchPage } from "../src/fetch/fetchPage.js";
import { fakeSite } from "./fakeSite.js";

describe("fetchPage", () => {
  it("returns html on success", async () => {
    const fetchImpl = fakeSite({ "/": { body: "<html>hi</html>" } });
    const r = await fetchPage("https://acme.com/", { fetchImpl });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.html).toContain("hi");
  });

  it("reports HTTP_ERROR on 404 without throwing", async () => {
    const fetchImpl = fakeSite({});
    const r = await fetchPage("https://acme.com/missing", { fetchImpl });
    expect(r).toMatchObject({ ok: false, reason: "HTTP_ERROR" });
  });

  it("rejects unsafe URLs before making a request", async () => {
    let called = false;
    const fetchImpl = (async () => { called = true; return new Response("x"); }) as unknown as typeof fetch;
    const r = await fetchPage("http://127.0.0.1/", { fetchImpl });
    expect(r).toMatchObject({ ok: false, reason: "UNSAFE_URL" });
    expect(called).toBe(false);
  });

  it("rejects unexpected content types", async () => {
    const fetchImpl = fakeSite({ "/": { body: "binary", contentType: "application/octet-stream" } });
    const r = await fetchPage("https://acme.com/", { fetchImpl });
    expect(r).toMatchObject({ ok: false, reason: "BAD_CONTENT_TYPE" });
  });

  it("rejects bodies over the size limit", async () => {
    const fetchImpl = fakeSite({ "/": { body: "x".repeat(1000) } });
    const r = await fetchPage("https://acme.com/", { fetchImpl, maxBytes: 100 });
    expect(r).toMatchObject({ ok: false, reason: "TOO_LARGE" });
  });

  it("reports TIMEOUT on abort", async () => {
    const fetchImpl = (async (_: any, init: any) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const e = new Error("aborted"); e.name = "TimeoutError"; reject(e);
        });
      });
    }) as unknown as typeof fetch;
    const r = await fetchPage("https://acme.com/", { fetchImpl, timeoutMs: 5 });
    expect(r).toMatchObject({ ok: false, reason: "TIMEOUT" });
  });
});
