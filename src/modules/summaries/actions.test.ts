import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { prismaTest } from "@/lib/test/prisma";
import { resetDatabase } from "@/lib/test/reset-db";
import { createFolder, createSubject, createDocument } from "@/lib/test/factories";
import {
  generateSummary,
  retrySummary,
  getSummariesByDocument,
  getSummary,
  deleteSummary,
} from "./actions";

vi.mock("@/lib/jobs/runner", () => ({
  enqueueJob: vi.fn(),
  cancelJob: vi.fn(),
  registerJobRunner: vi.fn(),
}));

import { enqueueJob } from "@/lib/jobs/runner";

const mockEnqueueJob = vi.mocked(enqueueJob);

function unwrap<T>(result: { success: true; data: T } | { success: false }) {
  if (!result.success) {
    throw new Error("Expected successful result");
  }
  return result.data;
}

async function seedDocument(status: "PENDING" | "PROCESSING" | "READY" | "ERROR" = "READY") {
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

describe("summaries actions", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockEnqueueJob.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("genera un resumen y encola el job", async () => {
    const { document } = await seedDocument("READY");

    const result = await generateSummary(document.id);

    expect(result.success).toBe(true);
    const { summaryId } = unwrap(result);
    expect(summaryId).toBeTruthy();

    const summary = await prismaTest.documentSummary.findUnique({
      where: { id: summaryId },
    });
    expect(summary).not.toBeNull();
    expect(summary?.status).toBe("PROCESSING");
    expect(summary?.progress).toBe(0);
    expect(summary?.documentId).toBe(document.id);
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "summary",
      summaryId,
      expect.objectContaining({ payload: { locale: "es" } })
    );
  });

  it("devuelve error si el documento no existe", async () => {
    const result = await generateSummary("non-existent-id");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
    }
  });

  it("devuelve error si el documento no está listo", async () => {
    const { document } = await seedDocument("PROCESSING");

    const result = await generateSummary(document.id);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
    }
  });

  it("reintenta un resumen en error", async () => {
    const { document } = await seedDocument("READY");
    const summary = await prismaTest.documentSummary.create({
      data: {
        documentId: document.id,
        content: "",
        status: "ERROR",
        progress: 0,
        errorMessage: "Error previo",
      },
    });

    const result = await retrySummary(summary.id);

    expect(result.success).toBe(true);

    const updated = await prismaTest.documentSummary.findUnique({
      where: { id: summary.id },
    });

    expect(updated?.status).toBe("PROCESSING");
    expect(updated?.progress).toBe(0);
    expect(updated?.errorMessage).toBeNull();
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "summary",
      summary.id,
      expect.objectContaining({ payload: { locale: "es" } })
    );
  });

  it("devuelve error si el resumen a reintentar no existe", async () => {
    const result = await retrySummary("non-existent-id");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
    }
  });

  it("devuelve error al reintentar si el documento no está listo", async () => {
    const { document } = await seedDocument("PENDING");
    const summary = await prismaTest.documentSummary.create({
      data: {
        documentId: document.id,
        content: "",
        status: "ERROR",
        progress: 0,
        errorMessage: "Error previo",
      },
    });

    const result = await retrySummary(summary.id);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
    }
  });

  it("lista los resúmenes ordenados por fecha", async () => {
    const { document } = await seedDocument("READY");
    const summary1 = await prismaTest.documentSummary.create({
      data: {
        documentId: document.id,
        content: "Resumen 1",
        status: "READY",
        progress: 100,
      },
    });
    // Pequeña pausa para asegurar orden cronológico distinto
    await new Promise((resolve) => setTimeout(resolve, 10));
    const summary2 = await prismaTest.documentSummary.create({
      data: {
        documentId: document.id,
        content: "Resumen 2",
        status: "READY",
        progress: 100,
      },
    });

    const summaries = await getSummariesByDocument(document.id);

    expect(summaries).toHaveLength(2);
    expect(summaries[0].id).toBe(summary2.id);
    expect(summaries[1].id).toBe(summary1.id);
  });

  it("obtiene un resumen por ID", async () => {
    const { document } = await seedDocument("READY");
    const summary = await prismaTest.documentSummary.create({
      data: {
        documentId: document.id,
        content: "Contenido",
        status: "READY",
        progress: 100,
      },
    });

    const found = await getSummary(summary.id);

    expect(found?.id).toBe(summary.id);
    expect(found?.document.id).toBe(document.id);
  });

  it("elimina un resumen", async () => {
    const { document, subject } = await seedDocument("READY");
    const summary = await prismaTest.documentSummary.create({
      data: {
        documentId: document.id,
        content: "Contenido",
        status: "READY",
        progress: 100,
      },
    });

    const result = await deleteSummary(summary.id);

    expect(result.success).toBe(true);
    const data = unwrap(result);
    expect(data.documentId).toBe(document.id);
    expect(data.subjectId).toBe(subject.id);

    const found = await prismaTest.documentSummary.findUnique({
      where: { id: summary.id },
    });
    expect(found).toBeNull();
  });
});
