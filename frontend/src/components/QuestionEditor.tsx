"use client";
import { useState } from "react";
import type { Question, QuestionCategory } from "@/lib/types";
import OriginDot from "./OriginDot";

const CATEGORIES: QuestionCategory[] = ["technical", "behavioural", "system-design", "company-fit"];

interface Props {
  question: Question;
  index: number;
  count: number;
  onSave: (patch: Partial<Question>) => Promise<void>;
  onMove: (category: QuestionCategory) => Promise<void>;
  onDelete: () => Promise<void>;
  onReorder: (direction: "up" | "down") => void;
}

/** Inline-editable question card. Edits save on blur, so typing never round-trips per keystroke. */
export default function QuestionEditor({ question, index, count, onSave, onMove, onDelete, onReorder }: Props) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [outline, setOutline] = useState(question.answer_outline);
  const [busy, setBusy] = useState(false);

  async function commitIfChanged() {
    if (prompt === question.prompt && outline === question.answer_outline) return;
    setBusy(true);
    try {
      await onSave({ prompt, answer_outline: outline });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card card-pad">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 text-xs text-ink/50">
          <OriginDot origin={question.origin} />
          <span className="badge bg-black/[0.04] text-ink/60">Difficulty {question.difficulty}/3</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Move question up"
            disabled={index === 0}
            onClick={() => onReorder("up")}
            className="rounded-md px-1.5 py-0.5 text-ink/50 hover:bg-black/[0.05] disabled:opacity-30 focus-ring"
          >
            ↑
          </button>
          <button
            aria-label="Move question down"
            disabled={index === count - 1}
            onClick={() => onReorder("down")}
            className="rounded-md px-1.5 py-0.5 text-ink/50 hover:bg-black/[0.05] disabled:opacity-30 focus-ring"
          >
            ↓
          </button>
          <select
            aria-label="Move to category"
            value={question.category}
            onChange={(e) => onMove(e.target.value as QuestionCategory)}
            className="select-sm py-1 text-xs"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={onDelete}
            aria-label="Delete question"
            className="rounded-md px-1.5 py-0.5 text-ink/50 hover:bg-danger-soft hover:text-danger focus-ring"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="field mt-2.5">
        <label className="field-label">Question</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onBlur={commitIfChanged} rows={2} className="textarea" />
      </div>

      <div className="field mt-2.5">
        <label className="field-label">Answer outline</label>
        <textarea
          value={outline}
          onChange={(e) => setOutline(e.target.value)}
          onBlur={commitIfChanged}
          rows={2}
          className="textarea text-ink/70"
        />
      </div>
      {busy && <p className="mt-1.5 text-xs text-ink/40">Saving…</p>}
    </li>
  );
}
