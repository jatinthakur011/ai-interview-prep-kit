import { describe, it, expect } from "vitest";
import { withRetry } from "../src/llm/retry.js";
import { LLMError } from "../src/llm/client.js";

const noSleep = { sleep: async () => {}, random: () => 0.5 };

describe("withRetry", () => {
  it("retries retryable errors then succeeds", async () => {
    let n = 0;
    const out = await withRetry(async () => {
      if (++n < 3) throw new LLMError("429", true);
      return "ok";
    }, noSleep);
    expect(out).toBe("ok");
    expect(n).toBe(3);
  });

  it("does not retry non-retryable errors", async () => {
    let n = 0;
    await expect(withRetry(async () => { n++; throw new LLMError("bad key", false); }, noSleep)).rejects.toThrow("bad key");
    expect(n).toBe(1);
  });

  it("gives up after the retry budget", async () => {
    let n = 0;
    await expect(withRetry(async () => { n++; throw new LLMError("503", true); }, { ...noSleep, retries: 2 })).rejects.toThrow("503");
    expect(n).toBe(3);
  });

  it("honours Retry-After over its own backoff", async () => {
    const waits: number[] = [];
    let n = 0;
    await withRetry(async () => {
      if (n++ === 0) throw new LLMError("429", true, 7000);
      return 1;
    }, { sleep: async (ms) => { waits.push(ms); }, random: () => 0 });
    expect(waits).toEqual([7000]);
  });
});
