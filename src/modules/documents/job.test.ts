import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "crypto";
import { prismaTest } from "@/lib/test/prisma";
import { resetDatabase } from "@/lib/test/reset-db";
import { saveFile } from "./storage";
import { processDocumentJob } from "./job";

async function seedDocument(
  status: "PENDING" | "PROCESSING" | "READY" | "ERROR",
  content: string,
  mimeType: string
) {
  const folder = await prismaTest.folder.create({ data: { name: "Carpeta" } });
  const subject = await prismaTest.subject.create({
    data: { name: "Asignatura", folderId: folder.id },
  });
  const storageKey = randomUUID();
  await saveFile(Buffer.from(content), storageKey);

  const document = await prismaTest.document.create({
    data: {
      title: "Documento",
      fileName: "documento.txt",
      storageKey,
      mimeType,
      status,
      subjectId: subject.id,
    },
  });

  return document;
}

describe("processDocumentJob", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("procesa un documento PENDING hasta READY con progreso 100", async () => {
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
        if (url.includes("/api/embeddings")) {
          return Response.json({
            embedding: Array.from({ length: 768 }, () => 0.1),
          });
        }
        return new Response("not found", { status: 404 });
      })
    );

    const document = await seedDocument(
      "PENDING",
      "Francia es un país de Europa occidental. Su capital es París.\n\nLa gastronomía francesa es famosa.",
      "text/plain"
    );

    await processDocumentJob(document.id);

    const updated = await prismaTest.document.findUnique({
      where: { id: document.id },
    });

    expect(updated?.status).toBe("READY");
    expect(updated?.progress).toBe(100);
    expect(updated?.chunkCount).toBeGreaterThan(0);
    expect(updated?.errorMessage).toBeNull();

    const chunks = await prismaTest.chunk.findMany({
      where: { documentId: document.id },
    });
    expect(chunks.length).toBe(updated?.chunkCount);
  });

  it("no procesa documentos que no estén PENDING ni ERROR", async () => {
    const document = await seedDocument(
      "READY",
      "Contenido ya indexado.",
      "text/plain"
    );

    await processDocumentJob(document.id);

    const updated = await prismaTest.document.findUnique({
      where: { id: document.id },
    });

    expect(updated?.status).toBe("READY");
    expect(updated?.progress).toBe(0);
  });

  it("guarda ERROR y mensaje si falla el procesamiento", async () => {
    const document = await seedDocument(
      "PENDING",
      "contenido",
      "image/png"
    );

    await processDocumentJob(document.id);

    const updated = await prismaTest.document.findUnique({
      where: { id: document.id },
    });

    expect(updated?.status).toBe("ERROR");
    expect(updated?.errorMessage).toBeTruthy();
    expect(updated?.progress).toBe(0);
  });
});
