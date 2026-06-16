import { describe, expect, it, beforeEach } from "vitest";
import {
  addAssistantMessage,
  addUserMessage,
  cancelChatResponse,
  createChatSession,
  deleteChatSession,
  getChatSession,
  getChatSessions,
  regenerateChatResponse,
  startChatResponse,
} from "./actions";
import { createFolder, createSubject } from "@/lib/test/factories";
import { uploadDocument } from "@/modules/documents/actions";
import { resetDatabase } from "@/lib/test/reset-db";
import { prismaTest } from "@/lib/test/prisma";

vi.mock("@/lib/jobs/runner", () => ({
  enqueueJob: vi.fn(),
  cancelJob: vi.fn(),
  registerJobRunner: vi.fn(),
}));

import { enqueueJob } from "@/lib/jobs/runner";
const mockedEnqueueJob = vi.mocked(enqueueJob);

function unwrap<T>(result: { success: true; data: T } | { success: false }) {
  if (!result.success) {
    throw new Error("Expected successful result");
  }
  return result.data;
}

async function seedDocument() {
  const folder = await createFolder({ name: "Carpeta" });
  const subject = await createSubject({ name: "Asignatura", folderId: folder.id });
  const formData = new FormData();
  formData.append("subjectId", subject.id);
  formData.append(
    "file",
    new File(["contenido"], "doc.txt", { type: "text/plain" })
  );
  const document = unwrap(await uploadDocument(formData));
  return document;
}

