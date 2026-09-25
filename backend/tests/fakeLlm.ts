import type { LLMClient } from "../src/llm/client.js";

/** Scripted LLM: returns replies in order and records what it was asked. */
export function fakeLlm(replies: string[]): LLMClient & { calls: { system: string; user: string }[] } {
  const calls: { system: string; user: string }[] = [];
  let i = 0;
  return {
    calls,
    async generateJson(req) {
      calls.push({ system: req.system, user: req.user });
      return replies[Math.min(i++, replies.length - 1)];
    },
  };
}
