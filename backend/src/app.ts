import express, { type ErrorRequestHandler } from "express";
import "express-async-errors"; // makes a thrown/rejected error in an async route reach the error handler below
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./api/authRoutes.js";
import { kitRouter } from "./api/kitRoutes.js";

export function createApp(env = process.env) {
  const app = express();

  const allowedOrigins = (env.CORS_ORIGINS || "http://localhost:3000").split(",").map((s) => s.trim());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: "2mb" })); // job descriptions can be long; keep this well above a typical posting
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/kits", kitRouter);

  app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "No such route." } }));

  // Last-resort handler: an unhandled error returns a structured message
  // instead of a raw stack trace (backend requirement, Section 13).
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
  };
  app.use(onError);

  return app;
}
