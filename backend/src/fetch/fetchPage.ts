import { assertSafeUrl, type UrlSafetyOptions } from "./urlSafety.js";

export type FetchOutcome =
  | { ok: true; status: number; html: string; finalUrl: string }
  | { ok: false; reason: "UNSAFE_URL" | "TIMEOUT" | "HTTP_ERROR" | "BAD_CONTENT_TYPE" | "TOO_LARGE" | "NETWORK_ERROR"; detail: string };

export interface FetchPageOptions extends UrlSafetyOptions {
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
  userAgent?: string;
}

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB: pages beyond this are treated as out of scope, not fatal

/** Fetch one page, cleanly reporting *why* it failed so the caller can skip-and-report per the brief. */
export async function fetchPage(rawUrl: string, opts: FetchPageOptions = {}): Promise<FetchOutcome> {
  const doFetch = opts.fetchImpl ?? fetch;
  let url: URL;
  try {
    url = assertSafeUrl(rawUrl, opts);
  } catch (e) {
    return { ok: false, reason: "UNSAFE_URL", detail: (e as Error).message };
  }

  let res: Response;
  try {
    res = await doFetch(url.toString(), {
      redirect: "follow",
      headers: { "user-agent": opts.userAgent ?? "PrepKitBot/1.0 (+interview prep assistant)" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT),
    });
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError")
      return { ok: false, reason: "TIMEOUT", detail: `Timed out fetching ${rawUrl}` };
    return { ok: false, reason: "NETWORK_ERROR", detail: e?.message ?? String(e) };
  }

  if (!res.ok) return { ok: false, reason: "HTTP_ERROR", detail: `HTTP ${res.status} for ${rawUrl}` };

  const contentType = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml/i.test(contentType) && contentType !== "")
    return { ok: false, reason: "BAD_CONTENT_TYPE", detail: `Unexpected content-type: ${contentType}` };

  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const lenHeader = Number(res.headers.get("content-length"));
  if (Number.isFinite(lenHeader) && lenHeader > maxBytes)
    return { ok: false, reason: "TOO_LARGE", detail: `Content-Length ${lenHeader} exceeds ${maxBytes} bytes` };

  const buf = await res.arrayBuffer();
  if (buf.byteLength > maxBytes)
    return { ok: false, reason: "TOO_LARGE", detail: `Body ${buf.byteLength} bytes exceeds ${maxBytes} bytes` };

  return { ok: true, status: res.status, html: Buffer.from(buf).toString("utf-8"), finalUrl: res.url || url.toString() };
}
