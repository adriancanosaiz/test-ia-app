import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "crypto";
import { resetDatabase } from "@/lib/test/reset-db";
import { prismaTest } from "@/lib/test/prisma";
import { waitForQueueIdle } from "@/lib/jobs/runner";
import { createFolder } from "@/lib/test/factories";
import { createSubject } from "@/modules/subjects/actions";
import { saveFile } from "./storage";
import { uploadDocument, processDocument } from "./actions";
import { processDocumentJob } from "./job";

function uploadFormData(subjectId: string, file: File) {
  const formData = new FormData();
  formData.append("subjectId", subjectId);
  formData.append("file", file);
  return formData;
}

function mockOllama() {
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
}

async function seedSubject() {
  const folder = await createFolder({ name: "Carpeta" });
  const subjectForm = new FormData();
  subjectForm.append("name", "Asignatura");
  const result = await createSubject(folder.id, subjectForm);
  if (!result.success) throw new Error("Failed to create subject");
  return { folder, subject: result.data };
}

function unwrap<T>(result: { success: true; data: T } | { success: false }) {
  if (!result.success) {
    throw new Error("Expected successful result");
  }
  return result.data;
}

describe("documents mutations async flow", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("flujo completo: subida → progreso → ready", async () => {
    mockOllama();

    const { subject } = await seedSubject();
    const formData = uploadFormData(
      subject.id,
      new File(
        [
          "Francia es un país de Europa occidental. Su capital es París.\n\nLa gastronomía francesa es famosa.",
        ],
        "francia.txt",
        { type: "text/plain" }
      )
    );

    const document = unwrap(await uploadDocument(formData));
    expect(document.status).toBe("PENDING");

    await waitForQueueIdle();

    const processing = await prismaTest.document.findUnique({
      where: { id: document.id },
    });
    expect(processing?.status).toBe("READY");
    expect(processing?.progress).toBe(100);
    expect(processing?.chunkCount).toBeGreaterThan(0);
  });

  it("processDocument encola el job y el job maneja errores", async () => {
    const { subject } = await seedSubject();
    const storageKey = randomUUID();
    await saveFile(Buffer.from("contenido"), storageKey);

    const document = await prismaTest.document.create({
      data: {
        title: "Documento",
        fileName: "documento.png",
        storageKey,
        mimeType: "image/png",
        status: "PENDING",
        subjectId: subject.id,
      },
    });

    const result = await processDocument(document.id);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("PROCESSING");

    await waitForQueueIdle();

    const updated = await prismaTest.document.findUnique({
      where: { id: document.id },
    });
    expect(updated?.status).toBe("ERROR");
    expect(updated?.errorMessage).toBeTruthy();
  });

  it("reintentar un documento en ERROR lo vuelve a encolar", async () => {
    mockOllama();

    const { subject } = await seedSubject();
    const storageKey = randomUUID();
    await saveFile(
      Buffer.from(
        "Francia es un país de Europa occidental. Su capital es París."
      ),
      storageKey
    );

    const document = await prismaTest.document.create({
      data: {
        title: "Documento",
        fileName: "documento.txt",
        storageKey,
        mimeType: "text/plain",
        status: "ERROR",
        errorMessage: "Error previo",
        subjectId: subject.id,
      },
    });

    const result = await processDocument(document.id);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("PROCESSING");

    await waitForQueueIdle();

    const updated = await prismaTest.document.findUnique({
      where: { id: document.id },
    });
    expect(updated?.status).toBe("READY");
    expect(updated?.errorMessage).toBeNull();
    expect(updated?.chunkCount).toBeGreaterThan(0);
  });

  it("processDocumentJob se ejecuta incluso si el documento ya está PROCESSING", async () => {
    mockOllama();

    const { subject } = await seedSubject();
    const storageKey = randomUUID();
    await saveFile(
      Buffer.from(
        "Francia es un país de Europa occidental. Su capital es París."
      ),
      storageKey
    );

    const document = await prismaTest.document.create({
      data: {
        title: "Documento",
        fileName: "documento.txt",
        storageKey,
        mimeType: "text/plain",
        status: "PROCESSING",
        progress: 10,
        subjectId: subject.id,
      },
    });

    await processDocumentJob(document.id);
    await waitForQueueIdle();

    const updated = await prismaTest.document.findUnique({
      where: { id: document.id },
    });
    expect(updated?.status).toBe("READY");
    expect(updated?.progress).toBe(100);
  });
});
