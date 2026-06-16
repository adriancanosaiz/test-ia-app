import type { Option, Question } from "@prisma/client";

export interface UserAnswer {
  questionId: string;
  selectedOptionId?: string;
  booleanAnswer?: boolean;
  textAnswer?: string;
}

export interface GradedAnswer extends UserAnswer {
  isCorrect: boolean | null;
  feedback?: string;
}

export interface AttemptStats {
  total: number;
  correct: number;
  autoGradableTotal: number;
  autoGradableCorrect: number;
  gradedCount: number;
  score: number | null;
  autoScore: number | null;
}

export function gradeAnswer(
  answer: UserAnswer,
  question: Pick<Question, "type" | "isCorrect" | "modelAnswer">,
  options: Pick<Option, "id" | "isCorrect">[]
): boolean | null {
  switch (question.type) {
    case "MULTIPLE_CHOICE": {
      if (!answer.selectedOptionId) return null;
      const selected = options.find((o) => o.id === answer.selectedOptionId);
      return selected?.isCorrect ?? false;
    }
    case "TRUE_FALSE": {
      if (answer.booleanAnswer === undefined) return null;
      return answer.booleanAnswer === question.isCorrect;
    }
    case "SHORT_ANSWER":
      // Requiere corrección manual
      return null;
    default:
      return null;
  }
}

export function calculateScore(
  answers: GradedAnswer[],
  questions: Pick<Question, "id" | "type">[]
): number | null {
  const autoGradableQuestions = questions.filter(
    (q) => q.type !== "SHORT_ANSWER"
  );

  if (autoGradableQuestions.length === 0) {
    return null;
  }

  const correct = autoGradableQuestions.filter((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    return answer?.isCorrect === true;
  }).length;

  return Math.round((correct / autoGradableQuestions.length) * 100);
}

export function calculateAttemptStats(
  answers: { questionId: string; isCorrect: boolean | null }[],
  questions: { id: string; type: string }[]
): AttemptStats {
  const total = questions.length;
  const autoGradableQuestions = questions.filter(
    (q) => q.type !== "SHORT_ANSWER"
  );
  const autoGradableTotal = autoGradableQuestions.length;

  let correct = 0;
  let autoGradableCorrect = 0;
  let gradedCount = 0;

  for (const question of questions) {
    const answer = answers.find((a) => a.questionId === question.id);
    if (answer?.isCorrect === true) {
      correct++;
      if (question.type !== "SHORT_ANSWER") {
        autoGradableCorrect++;
      }
    }
    if (answer?.isCorrect !== null && answer?.isCorrect !== undefined) {
      gradedCount++;
    }
  }

  const score =
    gradedCount > 0 ? Math.round((correct / gradedCount) * 100) : null;
  const autoScore =
    autoGradableTotal > 0
      ? Math.round((autoGradableCorrect / autoGradableTotal) * 100)
      : null;

  return {
    total,
    correct,
    autoGradableTotal,
    autoGradableCorrect,
    gradedCount,
    score,
    autoScore,
  };
}
