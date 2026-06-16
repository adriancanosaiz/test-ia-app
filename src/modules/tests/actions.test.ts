import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  createFolder,
  createSubject,
  createDocument,
  createChunk,
} from "@/lib/test/factories";
import {
  createTest,
  deleteTest,
  getAttempt,
  getTest,
  getTests,
  createAttempt,
  gradeShortAnswer,
} from "./actions";
import { resetDatabase } from "@/lib/test/reset-db";
import { waitForQueueIdle } from "@/lib/jobs/runner";

async function seedDocumentWithChunks(content: string) {
  const folder = await createFolder({ name: "Carpeta" });
  const subject = await createSubject({ name: "Asignatura", folderId: folder.id });
  const document = await createDocument({
    title: "Apuntes",
    fileName: "apuntes.txt",
    storageKey: "12345678-1234-1234-1234-123456789abc",
    mimeType: "text/plain",
    subjectId: subject.id,
    status: "READY",
    chunkCount: 1,
  });
  await createChunk({
    documentId: document.id,
    content,
    index: 0,
    embedding: Array.from({ length: 768 }, () => 0.1),
  });
  return document;
}

function unwrap<T>(result: { success: true; data: T } | { success: false }) {
  if (!result.success) {
    throw new Error("Expected successful result");
  }
  return result.data;
}

function mockOllamaCompleteJSON(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/api/tags")) {
        return Response.json({
          models: [
            { name: "llama3.2:3b" },
            { name: "nomic-embed-text" },
          ],
        });
      }
      if (url.includes("/api/chat")) {
        return Response.json({ message: { content: JSON.stringify(payload) } });
      }
      return new Response("not found", { status: 404 });
    })
  );
}

