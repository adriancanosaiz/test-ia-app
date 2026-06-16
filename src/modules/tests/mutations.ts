"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { enqueueJob, cancelJob } from "@/lib/jobs/runner";
import "@/lib/jobs/registry";
import { action, parseFormData } from "@/lib/action-utils";
import { ActionResult, createUserError } from "@/lib/errors";
import { getLocale } from "@/lib/i18n/locale";
import {
  calculateAttemptStats,
  calculateScore,
  gradeAnswer,
  UserAnswer,
} from "./scoring";
import {
  createTestSchema,
  createAttemptSchema,
  gradeShortAnswerSchema,
} from "./schemas";
import { CreateTestData } from "./types";
import { getSourceName, sourceLabels } from "./queries";

export async function createTest(
  data: CreateTestData
): Promise<ActionResult<{ id: string; status: string; progress: number }>> {
  const parsed = parseFormData(createTestSchema, data);

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const sourceName =
      (await getSourceName(parsed.data.sourceType, parsed.data.sourceId)) ??
      "Ámbito";
    const title =
      parsed.data.title ||
      `Test de ${sourceLabels[parsed.data.sourceType]}: ${sourceName}`;

    const test = await prisma.test.create({
      data: {
        title,
        questionCount: parsed.data.questionCount,
        difficulty: parsed.data.difficulty,
        questionType: parsed.data.questionType,
        sourceType: parsed.data.sourceType,
        sourceId: parsed.data.sourceId,
        status: "PROCESSING",
        progress: 0,
      },
    });

    const locale = await getLocale();
    await enqueueJob("test", test.id, { payload: { locale } });

    revalidatePath("/tests");
    return { id: test.id, status: test.status, progress: test.progress };
  });
}

export async function retryGenerateTest(
  id: string
): Promise<ActionResult<{ id: string; status: string; progress: number }>> {
  return action(async () => {
    const existing = await prisma.test.findUnique({ where: { id } });
    if (!existing) {
      throw createUserError("El test no existe.");
    }

    const test = await prisma.test.update({
      where: { id },
      data: {
        status: "PROCESSING",
        progress: 0,
        errorMessage: null,
      },
    });

    const locale = await getLocale();
    await enqueueJob("test", test.id, { payload: { locale } });

    revalidatePath("/tests");
    return { id: test.id, status: test.status, progress: test.progress };
  });
}

export async function cancelTestGeneration(
  testId: string
): Promise<ActionResult<void>> {
  return action(async () => {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: { id: true },
    });

    if (!test) {
      throw createUserError("El test no existe.");
    }

    const job = await prisma.processingJob.findFirst({
      where: {
        entityType: "test",
        entityId: testId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!job) {
      throw createUserError("No hay generación activa para este test.");
    }

    await cancelJob(job.id);
    revalidatePath("/tests");
    revalidatePath(`/tests/${testId}`);
  });
}

export async function deleteTest(
  id: string
): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    await prisma.test.delete({ where: { id } });
    revalidatePath("/tests");
    return { id };
  });
}

export async function createAttempt(
  testId: string,
  answers: UserAnswer[]
): Promise<ActionResult<{ id: string; score: number | null }>> {
  const parsed = parseFormData(createAttemptSchema, { testId, answers });

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const test = await prisma.test.findUnique({
      where: { id: parsed.data.testId },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });

    if (!test) {
      throw createUserError("El test no existe.");
    }

    const gradedAnswers = parsed.data.answers.map((answer) => {
      const question = test.questions.find((q) => q.id === answer.questionId);
      if (!question) {
        throw createUserError("Alguna pregunta del intento no es válida.");
      }

      const isCorrect = gradeAnswer(answer, question, question.options);
      return {
        ...answer,
        isCorrect,
      };
    });

    const score = calculateScore(
      gradedAnswers,
      test.questions.map((q) => ({ id: q.id, type: q.type }))
    );

    const attempt = await prisma.$transaction(async (tx) => {
      const createdAttempt = await tx.testAttempt.create({
        data: {
          testId: parsed.data.testId,
          score,
          finishedAt: new Date(),
        },
      });

      await tx.answer.createMany({
        data: gradedAnswers.map((answer) => ({
          attemptId: createdAttempt.id,
          questionId: answer.questionId,
          selectedOptionId: answer.selectedOptionId ?? null,
          booleanAnswer: answer.booleanAnswer ?? null,
          textAnswer: answer.textAnswer ?? null,
          isCorrect: answer.isCorrect ?? null,
        })),
      });

      return createdAttempt;
    });

    revalidatePath(`/tests/${parsed.data.testId}/attempts`);
    return { id: attempt.id, score: attempt.score };
  });
}

export async function gradeShortAnswer(
  data: {
    attemptId: string;
    answerId: string;
    isCorrect: boolean;
  }
): Promise<ActionResult<{ id: string; score: number | null }>> {
  const parsed = parseFormData(gradeShortAnswerSchema, data);

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los datos de la corrección."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const answer = await prisma.answer.findUnique({
      where: { id: parsed.data.answerId },
      include: {
        question: true,
        attempt: {
          include: {
            test: {
              include: { questions: true },
            },
          },
        },
      },
    });

    if (!answer) {
      throw createUserError("La respuesta no existe.");
    }

    if (answer.attemptId !== parsed.data.attemptId) {
      throw createUserError("La respuesta no pertenece al intento.");
    }

    if (answer.question.type !== "SHORT_ANSWER") {
      throw createUserError("Solo se pueden calificar respuestas cortas.");
    }

    await prisma.answer.update({
      where: { id: answer.id },
      data: { isCorrect: parsed.data.isCorrect },
    });

    const updatedAnswers = await prisma.answer.findMany({
      where: { attemptId: answer.attemptId },
    });

    const stats = calculateAttemptStats(
      updatedAnswers,
      answer.attempt.test.questions
    );
    const score = stats.score;

    await prisma.testAttempt.update({
      where: { id: answer.attemptId },
      data: { score },
    });

    revalidatePath(`/tests/${answer.attempt.testId}/attempts/${answer.attemptId}`);
    return { id: answer.attemptId, score };
  });
}
