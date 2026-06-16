import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    test: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma as prismaMock } from "@/lib/prisma";

const prisma = prismaMock as unknown as {
  test: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const mockFindUnique = vi.mocked(prisma.test.findUnique);

function createRequest(testId: string, signal?: AbortSignal) {
  return new Request(
    `http://localhost/api/tests/${testId}/progress`,
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

describe("GET /api/tests/[id]/progress", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve 404 si el test no existe", async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(createRequest("test-1"), {
      params: Promise.resolve({ id: "test-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("emite eventos SSE, complete y cierra cuando el test está READY", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const test = {
      id: "test-1",
      title: "Test",
      status: "PROCESSING",
      progress: 10,
      errorMessage: null,
    };

    mockFindUnique
      .mockResolvedValueOnce(test)
      .mockResolvedValueOnce({ ...test, progress: 50 })
      .mockResolvedValueOnce({ ...test, progress: 100, status: "READY" });

    const response = await GET(createRequest("test-1"), {
      params: Promise.resolve({ id: "test-1" }),
    });

    const readPromise = readSSEEvents(response);
    await vi.advanceTimersByTimeAsync(2000);
    const events = await readPromise;

    const progressEvents = events.filter((e) => e.event === "progress");
    expect(progressEvents.length).toBeGreaterThanOrEqual(2);
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSING", progress: 50 }) }),
        expect.objectContaining({ data: expect.objectContaining({ status: "READY", progress: 100 }) }),
      ])
    );

    const completeEvents = events.filter((e) => e.event === "complete");
    expect(completeEvents).toHaveLength(1);
    expect(completeEvents[0]).toMatchObject({
      data: expect.objectContaining({ status: "READY", progress: 100 }),
    });
  });

  it("emite evento error parseable cuando el test está en ERROR", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const test = {
      id: "test-2",
      title: "Test",
      status: "PROCESSING",
      progress: 20,
      errorMessage: null,
    };

    mockFindUnique.mockResolvedValue({
      ...test,
      status: "ERROR",
      errorMessage: "Fallo al generar preguntas",
    });

    const response = await GET(createRequest("test-2"), {
      params: Promise.resolve({ id: "test-2" }),
    });

    const readPromise = readSSEEvents(response);
    await vi.advanceTimersByTimeAsync(1000);
    const events = await readPromise;

    const progressEvents = events.filter((e) => e.event === "progress");
    expect(progressEvents).toHaveLength(1);
    expect(progressEvents[0]).toMatchObject({
      data: expect.objectContaining({
        status: "ERROR",
        errorMessage: "Fallo al generar preguntas",
      }),
    });

    const errorEvents = events.filter((e) => e.event === "error");
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toMatchObject({
      data: expect.objectContaining({ message: "Fallo al generar preguntas" }),
    });
  });

  it("envía heartbeats para mantener la conexión viva", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const controller = new AbortController();
    mockFindUnique.mockResolvedValue({
      id: "test-3",
      title: "Test",
      status: "PROCESSING",
      progress: 10,
      errorMessage: null,
    });

    const response = await GET(createRequest("test-3", controller.signal), {
      params: Promise.resolve({ id: "test-3" }),
    });

    const readPromise = readSSEEvents(response);
    await vi.advanceTimersByTimeAsync(45_000);
    controller.abort();
    const events = await readPromise;

    const heartbeats = events.filter((e) => e.event === "heartbeat");
    expect(heartbeats.length).toBeGreaterThanOrEqual(2);
  });
});
