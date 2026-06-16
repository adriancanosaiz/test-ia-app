"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { action, parseFormData } from "@/lib/action-utils";
import { ActionResult, createUserError } from "@/lib/errors";
import { subjectSchema } from "./schemas";

export async function createSubject(
  folderId: string,
  formData: FormData
): Promise<ActionResult<{ id: string; name: string; description: string | null; folderId: string }>> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = parseFormData(subjectSchema, raw);

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const subject = await prisma.subject.create({
      data: {
        ...parsed.data,
        folderId,
      },
    });
    revalidatePath(`/folders/${folderId}`);
    return subject;
  });
}

export async function updateSubject(
  id: string,
  formData: FormData
): Promise<ActionResult<{ id: string; name: string; description: string | null; folderId: string }>> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = parseFormData(subjectSchema, raw);

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const subject = await prisma.subject.update({
      where: { id },
      data: parsed.data,
    });
    revalidatePath(`/folders/${subject.folderId}`);
    revalidatePath(`/subjects/${id}`);
    return subject;
  });
}

export async function deleteSubject(id: string): Promise<ActionResult<{ folderId: string }>> {
  return action(async () => {
    const subject = await prisma.subject.delete({
      where: { id },
    });
    revalidatePath(`/folders/${subject.folderId}`);
    return { folderId: subject.folderId };
  });
}
