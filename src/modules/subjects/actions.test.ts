import { describe, expect, it, beforeEach } from "vitest";
import {
  createSubject,
  deleteSubject,
  getSubject,
  updateSubject,
} from "./actions";
import { createFolder, createDocument } from "@/lib/test/factories";
import { resetDatabase } from "@/lib/test/reset-db";

function unwrap<T>(result: { success: true; data: T } | { success: false }) {
  if (!result.success) {
    throw new Error("Expected successful result");
  }
  return result.data;
}

function subjectFormData(data: { name: string; description?: string }) {
  const formData = new FormData();
  formData.append("name", data.name);
  if (data.description !== undefined) {
    formData.append("description", data.description);
  }
  return formData;
}

describe("subjects actions", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("crea una asignatura dentro de una carpeta", async () => {
    const folder = await createFolder({ name: "Carpeta" });
    const subject = unwrap(
      await createSubject(folder.id, subjectFormData({ name: "Bases de Datos" }))
    );

    expect(subject.name).toBe("Bases de Datos");
    expect(subject.folderId).toBe(folder.id);
  });

  it("obtiene una asignatura con sus documentos", async () => {
    const folder = await createFolder({ name: "Carpeta" });
    const subject = unwrap(await createSubject(folder.id, subjectFormData({ name: "IA" })));
    const found = await getSubject(subject.id);

    expect(found?.id).toBe(subject.id);
    expect(found?.folder.id).toBe(folder.id);
    expect(found?.documents).toEqual([]);
    expect(found?._count.documents).toBe(0);
  });

  it("actualiza una asignatura", async () => {
    const folder = await createFolder({ name: "Carpeta" });
    const subject = unwrap(await createSubject(folder.id, subjectFormData({ name: "Original" })));
    const updated = unwrap(await updateSubject(subject.id, subjectFormData({ name: "Actualizado" })));

    expect(updated.name).toBe("Actualizado");
  });

  it("elimina una asignatura", async () => {
    const folder = await createFolder({ name: "Carpeta" });
    const subject = unwrap(await createSubject(folder.id, subjectFormData({ name: "Borrar" })));
    const result = await deleteSubject(subject.id);

    expect(result.success).toBe(true);

    const found = await getSubject(subject.id);
    expect(found).toBeNull();
  });

  it("cuenta los documentos de una asignatura", async () => {
    const folder = await createFolder({ name: "Carpeta" });
    const subject = unwrap(await createSubject(folder.id, subjectFormData({ name: "IA" })));
    await createDocument({
      title: "Apuntes",
      fileName: "apuntes.txt",
      storageKey: "key-1",
      mimeType: "text/plain",
      subjectId: subject.id,
    });

    const found = await getSubject(subject.id);
    expect(found?._count.documents).toBe(1);
  });

  it("devuelve error de validación si el nombre está vacío", async () => {
    const folder = await createFolder({ name: "Carpeta" });
    const result = await createSubject(folder.id, subjectFormData({ name: "" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.fieldErrors?.name).toContain("El nombre es obligatorio");
    }
  });
});
