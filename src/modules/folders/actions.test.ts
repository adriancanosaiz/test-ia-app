import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  createFolder,
  deleteFolder,
  getFolder,
  getFolders,
  updateFolder,
} from "./actions";
import { resetDatabase } from "@/lib/test/reset-db";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function unwrap<T>(result: { success: true; data: T } | { success: false }) {
  if (!result.success) {
    throw new Error("Expected successful result");
  }
  return result.data;
}

function folderFormData(data: { name: string; description?: string; color?: string }) {
  const formData = new FormData();
  formData.append("name", data.name);
  if (data.description !== undefined) {
    formData.append("description", data.description);
  }
  if (data.color !== undefined) {
    formData.append("color", data.color);
  }
  return formData;
}

describe("folders actions", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("crea y lista carpetas", async () => {
    const created = unwrap(
      await createFolder(folderFormData({
        name: "Grado en Informática",
        description: "Temario",
      }))
    );

    expect(created.name).toBe("Grado en Informática");

    const folders = await getFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0]._count.documents).toBe(0);
  });

  it("obtiene una carpeta con sus asignaturas", async () => {
    const folder = unwrap(await createFolder(folderFormData({ name: "Carpeta" })));
    const found = await getFolder(folder.id);

    expect(found?.id).toBe(folder.id);
    expect(found?.subjects).toEqual([]);
  });

  it("actualiza una carpeta", async () => {
    const folder = unwrap(await createFolder(folderFormData({ name: "Original" })));
    const updated = unwrap(
      await updateFolder(folder.id, folderFormData({ name: "Actualizado" }))
    );

    expect(updated.name).toBe("Actualizado");
  });

  it("elimina una carpeta", async () => {
    const folder = unwrap(await createFolder(folderFormData({ name: "Borrar" })));
    const result = await deleteFolder(folder.id);

    expect(result.success).toBe(true);

    const folders = await getFolders();
    expect(folders).toHaveLength(0);
  });

  it("devuelve errores de validación cuando el nombre está vacío", async () => {
    const result = await createFolder(folderFormData({ name: "" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.fieldErrors?.name).toContain("El nombre es obligatorio");
    }
  });

  it("devuelve un error de usuario al intentar actualizar una carpeta inexistente", async () => {
    const result = await updateFolder("non-existent-id", folderFormData({ name: "Nuevo" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.error.message).toBe("El recurso solicitado no existe.");
    }
  });

  it("crea una carpeta con color", async () => {
    const created = unwrap(
      await createFolder(folderFormData({ name: "Carpeta roja", color: "#ef4444" }))
    );

    expect(created.color).toBe("#ef4444");
  });

  it("actualiza el color de una carpeta", async () => {
    const folder = unwrap(await createFolder(folderFormData({ name: "Original" })));
    const updated = unwrap(
      await updateFolder(folder.id, folderFormData({ name: "Actualizado", color: "#3b82f6" }))
    );

    expect(updated.color).toBe("#3b82f6");
  });

  it("cuenta los documentos de todas las asignaturas de una carpeta", async () => {
    const folder = unwrap(await createFolder(folderFormData({ name: "Con documentos" })));
    const subject = await prisma.subject.create({
      data: { name: "Asignatura", folderId: folder.id },
    });
    await prisma.document.create({
      data: {
        title: "Apuntes",
        fileName: "apuntes.txt",
        storageKey: "key-1",
        mimeType: "text/plain",
        subjectId: subject.id,
      },
    });

    const folders = await getFolders();
    const found = folders.find((f) => f.id === folder.id);
    expect(found?._count.documents).toBe(1);
  });

  it("clasifica errores de base de datos como errores de sistema", async () => {
    const spy = vi
      .spyOn(prisma.folder, "create")
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Database connection failed", {
          code: "P1001",
          clientVersion: "x",
        })
      );

    const result = await createFolder(folderFormData({ name: "Carpeta" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("SYSTEM_ERROR");
      expect(result.error.message).toBe(
        "Ha ocurrido un error inesperado. Inténtalo de nuevo."
      );
    }

    spy.mockRestore();
  });
});
