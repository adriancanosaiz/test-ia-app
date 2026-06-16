import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { createFolder } from "@/lib/test/factories";
import { createSubject } from "@/modules/subjects/actions";
import {
  deleteDocument,
  getDocument,
  processDocument,
  uploadDocument,
} from "./actions";
import { resetDatabase } from "@/lib/test/reset-db";
import { prismaTest } from "@/lib/test/prisma";

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

async function seedSubject() {
  const folder = await createFolder({ name: "Carpeta" });
  const subjectForm = new FormData();
  subjectForm.append("name", "Asignatura");
  const subject = unwrap(await createSubject(folder.id, subjectForm));
  return { folder, subject };
}

function uploadFormData(subjectId: string, file: File) {
  const formData = new FormData();
  formData.append("subjectId", subjectId);
  formData.append("file", file);
  return formData;
}

describe("documents actions", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockEnqueueJob.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sube un documento de texto", async () => {
    const { subject } = await seedSubject();
    const formData = uploadFormData(
      subject.id,
      new File(["contenido de prueba"], "notas.txt", { type: "text/plain" })
    );

    const document = unwrap(await uploadDocument(formData));

    expect(document.title).toBe("notas");
    expect(document.mimeType).toBe("text/plain");
    expect(document.status).toBe("PENDING");
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "document",
      document.id,
      expect.objectContaining({ payload: { locale: "es" } })
    );
  });

  it("devuelve error de validación si faltan datos", async () => {
    const formData = new FormData();
    const result = await uploadDocument(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.fieldErrors?.subjectId).toBeDefined();
      expect(result.fieldErrors?.file).toBeDefined();
    }
  });

  it("devuelve error de usuario si el tipo de archivo no está soportado", async () => {
    const { subject } = await seedSubject();
    const formData = uploadFormData(
      subject.id,
      new File(["x"], "image.png", { type: "image/png" })
    );

    const result = await uploadDocument(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.fieldErrors?.file).toBeDefined();
    }
  });

  it("procesa un documento de texto y genera chunks", async () => {
    const { subject } = await seedSubject();
    const formData = uploadFormData(
      subject.id,
      new File(
        ["Francia es un país de Europa occidental. Su capital es París.\n\nLa gastronomía francesa es famosa."],
        "francia.txt",
        { type: "text/plain" }
      )
    );

    const document = unwrap(await uploadDocument(formData));

    const result = await processDocument(document.id);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("PROCESSING");
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "document",
      document.id,
      expect.objectContaining({ payload: { locale: "es" } })
    );

    const updated = await getDocument(document.id);
    expect(updated?.status).toBe("PROCESSING");
  });

  it("devuelve error si el documento no existe", async () => {
    const result = await processDocument("non-existent-id");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
    }
  });

  it("elimina un documento y su archivo", async () => {
    const { subject } = await seedSubject();
    const formData = uploadFormData(
      subject.id,
      new File(["x"], "borrar.txt", { type: "text/plain" })
    );

    const document = unwrap(await uploadDocument(formData));
    const result = await deleteDocument(document.id);

    expect(result.success).toBe(true);

    const found = await prismaTest.document.findUnique({
      where: { id: document.id },
    });
    expect(found).toBeNull();
  });
});
