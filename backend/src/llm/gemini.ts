import { LLMError, type LLMClient, type LLMRequest } from "./client.js";
import { withRetry, type RetryOptions } from "./retry.js";

export interface GeminiOptions {
  apiKey: string;
  model: string;
  retry?: RetryOptions;
  fetchImpl?: typeof fetch;
}

export function createGeminiClient(opts: GeminiOptions): LLMClient {
  const doFetch = opts.fetchImpl ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`;

  async function callOnce(req: LLMRequest): Promise<string> {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": opts.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.user }] }],
          generationConfig: { temperature: req.temperature ?? 0.2, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      throw new LLMError(`Network error calling Gemini: ${(e as Error).message}`, true);
    }

    if (!res.ok) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const retryable = res.status === 429 || res.status >= 500;
      throw new LLMError(
        `Gemini HTTP ${res.status}`,
        retryable,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined
      );
    }
    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("");
    if (!text) throw new LLMError("Gemini returned an empty response", true);
    return text;
  }

  return { generateJson: (req) => withRetry(() => callOnce(req), opts.retry) };
}

export function createLLMFromEnv(env = process.env): LLMClient {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (see .env.example)");
  // "gemini-2.5-flash" was deprecated/shut down mid-2026 (see ai.google.dev/gemini-api/docs/deprecations);
  // "gemini-flash-latest" is Google's rolling alias to the current stable Flash model, so it keeps
  // working as Google retires and replaces models, unless the deployer pins a specific one via env.
  return createGeminiClient({ apiKey, model: env.GEMINI_MODEL || "gemini-flash-latest" });
}
