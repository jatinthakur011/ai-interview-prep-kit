/**
 * SSRF protection (brief Section 11): reject private/loopback/link-local
 * addresses in production, so the app can't be used to probe internal
 * infrastructure. Loopback is allowed when ALLOW_LOCAL_FETCH=true, which the
 * batch command sets, because Appendix B explicitly serves test company
 * sites from http://localhost:PORT.
 */
export interface UrlSafetyOptions {
  allowLocal?: boolean;
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const h = ip.toLowerCase();
  return h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd");
}

const isIpLiteral = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");

/** Validates scheme, host shape and known-private ranges. DNS-resolved
 *  rebinding (a public hostname that resolves to a private IP at fetch
 *  time) is not caught here; see the README limitation note. */
export function assertSafeUrl(rawUrl: string, opts: UrlSafetyOptions = {}): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${rawUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new UnsafeUrlError(`Unsupported protocol: ${url.protocol}`);

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const isLoopbackName = host === "localhost" || host.endsWith(".localhost");

  if (isLoopbackName || host === "127.0.0.1" || host === "::1") {
    if (!opts.allowLocal) throw new UnsafeUrlError(`Loopback address not allowed: ${host}`);
    return url;
  }
  if (isIpLiteral(host) && (isPrivateIPv4(host) || isPrivateIPv6(host)))
    throw new UnsafeUrlError(`Private/internal address not allowed: ${host}`);

  return url;
}
