import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { generateTestQuestions } from "./test-generator";
import { ollamaProvider } from "./ollama";
import type { RetrievedChunk } from "./retrieval";

vi.mock("./retrieval", () => ({
  retrieveChunksForScope: vi.fn(),
}));

import { retrieveChunksForScope } from "./retrieval";

const mockedRetrieveChunksForScope = vi.mocked(retrieveChunksForScope);

const fakeChunk: RetrievedChunk = {
  id: "chunk-1",
  content: "Contenido de ejemplo.",
  index: 0,
  tokenCount: 10,
  pageNumber: 1,
  documentId: "doc-1",
  documentTitle: "Apuntes",
  subjectId: "subject-1",
  subjectName: "Asignatura",
  folderId: "folder-1",
  folderName: "Grado",
  similarity: 0,
};

function createFetchMock(chatResponse: () => Response) {
  return vi.fn(async (url: string) => {
    if (url.includes("/api/tags")) {
      return Response.json({
        models: [
          { name: "llama3.2:3b" },
          { name: "nomic-embed-text" },
        ],
      });
    }
    return chatResponse();
  });
}

function mockCompleteJSONResponse(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    createFetchMock(() =>
      Response.json({ message: { content: JSON.stringify(payload) } })
    )
  );
}

describe("generateTestQuestions", () => {
  beforeEach(() => {
    mockedRetrieveChunksForScope.mockReset();
    vi.stubGlobal(
      "fetch",
      createFetchMock(() => new Response("not found", { status: 404 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lanza error si no hay contenido indexado", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([]);

    await expect(
      generateTestQuestions({
        sourceType: "SUBJECT",
        sourceId: "subject-1",
        questionType: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 3,
        provider: ollamaProvider.chat,
      })
    ).rejects.toThrow("No hay contenido indexado");
  });

  it("lanza error en inglés si no hay contenido indexado y language=en", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([]);

    await expect(
      generateTestQuestions({
        sourceType: "SUBJECT",
        sourceId: "subject-1",
        questionType: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 3,
        provider: ollamaProvider.chat,
        language: "en",
      })
    ).rejects.toThrow("There is no indexed content to generate the test");
  });

  it("genera preguntas de opción múltiple válidas", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);
    mockCompleteJSONResponse({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta 1?",
          options: ["A", "B", "C"],
          isCorrectIndex: 0,
          explanation: "Porque sí.",
        },
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta 2?",
          options: ["A", "B"],
          isCorrectIndex: 1,
        },
      ],
    });

    const result = await generateTestQuestions({
      sourceType: "SUBJECT",
      sourceId: "subject-1",
      questionType: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      questionCount: 2,
      provider: ollamaProvider.chat,
    });

    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].type).toBe("MULTIPLE_CHOICE");
    expect(result.sources).toEqual([fakeChunk]);
  });

  it("lanza error si el modelo no genera todas las preguntas tras reintentos", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);
    // El modelo siempre devuelve 1 pregunta, por lo que nunca alcanzará las 5 solicitadas.
    mockCompleteJSONResponse({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta?",
          options: ["A", "B"],
          isCorrectIndex: 0,
        },
      ],
    });

    await expect(
      generateTestQuestions({
        sourceType: "SUBJECT",
        sourceId: "subject-1",
        questionType: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 5,
        provider: ollamaProvider.chat,
      })
    ).rejects.toThrow(/generó \d+ preguntas en lugar de 5/);
  });

  it("rellena las preguntas faltantes en llamadas adicionales", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      createFetchMock(() => {
        callCount++;
        if (callCount === 1) {
          return Response.json({
            message: {
              content: JSON.stringify({
                questions: [
                  {
                    type: "TRUE_FALSE",
                    difficulty: "EASY",
                    content: "Pregunta 1",
                    isCorrect: true,
                  },
                ],
              }),
            },
          });
        }
        return Response.json({
          message: {
            content: JSON.stringify({
              questions: [
                {
                  type: "TRUE_FALSE",
                  difficulty: "EASY",
                  content: "Pregunta 2",
                  isCorrect: false,
                },
                {
                  type: "TRUE_FALSE",
                  difficulty: "EASY",
                  content: "Pregunta 3",
                  isCorrect: true,
                },
              ],
            }),
          },
        });
      })
    );

    const result = await generateTestQuestions({
      sourceType: "SUBJECT",
      sourceId: "subject-1",
      questionType: "TRUE_FALSE",
      difficulty: "EASY",
      questionCount: 3,
      provider: ollamaProvider.chat,
    });

    expect(result.questions).toHaveLength(3);
    expect(result.questions.map((q) => q.content)).toEqual([
      "Pregunta 1",
      "Pregunta 2",
      "Pregunta 3",
    ]);
  });

  it("trunca las preguntas si el modelo genera más de las solicitadas", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);
    mockCompleteJSONResponse({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta 1?",
          options: ["A", "B"],
          isCorrectIndex: 0,
        },
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta 2?",
          options: ["A", "B"],
          isCorrectIndex: 1,
        },
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta 3?",
          options: ["A", "B"],
          isCorrectIndex: 0,
        },
      ],
    });

    const result = await generateTestQuestions({
      sourceType: "SUBJECT",
      sourceId: "subject-1",
      questionType: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      questionCount: 2,
      provider: ollamaProvider.chat,
    });

    expect(result.questions).toHaveLength(2);
  });

  it("elimina opciones 'Correcta' y deduce isCorrectIndex en MULTIPLE_CHOICE", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);
    mockCompleteJSONResponse({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta?",
          options: ["Opción A", "Correcta", "Opción B", "Opción C"],
        },
      ],
    });

    const result = await generateTestQuestions({
      sourceType: "SUBJECT",
      sourceId: "subject-1",
      questionType: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      questionCount: 1,
      provider: ollamaProvider.chat,
    });

    const question = result.questions[0];
    expect(question.type).toBe("MULTIPLE_CHOICE");
    if (question.type === "MULTIPLE_CHOICE") {
      expect(question.options).toEqual(["Opción A", "Opción B", "Opción C"]);
      // El marcador sigue a "Opción A", así que se asigna isCorrectIndex = 0.
      expect(question.isCorrectIndex).toBe(0);
    }
  });

  it("elimina múltiples marcadores 'Correcta' y conserva el primero", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);
    mockCompleteJSONResponse({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta?",
          options: ["Correcta", "Opción A", "Correcta", "Opción B"],
        },
      ],
    });

    const result = await generateTestQuestions({
      sourceType: "SUBJECT",
      sourceId: "subject-1",
      questionType: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      questionCount: 1,
      provider: ollamaProvider.chat,
    });

    const question = result.questions[0];
    expect(question.type).toBe("MULTIPLE_CHOICE");
    if (question.type === "MULTIPLE_CHOICE") {
      expect(question.options).toEqual(["Opción A", "Opción B"]);
      expect(question.isCorrectIndex).toBe(0);
    }
  });

  it("lanza error si el modelo genera un tipo de pregunta distinto", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);
    mockCompleteJSONResponse({
      questions: [
        {
          type: "TRUE_FALSE",
          difficulty: "EASY",
          content: "Afirmación",
          isCorrect: true,
        },
      ],
    });

    await expect(
      generateTestQuestions({
        sourceType: "SUBJECT",
        sourceId: "subject-1",
        questionType: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionCount: 1,
        provider: ollamaProvider.chat,
      })
    ).rejects.toThrow("es de tipo TRUE_FALSE en lugar de MULTIPLE_CHOICE");
  });

  it("corrige automáticamente un índice de respuesta correcta fuera de rango", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);
    mockCompleteJSONResponse({
      questions: [
        {
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          content: "¿Pregunta?",
          options: ["A", "B"],
          isCorrectIndex: 5, // fuera de rango, debe corregirse a 1
        },
      ],
    });

    const result = await generateTestQuestions({
      sourceType: "SUBJECT",
      sourceId: "subject-1",
      questionType: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      questionCount: 1,
      provider: ollamaProvider.chat,
    });

    const question = result.questions[0];
    expect(question.type).toBe("MULTIPLE_CHOICE");
    if (question.type === "MULTIPLE_CHOICE") {
      expect(question.isCorrectIndex).toBe(1);
    }
  });

  it("normaliza isCorrect como string en preguntas TRUE_FALSE", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);
    mockCompleteJSONResponse({
      questions: [
        {
          type: "TRUE_FALSE",
          difficulty: "EASY",
          content: "Afirmación",
          isCorrect: "true",
        },
      ],
    });

    const result = await generateTestQuestions({
      sourceType: "SUBJECT",
      sourceId: "subject-1",
      questionType: "TRUE_FALSE",
      difficulty: "EASY",
      questionCount: 1,
      provider: ollamaProvider.chat,
    });

    const question = result.questions[0];
    expect(question.type).toBe("TRUE_FALSE");
    if (question.type === "TRUE_FALSE") {
      expect(question.isCorrect).toBe(true);
    }
  });

  it("normaliza isCorrect como número en preguntas TRUE_FALSE", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);
    mockCompleteJSONResponse({
      questions: [
        {
          type: "TRUE_FALSE",
          difficulty: "EASY",
          content: "Afirmación",
          isCorrect: 0,
        },
      ],
    });

    const result = await generateTestQuestions({
      sourceType: "SUBJECT",
      sourceId: "subject-1",
      questionType: "TRUE_FALSE",
      difficulty: "EASY",
      questionCount: 1,
      provider: ollamaProvider.chat,
    });

    const question = result.questions[0];
    expect(question.type).toBe("TRUE_FALSE");
    if (question.type === "TRUE_FALSE") {
      expect(question.isCorrect).toBe(false);
    }
  });

  it("reintenta una vez si la primera respuesta es inválida", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      createFetchMock(() => {
        callCount++;
        if (callCount === 1) {
          return Response.json({
            message: { content: JSON.stringify({ questions: [{ invalid: true }] }) },
          });
        }
        return Response.json({
          message: {
            content: JSON.stringify({
              questions: [
                {
                  type: "TRUE_FALSE",
                  difficulty: "EASY",
                  content: "Afirmación",
                  isCorrect: true,
                },
              ],
            }),
          },
        });
      })
    );

    const result = await generateTestQuestions({
      sourceType: "SUBJECT",
      sourceId: "subject-1",
      questionType: "TRUE_FALSE",
      difficulty: "EASY",
      questionCount: 1,
      provider: ollamaProvider.chat,
    });

    expect(callCount).toBe(2);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].type).toBe("TRUE_FALSE");
  });

  it("lanza el error original si tanto el intento como el reintento fallan", async () => {
    mockedRetrieveChunksForScope.mockResolvedValue([fakeChunk]);
    mockCompleteJSONResponse({
      questions: [{ invalid: true }],
    });

    await expect(
      generateTestQuestions({
        sourceType: "SUBJECT",
        sourceId: "subject-1",
        questionType: "TRUE_FALSE",
        difficulty: "EASY",
        questionCount: 1,
        provider: ollamaProvider.chat,
      })
    ).rejects.toThrow("no tiene el formato válido");
  });

  it("limita el contexto enviado a Ollama para evitar timeouts", async () => {
    const bigChunk: RetrievedChunk = {
      ...fakeChunk,
      id: "chunk-big",
      // Más de 4000 tokens estimados para forzar truncamiento.
      content: "a".repeat(25000),
      tokenCount: null,
    };
    const smallChunk: RetrievedChunk = {
      ...fakeChunk,
      id: "chunk-small",
      content: "Pregunta corta.",
      tokenCount: 5,
    };

    mockedRetrieveChunksForScope.mockResolvedValue([bigChunk, smallChunk]);

    let capturedBody = "";
    vi.stubGlobal(
      "fetch",
      createFetchMock(() => {
        const lastCall = vi.mocked(fetch).mock.calls.at(-1);
        if (lastCall) {
          const init = lastCall[1] as RequestInit | undefined;
          if (init?.body) {
            capturedBody = String(init.body);
          }
        }
        return Response.json({
          message: { content: JSON.stringify({ questions: [] }) },
        });
      })
    );

    await expect(
      generateTestQuestions({
        sourceType: "DOCUMENT",
        sourceId: "doc-1",
        questionType: "TRUE_FALSE",
        difficulty: "MEDIUM",
        questionCount: 1,
        provider: ollamaProvider.chat,
      })
    ).rejects.toThrow();

    // El contexto debe estar truncado: no caben 25000 caracteres dentro del límite.
    expect(capturedBody.length).toBeLessThan(25000);
    expect(capturedBody).not.toContain("a".repeat(25000));
    // El segundo chunk no debe haberse incluido porque el primero agotó el presupuesto.
    expect(capturedBody).not.toContain("Pregunta corta.");
  });
});
