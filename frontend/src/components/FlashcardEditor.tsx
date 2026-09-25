"use client";
import { useState } from "react";
import type { Flashcard } from "@/lib/types";
import OriginDot from "./OriginDot";

interface Props {
  card: Flashcard;
  onSave: (patch: Partial<Flashcard>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function FlashcardEditor({ card, onSave, onDelete }: Props) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);

  async function commitIfChanged() {
    if (front === card.front && back === card.back) return;
    await onSave({ front, back });
  }

  return (
    <li className="card card-pad">
      <div className="flex items-center justify-between">
        <OriginDot origin={card.origin} />
        <button onClick={onDelete} aria-label="Delete flashcard" className="rounded-md px-1.5 py-0.5 text-ink/50 hover:bg-danger-soft hover:text-danger focus-ring">
          ✕
        </button>
      </div>
      <div className="field mt-2.5">
        <label className="field-label">Front</label>
        <textarea value={front} onChange={(e) => setFront(e.target.value)} onBlur={commitIfChanged} rows={2} className="textarea" />
      </div>
      <div className="field mt-2.5">
        <label className="field-label">Back</label>
        <textarea value={back} onChange={(e) => setBack(e.target.value)} onBlur={commitIfChanged} rows={2} className="textarea text-ink/70" />
      </div>
    </li>
  );
}
