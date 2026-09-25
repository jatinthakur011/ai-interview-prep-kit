export type Priority = "must" | "nice";
export type ReqKind = "technical" | "behavioural" | "domain";
export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";
export type Origin = "generated" | "user_edited" | "user_added";

export interface Requirement {
  id: string;
  text: string;
  kind: ReqKind;
  priority: Priority;
}

export interface Question {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  origin?: Origin;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  origin?: Origin;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Kit {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  company_brief: { summary: string; what_they_do: string; sources: string[] };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: { days_available: number; days: ScheduleDay[] };
  coverage: { uncovered_requirement_ids: string[]; passes: number };
}

export type KitStatus = "pending" | "generating" | "ready" | "failed";

export interface PracticeRecord {
  confidence: 1 | 2 | 3;
  reviews: number;
  lastReviewedAt: string;
}

export interface KitDocSummary {
  id: string;
  status: KitStatus;
  error: { code: string; message: string } | null;
  company: string | null;
  role: string;
  days: number;
  createdAt: string;
  updatedAt: string;
}

export interface KitDocFull extends KitDocSummary {
  input: { jd: string; companyUrl: string; days: number };
  kit: Kit | null;
  practice: Record<string, PracticeRecord>;
  skippedSources: { url: string; reason: string }[];
}
