import { describe, expect, it, beforeEach, vi } from "vitest";
import { generateChatResponseJob } from "./job";
import { createChatSession } from "@/lib/test/factories";
import { resetDatabase } from "@/lib/test/reset-db";
import { prismaTest } from "@/lib/test/prisma";
import type { RetrievedChunk } from "@/modules/ai/retrieval";

vi.mock("@/modules/ai/rag", () => ({
  generateAnswer: vi.fn(),
}));

import { generateAnswer } from "@/modules/ai/rag";

const mockedGenerateAnswer = vi.mocked(generateAnswer);

async function getLatestMessage(sessionId: string) {
  return prismaTest.chatMessage.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });
}

describe("generateChatResponseJob", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockedGenerateAnswer.mockReset();
  });

  it("no hace nada si no hay mensajes de usuario", async () => {
    const session = await createChatSession({ title: "Vacía" });

    await generateChatResponseJob(session.id);

    const messages = await prismaTest.chatMessage.findMany({
      where: { sessionId: session.id },
    });
    expect(messages).toHaveLength(0);
  });

  it("crea un mensaje del asistente, actualiza el contenido y finaliza en READY", async () => {
    const session = await createChatSession({ title: "Sesión" });
    await prismaTest.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: "¿Pregunta?",
      },
    });

    const fakeSources: RetrievedChunk[] = [
      {
        id: "chunk-1",
        content: "Contexto",
        index: 0,
        tokenCount: 10,
        pageNumber: 1,
        documentId: "doc-1",
        documentTitle: "Apuntes",
        subjectId: "subject-1",
        subjectName: "Asignatura",
        folderId: "folder-1",
        folderName: "Grado",
        similarity: 0.9,
      },
    ];

    mockedGenerateAnswer.mockResolvedValue({
      stream: (async function* () {
        yield "Respuesta";
        yield " completa.";
      })(),
      sources: fakeSources,
    });

    const before = new Date();
    await generateChatResponseJob(session.id);

    const assistantMessage = await getLatestMessage(session.id);
    expect(assistantMessage).not.toBeNull();
    expect(assistantMessage?.role).toBe("assistant");
    expect(assistantMessage?.status).toBe("READY");
    expect(assistantMessage?.content).toBe("Respuesta completa.");
    expect(assistantMessage?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: "doc-1",
          documentTitle: "Apuntes",
          similarity: 0.9,
          pageNumber: 1,
        }),
      ])
    );

    const updatedSession = await prismaTest.chatSession.findUnique({
      where: { id: session.id },
    });
    expect(updatedSession?.updatedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime()
    );
  });

  it("actualiza un mensaje del asistente ya existente en PROCESSING", async () => {
    const session = await createChatSession({ title: "Sesión" });
    await prismaTest.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: "¿Pregunta?",
      },
    });
    const existingAssistant = await prismaTest.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: "",
        status: "PROCESSING",
      },
    });

    mockedGenerateAnswer.mockResolvedValue({
      stream: (async function* () {
        yield "Hola";
      })(),
      sources: [],
    });

    await generateChatResponseJob(session.id, existingAssistant.id);

    const messages = await prismaTest.chatMessage.findMany({
      where: { sessionId: session.id, role: "assistant" },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(existingAssistant.id);
    expect(messages[0].content).toBe("Hola");
    expect(messages[0].status).toBe("READY");
  });

  it("marca el mensaje como ERROR si falla la generación", async () => {
    const session = await createChatSession({ title: "Sesión" });
    await prismaTest.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: "¿Pregunta?",
      },
    });

    mockedGenerateAnswer.mockRejectedValue(new Error("Ollama no disponible"));

    await generateChatResponseJob(session.id);

    const assistantMessage = await getLatestMessage(session.id);
    expect(assistantMessage?.role).toBe("assistant");
    expect(assistantMessage?.status).toBe("ERROR");
    expect(assistantMessage?.content).toContain("Ollama no disponible");
  });

  it("pasa el locale del payload a generateAnswer", async () => {
    const session = await createChatSession({ title: "Sesión" });
    await prismaTest.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: "Question?",
      },
    });

    mockedGenerateAnswer.mockResolvedValue({
      stream: (async function* () {
        yield "Answer";
      })(),
      sources: [],
    });

    await generateChatResponseJob(session.id, undefined, {
      payload: { sessionId: session.id, locale: "en" },
    });

    expect(mockedGenerateAnswer).toHaveBeenCalledWith(
      "Question?",
      [],
      expect.objectContaining({ language: "en" })
    );
  });

  it("no sobrescribe un mensaje que ha sido cancelado", async () => {
    const session = await createChatSession({ title: "Sesión" });
    await prismaTest.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: "¿Pregunta?",
      },
    });
    const assistantMessage = await prismaTest.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: "",
        status: "PROCESSING",
      },
    });

    mockedGenerateAnswer.mockResolvedValue({
      stream: (async function* () {
        yield "Parcial";
      })(),
      sources: [],
    });

    await prismaTest.chatMessage.update({
      where: { id: assistantMessage.id },
      data: {
        content: "Generación cancelada por el usuario.",
        status: "ERROR",
      },
    });

    await generateChatResponseJob(session.id, assistantMessage.id);

    const latest = await prismaTest.chatMessage.findUnique({
      where: { id: assistantMessage.id },
    });
    expect(latest?.status).toBe("ERROR");
    expect(latest?.content).toBe("Generación cancelada por el usuario.");
  });
});
