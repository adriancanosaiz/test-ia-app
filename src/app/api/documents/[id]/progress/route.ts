import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocumentStatus } from "@prisma/client";
import { createSSEStream } from "@/lib/sse";

interface ProgressPayload {
  status: DocumentStatus;
  progress: number;
  errorMessage: string | null;
}

function isTerminalStatus(status: DocumentStatus): boolean {
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
    message: payload.errorMessage ?? "Error al procesar el documento",
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(context.params);

  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, status: true, progress: true, errorMessage: true },
  });

  if (!document) {
    return new Response("Documento no encontrado", { status: 404 });
  }

  const stream = createSSEStream<ProgressPayload>(request, {
    initial: document as ProgressPayload,
    fetch: async () => {
      const current = await prisma.document.findUnique({
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
