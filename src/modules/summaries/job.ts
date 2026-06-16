import { prisma } from "@/lib/prisma";
import { getCurrentAIProvider } from "@/modules/ai/provider";
import { OllamaChatProvider } from "@/modules/ai/providers/ollama";
import { assertOllamaModels } from "@/modules/ai/ollama";
import { getLocaleFromPayload, getJobMessage } from "@/lib/i18n/jobs";
import { AbortError, JobRunner } from "@/lib/jobs/runner";

// Límite aproximado de tokens de contexto para resúmenes. Evita timeouts en hardware modesto.
const MAX_SUMMARY_TOKENS = 6000;

function checkSignal(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AbortError("Generación cancelada");
  }
}

export async function generateSummaryJob(
  summaryId: string,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: number) => void | Promise<void>;
    payload?: unknown;
  }
): Promise<void> {
  const signal = options?.signal;
  const onProgress = options?.onProgress;
  const language = getLocaleFromPayload(options?.payload);

  const summary = await prisma.documentSummary.findUnique({
    where: { id: summaryId },
    include: {
      document: {
        include: { chunks: { orderBy: { index: "asc" } } },
      },
    },
  });

  if (!summary) return;

  if (summary.document.status !== "READY") {
    await prisma.documentSummary.update({
      where: { id: summaryId },
      data: {
        status: "ERROR",
        progress: 0,
        errorMessage: getJobMessage(language, "documentNotReady"),
      },
    });
    return;
  }

  checkSignal(signal);
  await prisma.documentSummary.update({
    where: { id: summaryId },
    data: { progress: 10 },
  });
  await onProgress?.(10);

  try {
    checkSignal(signal);

    const provider = await getCurrentAIProvider();
    if (provider.chat instanceof OllamaChatProvider) {
      await assertOllamaModels();
    }

    const maxChars = MAX_SUMMARY_TOKENS * 4;
    const selectedChunks: string[] = [];
    let usedChars = 0;

    for (const chunk of summary.document.chunks) {
      const available = Math.max(0, maxChars - usedChars);
      if (available === 0) break;
      selectedChunks.push(chunk.content.slice(0, available));
      usedChars += chunk.content.slice(0, available).length;
    }

    const text = selectedChunks.join("\n\n");

    await prisma.documentSummary.update({
      where: { id: summaryId },
      data: { progress: 50 },
    });
    await onProgress?.(50);

    checkSignal(signal);
    const languageInstruction =
      language === "en"
        ? "Summarize the following document clearly and concisely in English. Return only the summary."
        : "Resume el siguiente documento de forma clara y concisa en español. Devuelve solo el resumen.";

    const prompt = `${languageInstruction}\n\n${text}`;

    const content = await provider.chat.complete(
      [{ role: "user", content: prompt }],
      { maxTokens: 4096 }
    );

    checkSignal(signal);
    await prisma.documentSummary.update({
      where: { id: summaryId },
      data: {
        content,
        status: "READY",
        progress: 100,
        errorMessage: null,
      },
    });
    await onProgress?.(100);

  } catch (error) {
    if (error instanceof AbortError) {
      await prisma.documentSummary.update({
        where: { id: summaryId },
        data: {
          status: "ERROR",
          progress: 0,
          errorMessage: getJobMessage(language, "cancelled"),
        },
      });
      throw error;
    }

    const message =
      error instanceof Error
        ? error.message
        : getJobMessage(language, "unknownError");

    await prisma.documentSummary.update({
      where: { id: summaryId },
      data: {
        status: "ERROR",
        progress: 0,
        errorMessage: message,
      },
    });
  }
}

export const generateSummaryJobRunner: JobRunner = async ({
  entityId,
  signal,
  onProgress,
  payload,
}) => {
  await generateSummaryJob(entityId, { signal, onProgress, payload });
};
