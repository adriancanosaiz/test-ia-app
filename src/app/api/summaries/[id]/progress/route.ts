import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSSEStream } from "@/lib/sse";

interface ProgressPayload {
  status: string;
  progress: number;
  errorMessage: string | null;
}

function isTerminalStatus(status: string): boolean {
  return status === "READY" || status === "ERROR";
}

function isCompleteStatus(payload: ProgressPayload): boolean {
  return payload.status === "READY";
}

function isErrorStatus(payload: ProgressPayload): boolean {
  return payload.status === "ERROR";
}

function getError(payload: ProgressPayload): { message: string } {
  return {
    message: payload.errorMessage ?? "Error al generar el resumen",
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(context.params);

  const summary = await prisma.documentSummary.findUnique({
    where: { id },
    select: { id: true, status: true, progress: true, errorMessage: true },
  });

  if (!summary) {
    return new Response("Resumen no encontrado", { status: 404 });
  }

  const stream = createSSEStream<ProgressPayload>(request, {
    initial: summary as ProgressPayload,
    fetch: async () => {
      const current = await prisma.documentSummary.findUnique({
        where: { id },
        select: { status: true, progress: true, errorMessage: true },
      });
      return current as ProgressPayload | null;
    },
    isTerminal: (payload) => isTerminalStatus(payload.status),
    isComplete: (payload) => isCompleteStatus(payload),
    isError: (payload) => isErrorStatus(payload),
    getError: (payload) => getError(payload),
    serialize: (payload) => payload,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
