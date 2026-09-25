import type { DiscussionResult, DiscussionSearchClient } from "../src/discussion/client.js";

export function fakeDiscussion(results: DiscussionResult[] | (() => Promise<DiscussionResult[]>)): DiscussionSearchClient {
  return { search: async () => (typeof results === "function" ? results() : results) };
}
