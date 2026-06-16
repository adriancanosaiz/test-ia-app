"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { action, parseFormData } from "@/lib/action-utils";
import { ActionResult, createUserError } from "@/lib/errors";
import { folderSchema } from "./schemas";

export async function createFolder(
  formData: FormData
): Promise<ActionResult<{ id: string; name: string; description: string | null; color: string | null }>> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = parseFormData(folderSchema, raw);

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const folder = await prisma.folder.create({
      data: parsed.data,
    });

    revalidatePath("/dashboard");
    revalidatePath("/folders");

    return folder;
  });
}

export async function updateFolder(
  id: string,
  formData: FormData
): Promise<ActionResult<{ id: string; name: string; description: string | null; color: string | null }>> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = parseFormData(folderSchema, raw);

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const folder = await prisma.folder.update({
      where: { id },
      data: parsed.data,
    });

    revalidatePath("/dashboard");
    revalidatePath("/folders");
    revalidatePath(`/folders/${id}`);

    return folder;
  });
}

export async function deleteFolder(id: string): Promise<ActionResult<void>> {
  return action(async () => {
    await prisma.folder.delete({
      where: { id },
    });

    revalidatePath("/dashboard");
    revalidatePath("/folders");
  });
}
