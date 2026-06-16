"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { action, parseFormData } from "@/lib/action-utils";
import { ActionResult, createUserError } from "@/lib/errors";
import { getLocale } from "@/lib/i18n/locale";
import { enqueueJob, cancelJob } from "@/lib/jobs/runner";
import "@/lib/jobs/registry";
import { z } from "zod";

const generateSummarySchema = z.object({
  documentId: z.string().min(1, "El documento es obligatorio"),
});

export async function generateSummary(
  documentId: string
): Promise<ActionResult<{ summaryId: string }>> {
  const parsed = parseFormData(generateSummarySchema, { documentId });

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
      select: { id: true, status: true, subjectId: true },
    });

    if (!document) {
      throw createUserError("El documento no existe.");
    }

    if (document.status !== "READY") {
      throw createUserError("El documento no está listo para resumir.");
    }

    const summary = await prisma.documentSummary.create({
      data: {
        documentId: parsed.data.documentId,
        content: "",
        status: "PROCESSING",
        progress: 0,
      },
    });

    const locale = await getLocale();
    await enqueueJob("summary", summary.id, { payload: { locale } });

    revalidatePath(`/documents/${parsed.data.documentId}/summaries`);
    revalidatePath(`/subjects/${document.subjectId}`);

    return { summaryId: summary.id };
  });
}

export async function cancelSummaryGeneration(
  summaryId: string
): Promise<ActionResult<void>> {
  return action(async () => {
    const summary = await prisma.documentSummary.findUnique({
      where: { id: summaryId },
      select: { id: true, documentId: true },
    });

    if (!summary) {
      throw createUserError("El resumen no existe.");
    }

    const job = await prisma.processingJob.findFirst({
      where: {
        entityType: "summary",
        entityId: summaryId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!job) {
      throw createUserError("No hay generación activa para este resumen.");
    }

    await cancelJob(job.id);
    revalidatePath(`/documents/${summary.documentId}/summaries`);
  });
}

export async function retrySummary(
  id: string
): Promise<ActionResult<{ summaryId: string }>> {
  return action(async () => {
    const summary = await prisma.documentSummary.findUnique({
      where: { id },
      include: {
        document: { select: { id: true, status: true, subjectId: true } },
      },
    });

    if (!summary) {
      throw createUserError("El resumen no existe.");
    }

    if (summary.document.status !== "READY") {
      throw createUserError("El documento no está listo para resumir.");
    }

    await prisma.documentSummary.update({
      where: { id },
      data: {
        status: "PROCESSING",
        progress: 0,
        errorMessage: null,
      },
    });

    const locale = await getLocale();
    await enqueueJob("summary", summary.id, { payload: { locale } });

    revalidatePath(`/documents/${summary.document.id}/summaries`);
    revalidatePath(
      `/documents/${summary.document.id}/summaries/${summary.id}`
    );
    revalidatePath(`/subjects/${summary.document.subjectId}`);

    return { summaryId: summary.id };
  });
}

export async function deleteSummary(
  id: string
): Promise<ActionResult<{ documentId: string; subjectId: string }>> {
  return action(async () => {
    const summary = await prisma.documentSummary.delete({
      where: { id },
      include: {
        document: { select: { id: true, subjectId: true } },
      },
    });

    revalidatePath(`/documents/${summary.document.id}/summaries`);
    revalidatePath(`/subjects/${summary.document.subjectId}`);

    return {
      documentId: summary.document.id,
      subjectId: summary.document.subjectId,
    };
  });
}
