import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { prismaTest } from "@/lib/test/prisma";
import { resetDatabase } from "@/lib/test/reset-db";
import { createFolder, createSubject, createDocument, createChunk } from "@/lib/test/factories";
import { generateSummaryJob } from "./job";

async function seedDocument(status: "PENDING" | "PROCESSING" | "READY" | "ERROR") {
  const folder = await createFolder({ name: "Carpeta" });
  const subject = await createSubject({ name: "Asignatura", folderId: folder.id });
  const document = await createDocument({
    title: "Documento",
    fileName: "doc.txt",
    storageKey: "key",
    mimeType: "text/plain",
    subjectId: subject.id,
    status,
  });
  return { folder, subject, document };
}

describe("generateSummaryJob", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createOllamaFetchMock(chatContent: string) {
    return vi.fn(async (url: string) => {
      if (url.includes("/api/tags")) {
        return Response.json({
          models: [{ name: "llama3.2:3b" }, { name: "nomic-embed-text" }],
        });
      }
      return Response.json({ message: { content: chatContent } });
    });
  }

  it("genera un resumen READY cuando el documento está listo", async () => {
    vi.stubGlobal("fetch", createOllamaFetchMock("Resumen generado por IA."));

    const { document } = await seedDocument("READY");
    await createChunk({ documentId: document.id, content: "Francia es un país. Su capital es París.", index: 0 });
    await createChunk({ documentId: document.id, content: "La gastronomía francesa es famosa.", index: 1 });

    const summary = await prismaTest.documentSummary.create({
      data: {
        documentId: document.id,
        content: "",
        status: "PROCESSING",
        progress: 0,
      },
    });

    await generateSummaryJob(summary.id);

    const updated = await prismaTest.documentSummary.findUnique({
      where: { id: summary.id },
    });

    expect(updated?.status).toBe("READY");
    expect(updated?.progress).toBe(100);
    expect(updated?.content).toBe("Resumen generado por IA.");
    expect(updated?.errorMessage).toBeNull();
  });

  it("marca ERROR si el documento no está READY", async () => {
    const { document } = await seedDocument("PENDING");

    const summary = await prismaTest.documentSummary.create({
      data: {
        documentId: document.id,
        content: "",
        status: "PROCESSING",
        progress: 0,
      },
    });

    await generateSummaryJob(summary.id);

    const updated = await prismaTest.documentSummary.findUnique({
      where: { id: summary.id },
    });

    expect(updated?.status).toBe("ERROR");
    expect(updated?.errorMessage).toBe("El documento no está listo para resumir");
  });

  it("guarda ERROR si falla la llamada a Ollama", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("error", { status: 500 }))
    );

    const { document } = await seedDocument("READY");
    await createChunk({ documentId: document.id, content: "Texto.", index: 0 });

    const summary = await prismaTest.documentSummary.create({
      data: {
        documentId: document.id,
        content: "",
        status: "PROCESSING",
        progress: 0,
      },
    });

    await generateSummaryJob(summary.id);

    const updated = await prismaTest.documentSummary.findUnique({
      where: { id: summary.id },
    });

    expect(updated?.status).toBe("ERROR");
    expect(updated?.errorMessage).toBeTruthy();
  });

  it("usa el locale del payload para el prompt", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/api/tags")) {
        return Response.json({
          models: [{ name: "llama3.2:3b" }, { name: "nomic-embed-text" }],
        });
      }
      return Response.json({ message: { content: "Summary." } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { document } = await seedDocument("READY");
    await createChunk({ documentId: document.id, content: "Text.", index: 0 });

    const summary = await prismaTest.documentSummary.create({
      data: {
        documentId: document.id,
        content: "",
        status: "PROCESSING",
        progress: 0,
      },
    });

    await generateSummaryJob(summary.id, { payload: { locale: "en" } });

    const calls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/api/chat")
    ) as unknown as [string, RequestInit | undefined][];
    expect(calls.length).toBeGreaterThan(0);
    const body = String(calls[0][1]?.body);
    expect(body).toContain("English");
  });

  it("limita el contexto enviado a Ollama", async () => {
    const fetchMock = createOllamaFetchMock("Resumen corto.");
    vi.stubGlobal("fetch", fetchMock);

    const { document } = await seedDocument("READY");
    // Más de 6000 tokens estimados para forzar truncamiento.
    await createChunk({
      documentId: document.id,
      content: "a".repeat(30000),
      index: 0,
    });
    await createChunk({
      documentId: document.id,
      content: "Texto relevante.",
      index: 1,
    });

    const summary = await prismaTest.documentSummary.create({
      data: {
        documentId: document.id,
        content: "",
        status: "PROCESSING",
        progress: 0,
      },
    });

    await generateSummaryJob(summary.id);

    const calls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/api/chat")
    ) as unknown as [string, RequestInit | undefined][];
    expect(calls.length).toBeGreaterThan(0);
    const body = String(calls[0][1]?.body);
    // El contexto debe estar truncado.
    expect(body.length).toBeLessThan(30000);
    expect(body).not.toContain("a".repeat(30000));
    expect(body).not.toContain("Texto relevante.");
  });
});