describe("chat actions", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("crea una sesión de chat", async () => {
    const result = await createChatSession({ title: "Nueva sesión" });
    const session = unwrap(result);

    expect(session.title).toBe("Nueva sesión");
    expect(session.sourceDocumentId).toBeNull();
  });

  it("devuelve error de validación si el título está vacío", async () => {
    const result = await createChatSession({ title: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.fieldErrors?.title).toBeDefined();
    }
  });

  it("crea una sesión asociada a un documento", async () => {
    const document = await seedDocument();
    const session = unwrap(
      await createChatSession({
        title: "Sesión con documento",
        sourceDocumentId: document.id,
      })
    );

    expect(session.sourceDocumentId).toBe(document.id);
  });

  it("añade un mensaje de usuario creando una sesión si no existe", async () => {
    const result = await addUserMessage(null, "¿Pregunta?");
    const data = unwrap(result);

    expect(data.sessionId).toBeDefined();

    const session = await getChatSession(data.sessionId);
    expect(session?.messages).toHaveLength(1);
    expect(session?.messages[0].role).toBe("user");
    expect(session?.messages[0].content).toBe("¿Pregunta?");
    expect(session?.title).toBe("¿Pregunta?");
  });

  it("devuelve error si la pregunta está vacía", async () => {
    const result = await addUserMessage(null, "");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.fieldErrors?.question).toBeDefined();
    }
  });

  it("devuelve error si la pregunta supera los 2000 caracteres", async () => {
    const result = await addUserMessage(null, "a".repeat(2001));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.fieldErrors?.question).toBeDefined();
    }
  });

  it("usa una sesión existente si se proporciona sessionId", async () => {
    const session = unwrap(await createChatSession({ title: "Existente" }));
    const result = await addUserMessage(session.id, "Segunda pregunta");
    const data = unwrap(result);

    expect(data.sessionId).toBe(session.id);

    const updated = await getChatSession(session.id);
    expect(updated?.messages).toHaveLength(1);
  });

  it("añade un mensaje del asistente", async () => {
    const session = unwrap(await createChatSession({ title: "Sesión" }));
    await addAssistantMessage(session.id, "Respuesta", [{ doc: 1 }]);

    const updated = await getChatSession(session.id);
    expect(updated?.messages).toHaveLength(1);
    expect(updated?.messages[0].role).toBe("assistant");
    expect(updated?.messages[0].content).toBe("Respuesta");
    expect(updated?.messages[0].sources).toEqual([{ doc: 1 }]);
  });

  it("lista sesiones ordenadas por fecha de actualización", async () => {
    unwrap(await createChatSession({ title: "A" }));
    unwrap(await createChatSession({ title: "B" }));

    const sessions = await getChatSessions();
    expect(sessions).toHaveLength(2);
  });

  it("elimina una sesión y sus mensajes", async () => {
    const session = unwrap(await createChatSession({ title: "Borrar" }));
    unwrap(await addUserMessage(session.id, "Hola"));
    const result = await deleteChatSession(session.id);

    expect(result.success).toBe(true);

    const found = await getChatSession(session.id);
    expect(found).toBeNull();

    const messages = await prismaTest.chatMessage.findMany({
      where: { sessionId: session.id },
    });
    expect(messages).toHaveLength(0);
  });

  describe("startChatResponse", () => {
    it("crea un mensaje del asistente en PROCESSING y encola el job", async () => {
      const session = unwrap(await createChatSession({ title: "Sesión" }));
      await prismaTest.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "user",
          content: "¿Pregunta?",
        },
      });

      const result = await startChatResponse(session.id);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.assistantMessageId).toBeDefined();

      const assistantMessage = await prismaTest.chatMessage.findUnique({
        where: { id: result.data.assistantMessageId },
      });
      expect(assistantMessage?.role).toBe("assistant");
      expect(assistantMessage?.status).toBe("PROCESSING");
      expect(assistantMessage?.content).toBe("");

      expect(mockedEnqueueJob).toHaveBeenCalledWith(
        "chat",
        result.data.assistantMessageId,
        expect.objectContaining({
          payload: { sessionId: session.id, locale: "es" },
        })
      );
    });

    it("devuelve error si el último mensaje no es del usuario", async () => {
      const session = unwrap(await createChatSession({ title: "Sesión" }));
      await prismaTest.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: "Hola",
        },
      });

      const result = await startChatResponse(session.id);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.type).toBe("USER_ERROR");
    });

    it("devuelve error si ya hay una respuesta en PROCESSING", async () => {
      const session = unwrap(await createChatSession({ title: "Sesión" }));
      await prismaTest.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "user",
          content: "¿Pregunta?",
        },
      });
      await prismaTest.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: "",
          status: "PROCESSING",
        },
      });

      const result = await startChatResponse(session.id);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.type).toBe("USER_ERROR");
    });
  });

  describe("cancelChatResponse", () => {
    it("marca un mensaje en PROCESSING como ERROR de cancelación", async () => {
      const session = unwrap(await createChatSession({ title: "Sesión" }));
      const assistantMessage = await prismaTest.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: "",
          status: "PROCESSING",
        },
      });

      const result = await cancelChatResponse(session.id, assistantMessage.id);

      expect(result.success).toBe(true);

      const updated = await prismaTest.chatMessage.findUnique({
        where: { id: assistantMessage.id },
      });
      expect(updated?.status).toBe("ERROR");
      expect(updated?.content).toBe("Generación cancelada por el usuario.");
    });

    it("devuelve error si el mensaje no está en PROCESSING", async () => {
      const session = unwrap(await createChatSession({ title: "Sesión" }));
      const assistantMessage = await prismaTest.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: "Listo",
          status: "READY",
        },
      });

      const result = await cancelChatResponse(session.id, assistantMessage.id);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.type).toBe("USER_ERROR");
    });
  });

  describe("regenerateChatResponse", () => {
    it("reinicia un mensaje del asistente y encola el job", async () => {
      const session = unwrap(await createChatSession({ title: "Sesión" }));
      const assistantMessage = await prismaTest.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: "Error",
          status: "ERROR",
          sources: [{ doc: 1 }],
        },
      });

      const result = await regenerateChatResponse(
        session.id,
        assistantMessage.id
      );

      expect(result.success).toBe(true);

      const updated = await prismaTest.chatMessage.findUnique({
        where: { id: assistantMessage.id },
      });
      expect(updated?.status).toBe("PROCESSING");
      expect(updated?.content).toBe("");
      expect(updated?.sources).toBeNull();

      expect(mockedEnqueueJob).toHaveBeenCalledWith(
        "chat",
        assistantMessage.id,
        expect.objectContaining({
          payload: { sessionId: session.id, locale: "es" },
        })
      );
    });

    it("devuelve error si el mensaje no existe", async () => {
      const session = unwrap(await createChatSession({ title: "Sesión" }));

      const result = await regenerateChatResponse(session.id, "no-existe");

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.type).toBe("USER_ERROR");
    });
  });
});
