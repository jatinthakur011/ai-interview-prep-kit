import { describe, it, expect } from "vitest";
import { assertSafeUrl, UnsafeUrlError } from "../src/fetch/urlSafety.js";

describe("assertSafeUrl", () => {
  it("allows normal public https/http URLs", () => {
    expect(() => assertSafeUrl("https://example.com/careers")).not.toThrow();
    expect(() => assertSafeUrl("http://example.com")).not.toThrow();
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => assertSafeUrl("file:///etc/passwd")).toThrow(UnsafeUrlError);
    expect(() => assertSafeUrl("ftp://example.com")).toThrow(UnsafeUrlError);
  });

  it("rejects malformed URLs", () => {
    expect(() => assertSafeUrl("not a url")).toThrow(UnsafeUrlError);
  });

  it("rejects private and loopback IPs by default", () => {
    for (const u of ["http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.1.1/", "http://172.16.0.1/"]) {
      expect(() => assertSafeUrl(u)).toThrow(UnsafeUrlError);
    }
  });

  it("rejects localhost by default but allows it with allowLocal", () => {
    expect(() => assertSafeUrl("http://localhost:8099/acme/")).toThrow(UnsafeUrlError);
    expect(() => assertSafeUrl("http://localhost:8099/acme/", { allowLocal: true })).not.toThrow();
  });

  it("still rejects private IPs even with allowLocal (only loopback is special-cased)", () => {
    expect(() => assertSafeUrl("http://10.0.0.5/", { allowLocal: true })).toThrow(UnsafeUrlError);
  });
});
