import { LLMError } from "./client.js";

export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Retries retryable LLMErrors (429 / 5xx / network) with exponential backoff + jitter.
 * If the provider sent Retry-After, that wins over our own delay.
 * Non-retryable errors (bad key, 400) fail immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 6, baseMs = 1000, maxMs = 20_000, sleep = realSleep, random = Math.random } = opts;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err instanceof LLMError && err.retryable;
      if (!retryable || attempt >= retries) throw err;
      const backoff = Math.min(maxMs, baseMs * 2 ** attempt);
      const jittered = backoff / 2 + random() * (backoff / 2);
      const wait = (err as LLMError).retryAfterMs ?? jittered;
      await sleep(Math.min(maxMs, wait));
      attempt++;
    }
  }
}
