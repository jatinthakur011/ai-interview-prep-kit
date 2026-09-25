import { Router } from "express";
import { z } from "zod";
import { usersCollection } from "../db/collections.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signSession, setSessionCookie, clearSessionCookie, requireAuth } from "../auth/session.js";
import { badRequest, sendError } from "./errors.js";

export const authRouter = Router();

const CredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

authRouter.post("/register", async (req, res) => {
  const parsed = CredentialsSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message ?? "Invalid input.");
  const { email, password } = parsed.data;

  const existing = await usersCollection().findOne({ email });
  if (existing) return sendError(res, 409, "EMAIL_TAKEN", "An account with that email already exists.");

  const passwordHash = await hashPassword(password);
  const { insertedId } = await usersCollection().insertOne({
    email,
    passwordHash,
    createdAt: new Date(),
  } as any);

  const token = signSession({ userId: insertedId.toString(), email });
  setSessionCookie(res, token);
  res.status(201).json({ id: insertedId.toString(), email });
});

authRouter.post("/login", async (req, res) => {
  const parsed = CredentialsSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "Email and password are required.");
  const { email, password } = parsed.data;

  const user = await usersCollection().findOne({ email });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) return sendError(res, 401, "INVALID_CREDENTIALS", "Incorrect email or password.");

  const token = signSession({ userId: user._id.toString(), email: user.email });
  setSessionCookie(res, token);
  res.json({ id: user._id.toString(), email: user.email });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ id: req.user!.userId, email: req.user!.email });
});
