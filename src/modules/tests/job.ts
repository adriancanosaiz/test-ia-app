import { prisma } from "@/lib/prisma";
import { generateTestQuestions } from "@/modules/ai/test-generator";
import { getLocaleFromPayload, getJobMessage } from "@/lib/i18n/jobs";
import { AbortError, JobRunner } from "@/lib/jobs/runner";

function checkSignal(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AbortError("Generación cancelada");
  }
}

export async function generateTestJob(
  testId: string,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: number) => void | Promise<void>;
    payload?: unknown;
  }
): Promise<void> {
  const signal = options?.signal;
  const onProgress = options?.onProgress;
  const language = getLocaleFromPayload(options?.payload);

  const test = await prisma.test.findUnique({
    where: { id: testId },
  });

  if (!test) {
    throw new Error(`Test no encontrado: ${testId}`);
  }

  checkSignal(signal);
  await prisma.test.update({
    where: { id: testId },
    data: { status: "PROCESSING", progress: 10, errorMessage: null },
  });
  await onProgress?.(10);

  try {
    checkSignal(signal);
    const { questions } = await generateTestQuestions({
      sourceType: test.sourceType,
      sourceId: test.sourceId,
      questionType: test.questionType,
      difficulty: test.difficulty,
      questionCount: test.questionCount,
      language,
      onProgress: async (progress) => {
        checkSignal(signal);
        await prisma.test.update({
          where: { id: testId },
          data: { progress },
        });
        await onProgress?.(progress);
      },
    });

    checkSignal(signal);
    await prisma.$transaction(async (tx) => {
      await tx.test.update({
        where: { id: testId },
        data: { progress: 100 },
      });

      for (const q of questions) {
        const question = await tx.question.create({
          data: {
            testId,
            type: q.type,
            difficulty: q.difficulty,
            content: q.content,
            explanation: q.explanation,
            isCorrect: q.type === "TRUE_FALSE" ? q.isCorrect : null,
            modelAnswer: q.type === "SHORT_ANSWER" ? q.modelAnswer : null,
          },
        });

        if (q.type === "MULTIPLE_CHOICE") {
          await tx.option.createMany({
            data: q.options.map((text, index) => ({
              questionId: question.id,
              text,
              index,
              isCorrect: index === q.isCorrectIndex,
            })),
          });
        }
      }
    });

    checkSignal(signal);
    await prisma.test.update({
      where: { id: testId },
      data: { status: "READY" },
    });
    await onProgress?.(100);

  } catch (error) {
    if (error instanceof AbortError) {
      await prisma.test.update({
        where: { id: testId },
        data: {
          status: "ERROR",
          errorMessage: getJobMessage(language, "cancelled"),
        },
      });
      throw error;
    }

    const message =
      error instanceof Error
        ? error.message
        : getJobMessage(language, "unknownError");

    await prisma.test.update({
      where: { id: testId },
      data: { status: "ERROR", errorMessage: message },
    });
  }
}

export const generateTestJobRunner: JobRunner = async ({
  entityId,
  signal,
  onProgress,
  payload,
}) => {
  await generateTestJob(entityId, { signal, onProgress, payload });
};
