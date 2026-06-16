import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { generateAnswer } from "./rag";
import { ollamaProvider } from "./ollama";
import type { RetrievedChunk } from "./retrieval";

vi.mock("./retrieval", () => ({
  retrieveChunks: vi.fn(),
}));

import { retrieveChunks } from "./retrieval";

const mockedRetrieveChunks = vi.mocked(retrieveChunks);

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

describe("generateAnswer", () => {
  beforeEach(() => {
    mockedRetrieveChunks.mockReset();
    vi.stubGlobal(
      "fetch",
      createFetchMock(() => new Response("not found", { status: 404 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve mensaje por defecto si no hay chunks relevantes", async () => {
    mockedRetrieveChunks.mockResolvedValue([]);

    const { stream, sources } = await generateAnswer("¿Pregunta?", [], {
      provider: ollamaProvider,
    });

    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["No encuentro información suficiente en el temario."]);
    expect(sources).toEqual([]);
  });

  it("devuelve el mensaje de fallback en inglés cuando se solicita language=en", async () => {
    mockedRetrieveChunks.mockResolvedValue([]);

    const { stream } = await generateAnswer("Question?", [], {
      provider: ollamaProvider,
      language: "en",
    });

    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["I don't find enough information in the syllabus."]);
  });

  it("devuelve el stream y las fuentes cuando hay chunks", async () => {
    const fakeChunks: RetrievedChunk[] = [
      {
        id: "chunk-1",
        content: "París es la capital de Francia.",
        index: 0,
        tokenCount: 10,
        pageNumber: 1,
        documentId: "doc-1",
        documentTitle: "Apuntes",
        subjectId: "subject-1",
        subjectName: "Historia",
        folderId: "folder-1",
        folderName: "Grado",
        similarity: 0.85,
      },
    ];

    mockedRetrieveChunks.mockResolvedValue(fakeChunks);

    const encoder = new TextEncoder();
    vi.stubGlobal(
      "fetch",
      createFetchMock(() => {
        const lines = [
          JSON.stringify({ message: { content: "Francia" } }),
          JSON.stringify({ message: { content: " tiene como capital " } }),
          JSON.stringify({ message: { content: "París." } }),
        ];
        const stream = new ReadableStream({
          start(controller) {
            for (const line of lines) {
              controller.enqueue(encoder.encode(line + "\n"));
            }
            controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      })
    );

    const { stream, sources } = await generateAnswer("¿Capital de Francia?", [], {
      documentId: "doc-1",
      provider: ollamaProvider,
    });

    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("Francia tiene como capital París.");
    expect(sources).toHaveLength(1);
    expect(sources[0].documentTitle).toBe("Apuntes");
    expect(mockedRetrieveChunks).toHaveBeenCalledWith(
      "¿Capital de Francia?",
      expect.objectContaining({ documentId: "doc-1" }),
      expect.any(Object)
    );
  });
});
