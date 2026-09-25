import { describe, it, expect } from "vitest";
import { findInterviewDiscussion } from "../src/pipeline/findDiscussion.js";
import { fakeDiscussion } from "./fakeDiscussion.js";

describe("findInterviewDiscussion", () => {
  it("ranks and returns relevant results", async () => {
    const client = fakeDiscussion([
      { title: "Acme Interview Experience", url: "https://glassdoor.com/acme-interview", snippet: "Two rounds, a take-home and a system design call." },
      { title: "Unrelated recipe", url: "https://food.com/pasta", snippet: "Delicious pasta." },
    ]);
    const r = await findInterviewDiscussion("Acme", client);
    expect(r.found).toBe(true);
    expect(r.sources).toEqual(["https://glassdoor.com/acme-interview"]);
    expect(r.summary).toContain("take-home");
  });

  it("reports honestly when no client is configured", async () => {
    const r = await findInterviewDiscussion("Acme", null);
    expect(r).toEqual({ found: false, summary: "", sources: [] });
  });

  it("reports honestly when nothing relevant turns up", async () => {
    const client = fakeDiscussion([{ title: "Random", url: "https://x.com/y", snippet: "nothing to do with it" }]);
    const r = await findInterviewDiscussion("Acme", client);
    expect(r.found).toBe(false);
  });

  it("treats a search failure as a skip, not a crash", async () => {
    const client = { search: async () => { throw new Error("provider down"); } };
    const r = await findInterviewDiscussion("Acme", client);
    expect(r.found).toBe(false);
  });
});
