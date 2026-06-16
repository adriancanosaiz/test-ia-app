import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSSEStream } from "@/lib/sse";

interface TestProgressPayload {
  status: string;
  progress: number;
  errorMessage: string | null;
}

function isTerminalStatus(status: string | null): boolean {
  return status === "READY" || status === "ERROR";
}

function isCompleteStatus(payload: TestProgressPayload): boolean {
  return payload.status === "READY";
}

function isErrorStatus(payload: TestProgressPayload): boolean {
  return payload.status === "ERROR";
}

function getError(payload: TestProgressPayload): { message: string } {
  return {
    message: payload.errorMessage ?? "Error al generar el test",
  };
}

function serializeTest(payload: TestProgressPayload) {
  return {
    status: payload.status,
    progress: payload.progress,
    errorMessage: payload.errorMessage,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: testId } = await params;

  const test = await prisma.test.findUnique({
    where: { id: testId },
  });

  if (!test) {
    return new Response("Test no encontrado", { status: 404 });
  }

  const stream = createSSEStream(request, {
    initial: test,
    fetch: async () =>
      prisma.test.findUnique({
        where: { id: testId },
      }),
    isTerminal: (latest) => isTerminalStatus(latest.status),
    isComplete: (latest) => isCompleteStatus(latest),
    isError: (latest) => isErrorStatus(latest),
    getError: (latest) => getError(latest),
    serialize: serializeTest,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
