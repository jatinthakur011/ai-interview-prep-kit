import type { Response } from "express";

export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

export const notFound = (res: Response, what: string) => sendError(res, 404, "NOT_FOUND", `${what} not found.`);
export const badRequest = (res: Response, message: string) => sendError(res, 400, "BAD_REQUEST", message);
export const serverError = (res: Response, message = "Something went wrong.") =>
  sendError(res, 500, "INTERNAL_ERROR", message);
