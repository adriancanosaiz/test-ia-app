import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatMessage: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma as prismaMock } from "@/lib/prisma";

const prisma = prismaMock as unknown as {
  chatMessage: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const mockFindUnique = vi.mocked(prisma.chatMessage.findUnique);

function createRequest(sessionId: string, messageId: string, signal?: AbortSignal) {
  return new Request(
    `http://localhost/api/chat/${sessionId}/progress?messageId=${messageId}`,
    { signal }
  ) as unknown as import("next/server").NextRequest;
}

async function readSSEEvents(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: Array<{ event?: string; data: Record<string, unknown> }> = [];

  if (!reader) return events;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";

    for (const block of lines) {
      const blockLines = block.split("\n");
      let event: string | undefined;
      let data: Record<string, unknown> | undefined;
      for (const line of blockLines) {
        if (line.startsWith("event: ")) {
          event = line.slice(7);
        } else if (line.startsWith("data: ")) {
          data = JSON.parse(line.slice(6));
        }
      }
      if (data) {
        events.push({ event, data });
      }
    }
  }

  return events;
}

describe("GET /api/chat/[id]/progress", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve 400 si falta messageId", async () => {
    const request = new Request(
      "http://localhost/api/chat/session-1/progress"
    ) as unknown as import("next/server").NextRequest;

    const response = await GET(request, {
      params: Promise.resolve({ id: "session-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("devuelve 404 si el mensaje no existe o no pertenece a la sesión", async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(createRequest("session-1", "msg-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("devuelve 404 si el mensaje pertenece a otra sesión", async () => {
    mockFindUnique.mockResolvedValue({
      id: "msg-1",
      sessionId: "session-2",
      role: "assistant",
      content: "",
      status: "PROCESSING",
      sources: null,
      createdAt: new Date(),
    });

    const response = await GET(createRequest("session-1", "msg-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("emite eventos SSE, complete y cierra cuando el mensaje está READY", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const assistantMessage = {
      id: "msg-1",
      sessionId: "session-1",
      role: "assistant",
      content: "",
      status: "PROCESSING",
      sources: null,
      createdAt: new Date(),
    };

    mockFindUnique
      .mockResolvedValueOnce(assistantMessage)
      .mockResolvedValueOnce({ ...assistantMessage })
      .mockResolvedValueOnce({
        ...assistantMessage,
        content: "Respuesta parcial",
      })
      .mockResolvedValueOnce({
        ...assistantMessage,
        content: "Respuesta final",
        status: "READY",
      });

    const response = await GET(createRequest("session-1", "msg-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });

    const readPromise = readSSEEvents(response);
    await vi.advanceTimersByTimeAsync(2000);
    const events = await readPromise;

    const progressEvents = events.filter((e) => e.event === "progress");
    expect(progressEvents.length).toBeGreaterThanOrEqual(3);
    expect(progressEvents[0]).toMatchObject({
      data: expect.objectContaining({
        id: "msg-1",
        content: "",
        status: "PROCESSING",
      }),
    });
    expect(progressEvents[progressEvents.length - 1]).toMatchObject({
      data: expect.objectContaining({
        id: "msg-1",
        content: "Respuesta final",
        status: "READY",
      }),
    });

    const completeEvents = events.filter((e) => e.event === "complete");
    expect(completeEvents).toHaveLength(1);
    expect(completeEvents[0]).toMatchObject({
      data: expect.objectContaining({
        id: "msg-1",
        content: "Respuesta final",
        status: "READY",
      }),
    });
  });

  it("emite evento error parseable cuando el mensaje está en ERROR", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const assistantMessage = {
      id: "msg-2",
      sessionId: "session-1",
      role: "assistant",
      content: "",
      status: "PROCESSING",
      sources: null,
      createdAt: new Date(),
    };

    mockFindUnique.mockResolvedValue({
      ...assistantMessage,
      content: "Error generando respuesta",
      status: "ERROR",
    });

    const response = await GET(createRequest("session-1", "msg-2"), {
      params: Promise.resolve({ id: "session-1" }),
    });

    const readPromise = readSSEEvents(response);
    await vi.advanceTimersByTimeAsync(1000);
    const events = await readPromise;

    const progressEvents = events.filter((e) => e.event === "progress");
    expect(progressEvents).toHaveLength(1);
    expect(progressEvents[0]).toMatchObject({
      data: expect.objectContaining({
        id: "msg-2",
        status: "ERROR",
      }),
    });

    const errorEvents = events.filter((e) => e.event === "error");
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toMatchObject({
      data: expect.objectContaining({ message: "Error al generar la respuesta" }),
    });
  });

  it("envía heartbeats periódicos", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const controller = new AbortController();

    const assistantMessage = {
      id: "msg-3",
      sessionId: "session-1",
      role: "assistant",
      content: "",
      status: "PROCESSING",
      sources: null,
      createdAt: new Date(),
    };

    mockFindUnique.mockResolvedValue(assistantMessage);

    const response = await GET(createRequest("session-1", "msg-3", controller.signal), {
      params: Promise.resolve({ id: "session-1" }),
    });

    const readPromise = readSSEEvents(response);
    await vi.advanceTimersByTimeAsync(45_000);
    controller.abort();
    const events = await readPromise;

    const heartbeats = events.filter((e) => e.event === "heartbeat");
    expect(heartbeats.length).toBeGreaterThanOrEqual(2);
  });
});
