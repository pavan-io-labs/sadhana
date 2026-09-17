/**
 * Chronotype questionnaire  --  reduced Morningness–Eveningness Questionnaire (rMEQ).
 *
 * 5 questions, each scored 1–4 or 1–5. Total score determines chronotype:
 *   4–7  = Definitely Evening
 *   8–11 = Moderately Evening
 *  12–17 = Intermediate
 *  18–21 = Moderately Morning
 *  22–25 = Definitely Morning
 *
 * Stores the score and derived chronotype in settings.
 */

"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/card";


type Question = {
  id: number;
  text: string;
  options: { label: string; score: number }[];
};

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Considering only your own 'feeling best' rhythm, at what time would you get up if you were entirely free to plan your day?",
    options: [
      { label: "5:00–6:30 AM", score: 5 },
      { label: "6:30–7:45 AM", score: 4 },
      { label: "7:45–9:45 AM", score: 3 },
      { label: "9:45–11:00 AM", score: 2 },
      { label: "11:00 AM–12:00 PM", score: 1 },
    ],
  },
  {
    id: 2,
    text: "During the first half hour after you wake up in the morning, how do you feel?",
    options: [
      { label: "Very refreshed", score: 4 },
      { label: "Fairly refreshed", score: 3 },
      { label: "Fairly tired", score: 2 },
      { label: "Very tired", score: 1 },
    ],
  },
  {
    id: 3,
    text: "At what time in the evening do you feel tired and, as a result, in need of sleep?",
    options: [
      { label: "8:00–9:00 PM", score: 5 },
      { label: "9:00–10:15 PM", score: 4 },
      { label: "10:15 PM–12:30 AM", score: 3 },
      { label: "12:30–1:45 AM", score: 2 },
      { label: "1:45–3:00 AM", score: 1 },
    ],
  },
  {
    id: 4,
    text: "At what time of day do you feel your best?",
    options: [
      { label: "5:00–8:00 AM", score: 5 },
      { label: "8:00–10:00 AM", score: 4 },
      { label: "10:00 AM–5:00 PM", score: 3 },
      { label: "5:00–10:00 PM", score: 2 },
      { label: "10:00 PM–5:00 AM", score: 1 },
    ],
  },
  {
    id: 5,
    text: "One hears about 'morning types' and 'evening types'. Which of these do you consider yourself to be?",
    options: [
      { label: "Definitely a morning type", score: 6 },
      { label: "Rather more a morning type than an evening type", score: 4 },
      { label: "Rather more an evening type than a morning type", score: 2 },
      { label: "Definitely an evening type", score: 0 },
    ],
  },
];

function deriveChronotype(score: number): "early" | "intermediate" | "late" {
  if (score >= 18) return "early";
  if (score >= 12) return "intermediate";
  return "late";
}

function chronotypeLabel(score: number): string {
  if (score >= 22) return "Definitely Morning";
  if (score >= 18) return "Moderately Morning";
  if (score >= 12) return "Intermediate";
  if (score >= 8) return "Moderately Evening";
  return "Definitely Evening";
}

export function ChronotypeQuestionnaire({
  existingScore,
  onComplete,
}: {
  existingScore: number | null;
  onComplete: (score: number, chronotype: "early" | "intermediate" | "late") => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(existingScore !== null);

  const totalScore = useMemo(() => {
    if (Object.keys(answers).length < QUESTIONS.length) return null;
    return Object.values(answers).reduce((sum, s) => sum + s, 0);
  }, [answers]);

  const handleSelect = (questionId: number, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
  };

  const handleSubmit = () => {
    if (totalScore === null) return;
    const chronotype = deriveChronotype(totalScore);
    setSubmitted(true);
    onComplete(totalScore, chronotype);
  };

  if (submitted) {
    const score = existingScore ?? totalScore ?? 0;
    return (
      <Card padded>
        <CardHeader title="Chronotype" subtitle="Reduced MEQ result" />
        <div className="mt-3 flex items-center gap-3">
          <div className="nums text-3xl font-bold text-accent">{score}</div>
          <div>
            <p className="text-sm font-medium text-text-1">{chronotypeLabel(score)}</p>
            <p className="text-xs text-text-3">
              {deriveChronotype(score) === "early"
                ? "Your peak alertness is in the morning  --  the Brahma Muhurta practice fits you perfectly."
                : deriveChronotype(score) === "late"
                  ? "Your peak alertness is later  --  consider shifting your wake anchor gradually."
                  : "You're flexible  --  most schedule defaults work well for you."}
            </p>
          </div>
        </div>
        <button
          onClick={() => setSubmitted(false)}
          className="btn mt-3 text-xs"
        >
          Retake
        </button>
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <div className="px-4 py-3 border-b border-line">
        <CardHeader
          title="Chronotype Questionnaire"
          subtitle="Reduced Morningness–Eveningness Questionnaire (rMEQ)"
        />
        <p className="mt-1 text-xs text-text-3">
          5 questions · helps calibrate your wake anchor offset
        </p>
      </div>

      <div className="divide-y divide-line">
        {QUESTIONS.map((q, qi) => (
          <div key={q.id} className="px-4 py-3">
            <p className="text-sm text-text-1 mb-2">
              <span className="nums text-text-3 mr-1">{qi + 1}.</span>
              {q.text}
            </p>
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt.score}
                  onClick={() => handleSelect(q.id, opt.score)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    answers[q.id] === opt.score
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line text-text-3 hover:border-accent/30"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-line px-4 py-3 flex items-center justify-between">
        <span className="nums text-xs text-text-3">
          {Object.keys(answers).length}/{QUESTIONS.length} answered
          {totalScore !== null && ` · Score: ${totalScore}`}
        </span>
        <button
          onClick={handleSubmit}
          disabled={totalScore === null}
          className="btn btn-accent px-6"
        >
          Submit
        </button>
      </div>
    </Card>
  );
}
