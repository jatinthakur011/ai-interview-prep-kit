const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Every call includes credentials so the httpOnly session cookie is sent.
 * Errors are thrown as ApiError with the backend's structured message, so
 * callers can show something useful instead of a generic failure.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  if (res.status === 204) return undefined as T;

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }

  if (!res.ok) {
    const message = body?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body?.error?.code);
  }
  return body as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ id: string; email: string }>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<{ id: string; email: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ id: string; email: string }>("/api/auth/me"),

  listKits: () => request<import("./types").KitDocSummary[]>("/api/kits"),
  getKit: (id: string) => request<import("./types").KitDocFull>(`/api/kits/${id}`),
  createKit: (jd: string, company_url: string, days: number) =>
    request<{ id: string; status: string }>("/api/kits", { method: "POST", body: JSON.stringify({ jd, company_url, days }) }),
  createKitsBatch: (cases: { jd: string; company_url: string; days: number }[]) =>
    request<{ ids: string[] }>("/api/kits/batch", { method: "POST", body: JSON.stringify(cases) }),
  deleteKit: (id: string) => request<void>(`/api/kits/${id}`, { method: "DELETE" }),
  regenerate: (id: string, target: string, days?: number) =>
    request<{ id: string; status: string }>(`/api/kits/${id}/regenerate`, { method: "POST", body: JSON.stringify({ target, days }) }),

  addQuestion: (id: string, q: { prompt: string; answer_outline?: string; category: string; difficulty?: number; requirement_ids?: string[] }) =>
    request<import("./types").Kit>(`/api/kits/${id}/questions`, { method: "POST", body: JSON.stringify(q) }),
  editQuestion: (id: string, qid: string, patch: Partial<import("./types").Question>) =>
    request<import("./types").Kit>(`/api/kits/${id}/questions/${qid}`, { method: "PATCH", body: JSON.stringify(patch) }),
  moveQuestion: (id: string, qid: string, category: string) =>
    request<import("./types").Kit>(`/api/kits/${id}/questions/${qid}/move`, { method: "PATCH", body: JSON.stringify({ category }) }),
  deleteQuestion: (id: string, qid: string) =>
    request<import("./types").Kit>(`/api/kits/${id}/questions/${qid}`, { method: "DELETE" }),
  reorderQuestions: (id: string, order: string[]) =>
    request<import("./types").Kit>(`/api/kits/${id}/questions`, { method: "PATCH", body: JSON.stringify({ order }) }),

  addFlashcard: (id: string, card: { front: string; back: string; requirement_ids?: string[] }) =>
    request<import("./types").Kit>(`/api/kits/${id}/flashcards`, { method: "POST", body: JSON.stringify(card) }),
  editFlashcard: (id: string, fid: string, patch: Partial<import("./types").Flashcard>) =>
    request<import("./types").Kit>(`/api/kits/${id}/flashcards/${fid}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteFlashcard: (id: string, fid: string) =>
    request<import("./types").Kit>(`/api/kits/${id}/flashcards/${fid}`, { method: "DELETE" }),

  editBrief: (id: string, patch: { summary?: string; what_they_do?: string }) =>
    request<import("./types").Kit>(`/api/kits/${id}/company-brief`, { method: "PATCH", body: JSON.stringify(patch) }),
  editSchedule: (id: string, days: import("./types").ScheduleDay[]) =>
    request<import("./types").Kit>(`/api/kits/${id}/schedule`, { method: "PATCH", body: JSON.stringify({ days }) }),

  recordPractice: (id: string, flashcardId: string, confidence: 1 | 2 | 3) =>
    request<import("./types").PracticeRecord>(`/api/kits/${id}/practice/${flashcardId}`, { method: "POST", body: JSON.stringify({ confidence }) }),
  nextPracticeOrder: (id: string) =>
    request<{ order: string[]; covered: number; total: number }>(`/api/kits/${id}/practice/next`),
};
