"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { action, parseFormData } from "@/lib/action-utils";
import { ActionResult, createUserError } from "@/lib/errors";
import { getLocale } from "@/lib/i18n/locale";
import { enqueueJob, cancelJob } from "@/lib/jobs/runner";
import "@/lib/jobs/registry";
import { generateStorageKey, saveFile, deleteFile } from "./storage";
import {
  uploadDocumentSchema,
  processDocumentSchema,
  updateDocumentTitleSchema,
} from "./schemas";

export async function uploadDocument(
  formData: FormData
): Promise<ActionResult<{ id: string; title: string; mimeType: string; status: string }>> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = parseFormData(uploadDocumentSchema, raw);

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const { subjectId, file } = parsed.data;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const storageKey = generateStorageKey();

    await saveFile(buffer, storageKey);

    const document = await prisma.document.create({
      data: {
        title: file.name.replace(/\.[^/.]+$/, ""),
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        status: "PENDING",
        subjectId,
      },
    });

    const locale = await getLocale();
    await enqueueJob("document", document.id, { payload: { locale } });

    revalidatePath(`/subjects/${subjectId}`);
    return {
      id: document.id,
      title: document.title,
      mimeType: document.mimeType,
      status: document.status,
    };
  });
}

export async function processDocument(
  documentId: string
): Promise<ActionResult<{ id: string; status: string }>> {
  const parsed = parseFormData(processDocumentSchema, { documentId });

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const document = await prisma.document.findUnique({
      where: { id: parsed.data.documentId },
    });

    if (!document) {
      throw createUserError("El documento no existe.");
    }

    if (document.status === "PROCESSING") {
      return { id: document.id, status: document.status };
    }

    if (document.status !== "PENDING" && document.status !== "ERROR") {
      throw createUserError(
        "El documento no puede procesarse en su estado actual."
      );
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING", progress: 0, errorMessage: null },
    });

    const locale = await getLocale();
    await enqueueJob("document", documentId, { payload: { locale } });

    revalidatePath(`/subjects/${document.subjectId}`);
    return { id: document.id, status: "PROCESSING" };
  });
}

export async function cancelDocumentProcessing(
  documentId: string
): Promise<ActionResult<void>> {
  return action(async () => {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, subjectId: true },
    });

    if (!document) {
      throw createUserError("El documento no existe.");
    }

    const job = await prisma.processingJob.findFirst({
      where: {
        entityType: "document",
        entityId: documentId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!job) {
      throw createUserError("No hay procesamiento activo para este documento.");
    }

    await cancelJob(job.id);
    revalidatePath(`/subjects/${document.subjectId}`);
  });
}

export async function updateDocumentTitle(
  id: string,
  title: string
): Promise<ActionResult<{ id: string; title: string }>> {
  const parsed = parseFormData(updateDocumentTitleSchema, { title });

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const document = await prisma.document.update({
      where: { id },
      data: { title: parsed.data.title.trim() },
    });
    revalidatePath(`/subjects/${document.subjectId}`);
    return { id: document.id, title: document.title };
  });
}

export async function deleteDocument(
  id: string
): Promise<ActionResult<{ subjectId: string }>> {
  return action(async () => {
    const document = await prisma.document.delete({
      where: { id },
    });

    try {
      await deleteFile(document.storageKey);
    } catch {
      // Ignorar si el archivo ya no existe
    }

    revalidatePath(`/subjects/${document.subjectId}`);
    return { subjectId: document.subjectId };
  });
}
