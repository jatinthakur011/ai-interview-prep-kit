import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export const SESSION_COOKIE = "pk_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  email: string;
}

function secret(env = process.env): string {
  const s = env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set (see .env.example)");
  return s;
}

export function signSession(payload: SessionPayload, env = process.env): string {
  return jwt.sign(payload, secret(env), { expiresIn: SESSION_TTL_SECONDS });
}

/** Returns the payload, or null for a missing/invalid/expired token — never throws. */
export function verifySession(token: string | undefined, env = process.env): SessionPayload | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, secret(env));
    if (typeof decoded === "string" || !("userId" in decoded) || !("email" in decoded)) return null;
    return { userId: String((decoded as any).userId), email: String((decoded as any).email) };
  } catch {
    // Expired or tampered token: treated as "not logged in", not a server error.
    return null;
  }
}

export function setSessionCookie(
  res: Response,
  token: string,
  env = process.env
): void {
  const isProduction = env.NODE_ENV === "production";

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(
  res: Response,
  env = process.env
): void {
  const isProduction = env.NODE_ENV === "production";

  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/",
  });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}

/** Rejects a signed-out or expired-session visitor before any protected route runs. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = verifySession(token);
  if (!session) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in required or session expired." } });
    return;
  }
  req.user = session;
  next();
}
