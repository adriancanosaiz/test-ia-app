import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma as prismaMock } from "@/lib/prisma";

const prisma = prismaMock as unknown as {
  document: { findUnique: ReturnType<typeof vi.fn> };
};

async function readStream(response: Response): Promise<{ event?: string; data: unknown }[]> {
  const reader = response.body?.getReader();
  if (!reader) return [];

  const decoder = new TextDecoder();
  let buffer = "";
  const events: { event?: string; data: unknown }[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const lines = part.trim().split("\n");
      let event: string | undefined;
      let data: unknown;
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          event = line.slice(7);
        } else if (line.startsWith("data: ")) {
          data = JSON.parse(line.slice(6));
        }
      }
      if (data !== undefined) {
        events.push({ event, data });
      }
    }
  }

  return events;
}

describe("GET /api/documents/[id]/progress", () => {
  beforeEach(() => {
    prisma.document.findUnique.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve 404 si el documento no existe", async () => {
    prisma.document.findUnique.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/documents/1/progress") as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(response.status).toBe(404);
  });

  it("stream SSE emite progreso, complete y cierra al terminar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const states = [
      { status: "PROCESSING", progress: 10, errorMessage: null },
      { status: "PROCESSING", progress: 50, errorMessage: null },
      { status: "READY", progress: 100, errorMessage: null },
    ];
    let index = 0;

    prisma.document.findUnique.mockImplementation(() => {
      const state = states[index] ?? states[states.length - 1];
      if (index < states.length - 1) index++;
      return Promise.resolve(state);
    });

    const response = await GET(
      new Request("http://localhost/api/documents/1/progress") as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");

    const readPromise = readStream(response);
    await vi.advanceTimersByTimeAsync(2000);
    const events = await readPromise;

    const progressEvents = events.filter((e) => e.event === "progress");
    expect(progressEvents.length).toBeGreaterThanOrEqual(2);
    expect(progressEvents).toContainEqual(
      expect.objectContaining({
        event: "progress",
        data: expect.objectContaining({ status: "PROCESSING", progress: 10 }),
      })
    );
    expect(progressEvents[progressEvents.length - 1]).toEqual(
      expect.objectContaining({
        event: "progress",
        data: expect.objectContaining({ status: "READY", progress: 100 }),
      })
    );

    const completeEvents = events.filter((e) => e.event === "complete");
    expect(completeEvents).toHaveLength(1);
    expect(completeEvents[0]).toEqual(
      expect.objectContaining({
        event: "complete",
        data: expect.objectContaining({ status: "READY", progress: 100 }),
      })
    );
  });

  it("emite evento error parseable cuando el documento falla", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const states = [
      { status: "PROCESSING", progress: 20, errorMessage: null },
      { status: "ERROR", progress: 20, errorMessage: "Fallo de Ollama" },
    ];
    let index = 0;

    prisma.document.findUnique.mockImplementation(() => {
      const state = states[index] ?? states[states.length - 1];
      if (index < states.length - 1) index++;
      return Promise.resolve(state);
    });

    const response = await GET(
      new Request("http://localhost/api/documents/1/progress") as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "1" }) }
    );

    const readPromise = readStream(response);
    await vi.advanceTimersByTimeAsync(1500);
    const events = await readPromise;

    const errorEvents = events.filter((e) => e.event === "error");
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toEqual(
      expect.objectContaining({
        event: "error",
        data: expect.objectContaining({ message: "Fallo de Ollama" }),
      })
    );

    const progressEvents = events.filter((e) => e.event === "progress");
    expect(progressEvents[progressEvents.length - 1]).toEqual(
      expect.objectContaining({
        event: "progress",
        data: expect.objectContaining({ status: "ERROR", errorMessage: "Fallo de Ollama" }),
      })
    );
  });

  it("envía eventos heartbeat periódicos", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const controller = new AbortController();

    prisma.document.findUnique.mockResolvedValue({
      status: "PROCESSING",
      progress: 10,
      errorMessage: null,
    });

    const response = await GET(
      new Request("http://localhost/api/documents/1/progress", { signal: controller.signal }) as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "1" }) }
    );

    const readPromise = readStream(response);
    await vi.advanceTimersByTimeAsync(45_000);
    controller.abort();
    const events = await readPromise;

    const heartbeats = events.filter((e) => e.event === "heartbeat");
    expect(heartbeats.length).toBeGreaterThanOrEqual(2);
  });
});
