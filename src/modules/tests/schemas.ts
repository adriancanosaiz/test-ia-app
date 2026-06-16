import { z } from "zod";

export const createTestSchema = z.object({
  title: z.string().min(1).optional(),
  sourceType: z.enum(["FOLDER", "SUBJECT", "DOCUMENT"]),
  sourceId: z.string().min(1, "El ámbito es obligatorio"),
  questionType: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  questionCount: z.number().int().min(1).max(20),
});

export const createAttemptSchema = z.object({
  testId: z.string().min(1, "El test es obligatorio"),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      selectedOptionId: z.string().optional(),
      booleanAnswer: z.boolean().optional(),
      textAnswer: z.string().optional(),
    })
  ),
});

export const gradeShortAnswerSchema = z.object({
  attemptId: z.string().min(1, "El intento es obligatorio"),
  answerId: z.string().min(1, "La respuesta es obligatoria"),
  isCorrect: z.boolean(),
});
