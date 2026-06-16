import { prisma } from "@/lib/prisma";
import { generateAnswer } from "@/modules/ai/rag";
import { ChatMessage as AiChatMessage } from "@/modules/ai/provider";
import { getLocaleFromPayload, getJobMessage } from "@/lib/i18n/jobs";
import { AbortError, JobRunner } from "@/lib/jobs/runner";

const UPDATE_INTERVAL_MS = 500;
const UPDATE_CHUNK_THRESHOLD = 10;

function checkSignal(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AbortError("Generación cancelada");
  }
}

export interface GenerateChatResponseOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void | Promise<void>;
  payload?: unknown;
}

export async function generateChatResponseJob(
  sessionId: string,
  assistantMessageId?: string,
  options?: GenerateChatResponseOptions
): Promise<void> {
  const signal = options?.signal;
  const onProgress = options?.onProgress;
  const language = getLocaleFromPayload(options?.payload);

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      sourceDocument: {
        select: { id: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 20,
      },
    },
  });

  if (!session) {
    return;
  }

  const userMessageIndex = session.messages.findLastIndex(
    (message) => message.role === "user"
  );

  if (userMessageIndex === -1) {
    return;
  }

  const userMessage = session.messages[userMessageIndex];

  let assistantMessage: Awaited<
    ReturnType<typeof prisma.chatMessage.findUnique>
  > = null;

  if (assistantMessageId) {
    assistantMessage = await prisma.chatMessage.findUnique({
      where: { id: assistantMessageId },
    });

    if (
      !assistantMessage ||
      assistantMessage.sessionId !== sessionId ||
      assistantMessage.role !== "assistant"
    ) {
      return;
    }
  } else {
    assistantMessage =
      session.messages.findLast(
        (message) =>
          message.role === "assistant" &&
          message.status === "PROCESSING" &&
          message.createdAt >= userMessage.createdAt
      ) ?? null;

    if (!assistantMessage) {
      assistantMessage = await prisma.chatMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: "",
          status: "PROCESSING",
        },
      });
    }
  }

  if (assistantMessage.status !== "PROCESSING") {
    return;
  }

  const history: AiChatMessage[] = session.messages
    .slice(0, userMessageIndex)
    .filter(
      (message) => message.role === "user" || message.role === "assistant"
    )
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

  async function isStillProcessing(id: string): Promise<boolean> {
    const latest = await prisma.chatMessage.findUnique({
      where: { id },
      select: { status: true },
    });
    return latest?.status === "PROCESSING";
  }

  try {
    checkSignal(signal);
    const { stream, sources } = await generateAnswer(
      userMessage.content,
      history,
      {
        documentId: session.sourceDocument?.id ?? undefined,
        language,
      }
    );

    let content = "";
    let chunkCount = 0;
    let lastUpdate = Date.now();

    for await (const chunk of stream) {
      checkSignal(signal);
      content += chunk;
      chunkCount++;

      const now = Date.now();
      if (
        now - lastUpdate >= UPDATE_INTERVAL_MS ||
        chunkCount % UPDATE_CHUNK_THRESHOLD === 0
      ) {
        if (!(await isStillProcessing(assistantMessage.id))) {
          return;
        }

        await prisma.chatMessage.update({
          where: { id: assistantMessage.id },
          data: { content },
        });
        await onProgress?.(Math.min(chunkCount * 2, 99));
        lastUpdate = now;
      }
    }

    if (await isStillProcessing(assistantMessage.id)) {
      await prisma.chatMessage.update({
        where: { id: assistantMessage.id },
        data: {
          content,
          status: "READY",
          sources: sources.map((source) => ({
            documentId: source.documentId,
            documentTitle: source.documentTitle,
            subjectName: source.subjectName,
            similarity: source.similarity,
            pageNumber: source.pageNumber,
          })),
        },
      });
      await onProgress?.(100);
    }
  } catch (error) {
    if (error instanceof AbortError || signal?.aborted) {
      if (await isStillProcessing(assistantMessage.id)) {
        await prisma.chatMessage.update({
          where: { id: assistantMessage.id },
          data: {
            content: getJobMessage(language, "cancelled"),
            status: "ERROR",
          },
        });
      }
      throw error;
    }

    if (await isStillProcessing(assistantMessage.id)) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : getJobMessage(language, "unknownError");

      await prisma.chatMessage.update({
        where: { id: assistantMessage.id },
        data: {
          content: `${getJobMessage(language, "generationError")}: ${errorMessage}`,
          status: "ERROR",
        },
      });
    }
  } finally {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  }
}

export const generateChatResponseJobRunner: JobRunner = async ({
  entityId,
  signal,
  onProgress,
  payload,
}) => {
  const sessionId =
    typeof payload === "object" && payload !== null && "sessionId" in payload
      ? String((payload as { sessionId: unknown }).sessionId)
      : "";
  if (!sessionId) {
    throw new Error("Payload de chat job no contiene sessionId");
  }
  await generateChatResponseJob(sessionId, entityId, {
    signal,
    onProgress,
    payload,
  });
};
