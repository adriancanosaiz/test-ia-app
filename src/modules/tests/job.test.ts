import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { generateTestJob } from "./job";
import { resetDatabase } from "@/lib/test/reset-db";
import { prismaTest } from "@/lib/test/prisma";
import { generateTestQuestions } from "@/modules/ai/test-generator";

vi.mock("@/modules/ai/test-generator", () => ({
  generateTestQuestions: vi.fn(),
}));

const mockedGenerateTestQuestions = vi.mocked(generateTestQuestions);

async function createTestRecord(status: string = "DRAFT") {
  return prismaTest.test.create({
    data: {
      title: "Test de ejemplo",
      questionCount: 2,
      difficulty: "MEDIUM",
      questionType: "MULTIPLE_CHOICE",
      sourceType: "DOCUMENT",
      sourceId: "doc-1",
      status: status as "DRAFT" | "READY" | "PROCESSING" | "ERROR",
      progress: 0,
    },
  });
}

describe("generateTestJob", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockedGenerateTestQuestions.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("genera preguntas, actualiza estados y finaliza en READY", async () => {
    const test = await createTestRecord("DRAFT");

    mockedGenerateTestQuestions.mockResolvedValue({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta 1?",
          options: ["A", "B", "C"],
          isCorrectIndex: 1,
          explanation: "Explicación 1",
        },
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta 2?",
          options: ["A", "B"],
          isCorrectIndex: 0,
        },
      ],
      sources: [],
    });

    await generateTestJob(test.id);

    const updated = await prismaTest.test.findUnique({
      where: { id: test.id },
    });

    expect(updated?.status).toBe("READY");
    expect(updated?.progress).toBe(100);
    expect(updated?.errorMessage).toBeNull();

    const questions = await prismaTest.question.findMany({
      where: { testId: test.id },
      include: { options: { orderBy: { index: "asc" } } },
      orderBy: { createdAt: "asc" },
    });

    expect(questions).toHaveLength(2);
    expect(questions[0].content).toBe("¿Pregunta 1?");
    expect(questions[0].options).toHaveLength(3);
    expect(questions[0].options[1].isCorrect).toBe(true);
  });

  it("notifica progreso durante la generación", async () => {
    const test = await createTestRecord("DRAFT");

    mockedGenerateTestQuestions.mockImplementation(async (options) => {
      if (options.onProgress) {
        await options.onProgress(30);
        await options.onProgress(50);
        await options.onProgress(80);
      }
      return {
        questions: [
          {
            type: "MULTIPLE_CHOICE",
            difficulty: "MEDIUM",
            content: "¿Pregunta?",
            options: ["A", "B"],
            isCorrectIndex: 0,
          },
        ],
        sources: [],
      };
    });

    await generateTestJob(test.id);

    const history = await prismaTest.test.findUnique({ where: { id: test.id } });
    expect(history?.progress).toBe(100);
    expect(history?.status).toBe("READY");
  });

  it("marca el test como ERROR cuando la generación falla", async () => {
    const test = await createTestRecord("DRAFT");

    mockedGenerateTestQuestions.mockRejectedValue(
      new Error("No hay contenido indexado")
    );

    await generateTestJob(test.id);

    const updated = await prismaTest.test.findUnique({
      where: { id: test.id },
    });

    expect(updated?.status).toBe("ERROR");
    expect(updated?.errorMessage).toBe("No hay contenido indexado");
  });

  it("pasa el locale del payload a generateTestQuestions", async () => {
    const test = await createTestRecord("DRAFT");

    mockedGenerateTestQuestions.mockResolvedValue({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta?",
          options: ["A", "B"],
          isCorrectIndex: 0,
        },
      ],
      sources: [],
    });

    await generateTestJob(test.id, { payload: { locale: "en" } });

    expect(mockedGenerateTestQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en" })
    );
  });
});
