import { prisma } from "@/lib/prisma";
import { getEffectiveSettings } from "@/lib/settings";
import { ChatProvider } from "@/lib/settings/types";
import { getEmbeddingProvider } from "@/modules/ai/registry";
import { assertOllamaModels } from "@/modules/ai/ollama";
import { getLocaleFromPayload, getJobMessage } from "@/lib/i18n/jobs";
import { parseDocument } from "./parser";
import { chunkText } from "./chunker";
import { readFile } from "./storage";
import { AbortError, JobRunner } from "@/lib/jobs/runner";

const EMBEDDING_BATCH_SIZE = 5;

function checkSignal(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AbortError("Procesamiento cancelado");
  }
}

export async function processDocumentJob(
  documentId: string,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: number) => void | Promise<void>;
    payload?: unknown;
  }
): Promise<void> {
  const signal = options?.signal;
  const onProgress = options?.onProgress;
  const language = getLocaleFromPayload(options?.payload);

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) return;
  if (
    document.status !== "PENDING" &&
    document.status !== "ERROR" &&
    document.status !== "PROCESSING"
  )
    return;

  const settings = await getEffectiveSettings();
  const embeddingProvider = getEmbeddingProvider(settings);

  if (settings.chatProvider === ChatProvider.OLLAMA) {
    await assertOllamaModels(settings.baseUrl);
  }

  checkSignal(signal);

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "PROCESSING", progress: 10, errorMessage: null },
  });
  await onProgress?.(10);

  try {
    checkSignal(signal);
    await prisma.chunk.deleteMany({ where: { documentId } });

    checkSignal(signal);
    const buffer = await readFile(document.storageKey);
    const { text, pageCount } = await parseDocument(document.mimeType, buffer);
    await prisma.document.update({
      where: { id: documentId },
      data: { progress: 30 },
    });
    await onProgress?.(30);

    checkSignal(signal);
    const rawChunks = chunkText(text, { chunkSize: 1500, overlap: 150 }).map(
      (chunk, index) => ({
        ...chunk,
        index,
        metadata: {
          ...chunk.metadata,
          pageCount,
          mimeType: document.mimeType,
        },
      })
    );
    await prisma.document.update({
      where: { id: documentId },
      data: { progress: 50 },
    });
    await onProgress?.(50);

    checkSignal(signal);
    const createdChunks = await prisma.$transaction(
      rawChunks.map((chunk) =>
        prisma.chunk.create({
          data: {
            documentId,
            content: chunk.content,
            index: chunk.index,
            tokenCount: chunk.tokenCount,
            pageNumber: chunk.pageNumber,
            metadata: chunk.metadata,
          },
        })
      )
    );

    const batchSize = EMBEDDING_BATCH_SIZE;
    for (let i = 0; i < createdChunks.length; i += batchSize) {
      checkSignal(signal);
      const batch = createdChunks.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (chunk) => {
          checkSignal(signal);
          const embedding = await embeddingProvider.embed(chunk.content);
          const vectorLiteral = `[${embedding.join(",")}]`;
          await prisma.$executeRaw`
            UPDATE "Chunk"
            SET embedding = ${vectorLiteral}::vector
            WHERE id = ${chunk.id}
          `;
        })
      );

      const progress =
        createdChunks.length === 0
          ? 100
          : 50 + Math.round(((i + batchSize) / createdChunks.length) * 50);
      await prisma.document.update({
        where: { id: documentId },
        data: { progress: Math.min(progress, 100) },
      });
      await onProgress?.(Math.min(progress, 100));
    }

    checkSignal(signal);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "READY",
        progress: 100,
        chunkCount: createdChunks.length,
      },
    });
    await onProgress?.(100);

  } catch (error) {
    if (error instanceof AbortError) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "ERROR",
          errorMessage: getJobMessage(language, "cancelled"),
        },
      });
      throw error;
    }

    const message =
      error instanceof Error
        ? error.message
        : getJobMessage(language, "unknownError");
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "ERROR", progress: 0, errorMessage: message },
    });
  }
}

export const processDocumentJobRunner: JobRunner = async ({
  entityId,
  signal,
  onProgress,
  payload,
}) => {
  await processDocumentJob(entityId, { signal, onProgress, payload });
};