describe("tests actions", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(async () => {
    await waitForQueueIdle();
    vi.unstubAllGlobals();
  });

  it("crea un test en estado PROCESSING y encola la generación", async () => {
    const document = await seedDocumentWithChunks(
      "Francia es un país. Su capital es París."
    );
    mockOllamaCompleteJSON({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Cuál es la capital de Francia?",
          options: ["Madrid", "París", "Lisboa"],
          isCorrectIndex: 1,
        },
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Francia es un país?",
          options: ["Sí", "No"],
          isCorrectIndex: 0,
        },
      ],
    });

    const { id, status, progress } = unwrap(
      await createTest({
        sourceType: "DOCUMENT",
        sourceId: document.id,
        questionType: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 2,
      })
    );

    expect(status).toBe("PROCESSING");
    expect(progress).toBe(0);

    await waitForQueueIdle();

    const found = await getTest(id);
    expect(found?.status).toBe("READY");
    expect(found?.questions).toHaveLength(2);
    expect(found?.questions[0].options).toHaveLength(3);
    expect(found?.questions[0].options[1].isCorrect).toBe(true);
  });

  it("devuelve error de validación si falta el ámbito", async () => {
    const result = await createTest({
      sourceType: "DOCUMENT",
      sourceId: "",
      questionType: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      questionCount: 2,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.fieldErrors?.sourceId).toBeDefined();
    }
  });

  it("crea un test de verdadero/falso", async () => {
    const document = await seedDocumentWithChunks(
      "París es la capital de Francia."
    );
    mockOllamaCompleteJSON({
      questions: [
        {
          type: "TRUE_FALSE",
          difficulty: "EASY",
          content: "París es la capital de Francia.",
          isCorrect: true,
        },
      ],
    });

    const { id } = unwrap(
      await createTest({
        sourceType: "DOCUMENT",
        sourceId: document.id,
        questionType: "TRUE_FALSE",
        difficulty: "EASY",
        questionCount: 1,
      })
    );

    await waitForQueueIdle();

    const found = await getTest(id);
    expect(found?.questions[0].type).toBe("TRUE_FALSE");
    expect(found?.questions[0].isCorrect).toBe(true);
  });

  it("lista tests con información del ámbito", async () => {
    const document = await seedDocumentWithChunks("Contenido");
    mockOllamaCompleteJSON({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "Pregunta",
          options: ["A", "B"],
          isCorrectIndex: 0,
        },
      ],
    });

    unwrap(
      await createTest({
        sourceType: "DOCUMENT",
        sourceId: document.id,
        questionType: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 1,
      })
    );

    await waitForQueueIdle();

    const tests = await getTests();
    expect(tests).toHaveLength(1);
    expect(tests[0].sourceLabel).toBe("Documento");
    expect(tests[0]._count.attempts).toBe(0);
  });

  it("elimina un test y sus preguntas", async () => {
    const document = await seedDocumentWithChunks("Contenido");
    mockOllamaCompleteJSON({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "Pregunta",
          options: ["A", "B"],
          isCorrectIndex: 0,
        },
      ],
    });

    const { id } = unwrap(
      await createTest({
        sourceType: "DOCUMENT",
        sourceId: document.id,
        questionType: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 1,
      })
    );

    await waitForQueueIdle();

    await deleteTest(id);

    const found = await getTest(id);
    expect(found).toBeNull();
  });

  it("crea un intento y calcula la nota", async () => {
    const document = await seedDocumentWithChunks("Francia. París.");
    mockOllamaCompleteJSON({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Capital de Francia?",
          options: ["Madrid", "París"],
          isCorrectIndex: 1,
        },
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Capital de España?",
          options: ["Madrid", "París"],
          isCorrectIndex: 0,
        },
      ],
    });

    const { id: testId } = unwrap(
      await createTest({
        sourceType: "DOCUMENT",
        sourceId: document.id,
        questionType: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 2,
      })
    );

    await waitForQueueIdle();

    const fullTest = await getTest(testId);
    if (!fullTest) throw new Error("Test no encontrado");

    const answers = fullTest.questions.map((q) => {
      const correctOption = q.options.find((o) => o.isCorrect);
      return {
        questionId: q.id,
        selectedOptionId: correctOption?.id,
      };
    });

    const attempt = unwrap(await createAttempt(testId, answers));
    expect(attempt.score).toBe(100);

    const foundAttempt = await getAttempt(attempt.id);
    expect(foundAttempt?.answers).toHaveLength(2);
    expect(foundAttempt?.answers.every((a) => a.isCorrect === true)).toBe(true);
  });

  it("devuelve error al crear intento si el test no existe", async () => {
    const result = await createAttempt("non-existent-id", []);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
    }
  });

  it("flujo completo: test de respuesta corta, intento y corrección manual", async () => {
    const document = await seedDocumentWithChunks(
      "La capital de España es Madrid."
    );
    mockOllamaCompleteJSON({
      questions: [
        {
          type: "SHORT_ANSWER",
          difficulty: "EASY",
          content: "¿Cuál es la capital de España?",
          modelAnswer: "Madrid",
        },
      ],
    });

    const { id: testId } = unwrap(
      await createTest({
        sourceType: "DOCUMENT",
        sourceId: document.id,
        questionType: "SHORT_ANSWER",
        difficulty: "EASY",
        questionCount: 1,
      })
    );

    await waitForQueueIdle();

    const fullTest = await getTest(testId);
    if (!fullTest) throw new Error("Test no encontrado");

    const attempt = unwrap(
      await createAttempt(testId, [
        { questionId: fullTest.questions[0].id, textAnswer: "Madrid" },
      ])
    );
    expect(attempt.score).toBeNull();

    const foundAttempt = await getAttempt(attempt.id);
    const answer = foundAttempt?.answers[0];
    if (!answer) throw new Error("Respuesta no encontrada");

    const graded = unwrap(
      await gradeShortAnswer({
        attemptId: attempt.id,
        answerId: answer.id,
        isCorrect: true,
      })
    );
    expect(graded.score).toBe(100);

    const afterGrade = await getAttempt(attempt.id);
    expect(afterGrade?.score).toBe(100);
    expect(afterGrade?.answers[0].isCorrect).toBe(true);
  });
});
