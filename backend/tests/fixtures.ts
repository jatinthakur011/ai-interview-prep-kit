import type { Question, Requirement } from "../src/domain/kit.js";

export const requirements: Requirement[] = [
  { id: "r1", text: "5+ years with React", kind: "technical", priority: "must" },
  { id: "r2", text: "Mentor junior engineers", kind: "behavioural", priority: "must" },
  { id: "r3", text: "Bonus: GraphQL", kind: "technical", priority: "nice" },
];

export const questions: Question[] = [
  { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "React?", answer_outline: "", difficulty: 3, origin: "generated" },
  { id: "q2", requirement_ids: ["r2"], category: "behavioural", prompt: "Mentoring?", answer_outline: "", difficulty: 2, origin: "generated" },
  { id: "q3", requirement_ids: ["r3"], category: "technical", prompt: "GraphQL?", answer_outline: "", difficulty: 1, origin: "generated" },
];
