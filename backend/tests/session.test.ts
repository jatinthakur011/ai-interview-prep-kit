import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { signSession, verifySession } from "../src/auth/session.js";

const env = { JWT_SECRET: "test-secret-value" };

describe("session tokens", () => {
  it("round-trips a valid session", () => {
    const token = signSession({ userId: "u1", email: "a@example.com" }, env);
    expect(verifySession(token, env)).toEqual({ userId: "u1", email: "a@example.com" });
  });

  it("returns null (not a throw) for a missing token", () => {
    expect(verifySession(undefined, env)).toBeNull();
  });

  it("returns null for a garbled token instead of throwing", () => {
    expect(verifySession("not-a-real-token", env)).toBeNull();
  });

  it("returns null for a token signed with a different secret", () => {
    const token = signSession({ userId: "u1", email: "a@example.com" }, env);
    expect(verifySession(token, { JWT_SECRET: "a-different-secret" })).toBeNull();
  });

  it("returns null for an expired token (sensible handling of expired sessions)", () => {
    const expired = jwt.sign({ userId: "u1", email: "a@example.com" }, env.JWT_SECRET, { expiresIn: -10 });
    expect(verifySession(expired, env)).toBeNull();
  });
});
