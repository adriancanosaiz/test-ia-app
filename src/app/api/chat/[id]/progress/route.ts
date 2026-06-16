import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ChatMessage } from "@prisma/client";
import { createSSEStream } from "@/lib/sse";

function isTerminalStatus(status: string | null): boolean {
  return status === "READY" || status === "ERROR" || status == null;
}

function isCompleteStatus(message: ChatMessage): boolean {
  return message.status === "READY";
}

function isErrorStatus(message: ChatMessage): boolean {
  return message.status === "ERROR";
}

function getError(): { message: string } {
  return { message: "Error al generar la respuesta" };
}

function serializeMessage(message: ChatMessage) {
  return {
    id: message.id,
    content: message.content,
    status: message.status,
    sources: message.sources,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("messageId");

  if (!messageId) {
    return new Response("Missing messageId", { status: 400 });
  }

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });

  if (!message || message.sessionId !== sessionId) {
    return new Response("Not found", { status: 404 });
  }

  const stream = createSSEStream(request, {
    initial: message,
    fetch: async () =>
      prisma.chatMessage.findUnique({
        where: { id: message.id },
      }),
    isTerminal: (latest) => isTerminalStatus(latest.status),
    isComplete: (latest) => isCompleteStatus(latest),
    isError: (latest) => isErrorStatus(latest),
    getError: () => getError(),
    serialize: serializeMessage,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
