"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { action, parseFormData } from "@/lib/action-utils";
import { ActionResult, createUserError } from "@/lib/errors";
import { getLocale } from "@/lib/i18n/locale";
import { enqueueJob, cancelJob } from "@/lib/jobs/runner";
import "@/lib/jobs/registry";
import {
  createSessionSchema,
  addUserMessageSchema,
  messageActionSchema,
} from "./schemas";
import { CreateSessionData } from "./types";

export async function createChatSession(
  data: CreateSessionData
): Promise<ActionResult<{ id: string; title: string | null; sourceDocumentId: string | null }>> {
  const parsed = parseFormData(createSessionSchema, data);

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const session = await prisma.chatSession.create({
      data: {
        title: parsed.data.title,
        sourceDocumentId: parsed.data.sourceDocumentId || null,
      },
    });
    revalidatePath("/chat");
    return session;
  });
}

export async function deleteChatSession(
  id: string
): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    const session = await prisma.chatSession.delete({
      where: { id },
    });
    revalidatePath("/chat");
    return { id: session.id };
  });
}

export async function addUserMessage(
  sessionId: string | null,
  question: string,
  sourceDocumentId?: string
): Promise<ActionResult<{ sessionId: string; sourceDocumentId: string | null }>> {
  const parsed = parseFormData(addUserMessageSchema, {
    sessionId,
    question,
    sourceDocumentId,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    let session;

    if (parsed.data.sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: parsed.data.sessionId },
      });
    }

    if (!session) {
      session = await prisma.chatSession.create({
        data: {
          title: parsed.data.question.slice(0, 60) || "Nueva conversación",
          sourceDocumentId: parsed.data.sourceDocumentId || null,
        },
      });
    }

    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: parsed.data.question,
      },
    });

    await prisma.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    revalidatePath(`/chat/${session.id}`);
    return { sessionId: session.id, sourceDocumentId: session.sourceDocumentId };
  });
}

export async function addAssistantMessage(
  sessionId: string,
  content: string,
  sources?: unknown
) {
  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "assistant",
      content,
      sources: sources ?? undefined,
    },
  });

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  revalidatePath(`/chat/${sessionId}`);
}

export async function startChatResponse(
  sessionId: string
): Promise<ActionResult<{ assistantMessageId: string }>> {
  return action(async () => {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      throw createUserError("La sesión de chat no existe.");
    }

    const lastMessage = session.messages[session.messages.length - 1];

    if (!lastMessage || lastMessage.role !== "user") {
      throw createUserError("No hay un mensaje de usuario para responder.");
    }

    const alreadyProcessing = session.messages.some(
      (message) =>
        message.role === "assistant" && message.status === "PROCESSING"
    );

    if (alreadyProcessing) {
      throw createUserError("Ya se está generando una respuesta.");
    }

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: "",
        status: "PROCESSING",
      },
    });

    const locale = await getLocale();
    await enqueueJob("chat", assistantMessage.id, {
      payload: { sessionId, locale },
    });

    return { assistantMessageId: assistantMessage.id };
  });
}

export async function cancelChatResponse(
  sessionId: string,
  assistantMessageId: string
): Promise<ActionResult<void>> {
  const parsed = parseFormData(messageActionSchema, { sessionId, assistantMessageId });

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const message = await prisma.chatMessage.findUnique({
      where: { id: parsed.data.assistantMessageId },
    });

    if (
      !message ||
      message.sessionId !== parsed.data.sessionId ||
      message.role !== "assistant"
    ) {
      throw createUserError("El mensaje no existe.");
    }

    if (message.status !== "PROCESSING") {
      throw createUserError("No hay una generación en curso para este mensaje.");
    }

    const job = await prisma.processingJob.findFirst({
      where: {
        entityType: "chat",
        entityId: assistantMessageId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (job) {
      await cancelJob(job.id);
    }

    await prisma.chatMessage.update({
      where: { id: message.id },
      data: {
        content: "Generación cancelada por el usuario.",
        status: "ERROR",
      },
    });

    revalidatePath(`/chat/${parsed.data.sessionId}`);
  });
}

export async function regenerateChatResponse(
  sessionId: string,
  assistantMessageId: string
): Promise<ActionResult<void>> {
  const parsed = parseFormData(messageActionSchema, { sessionId, assistantMessageId });

  if (!parsed.success) {
    return {
      success: false,
      error: createUserError("Revisa los campos del formulario."),
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const message = await prisma.chatMessage.findUnique({
      where: { id: parsed.data.assistantMessageId },
    });

    if (
      !message ||
      message.sessionId !== parsed.data.sessionId ||
      message.role !== "assistant"
    ) {
      throw createUserError("El mensaje no existe.");
    }

    await prisma.chatMessage.update({
      where: { id: message.id },
      data: {
        content: "",
        status: "PROCESSING",
        sources: Prisma.JsonNull,
      },
    });

    revalidatePath(`/chat/${parsed.data.sessionId}`);

    const locale = await getLocale();
    await enqueueJob("chat", parsed.data.assistantMessageId, {
      payload: { sessionId: parsed.data.sessionId, locale },
    });
  });
}
