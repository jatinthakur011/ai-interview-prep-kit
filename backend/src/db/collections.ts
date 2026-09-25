import { ObjectId, type Collection } from "mongodb";
import { getDb } from "./mongo.js";
import type { Kit } from "../domain/kit.js";

export interface UserDocument {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export type KitStatus = "pending" | "generating" | "ready" | "failed";

export interface KitError {
  code: string;
  message: string;
}

/** One flashcard's practice history (brief Section 7). */
export interface PracticeRecord {
  /** 1 = least confident, 3 = most confident. */
  confidence: 1 | 2 | 3;
  reviews: number;
  lastReviewedAt: string;
}

export interface KitDocument {
  _id: ObjectId;
  userId: ObjectId;
  status: KitStatus;
  error: KitError | null;
  input: { jd: string; companyUrl: string; days: number };
  /** The Appendix A structure once generation succeeds; null while pending/failed. */
  kit: Kit | null;
  /** Keyed by flashcard id. Absent entries have not been practiced yet. */
  practice: Record<string, PracticeRecord>;
  skippedSources: { url: string; reason: string }[];
  createdAt: Date;
  updatedAt: Date;
}

export const usersCollection = (): Collection<UserDocument> => getDb().collection<UserDocument>("users");
export const kitsCollection = (): Collection<KitDocument> => getDb().collection<KitDocument>("kits");

export const toId = (id: string): ObjectId => new ObjectId(id);
export const isValidId = (id: string): boolean => ObjectId.isValid(id);
