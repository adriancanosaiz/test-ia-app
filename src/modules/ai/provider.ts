import { ActionResult, createUserError } from "@/lib/errors";
import type { AppSettings } from "@/lib/settings/types";

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://localhost:11434";
}

export function getEmbeddingModel(): string {
  return process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
}

export function getChatModel(): string {
  return process.env.OLLAMA_CHAT_MODEL || "llama3.2:3b";
}

export function getOllamaTimeoutMs(): number {
  return Number(process.env.OLLAMA_TIMEOUT_MS || "120000");
}

export function getOllamaGenerationTimeoutMs(): number {
  // Las operaciones de generación (tests, resúmenes, chat completo) suelen necesitar más tiempo,
  // especialmente en CPUs locales o con modelos grandes.
  return Number(process.env.OLLAMA_GENERATION_TIMEOUT_MS || "300000");
}

export function getEmbeddingDimensions(): number {
  return Number(process.env.OLLAMA_EMBEDDING_DIMENSIONS || "768");
}

export const OLLAMA_BASE_URL = getOllamaBaseUrl();
export const EMBEDDING_MODEL = getEmbeddingModel();
export const CHAT_MODEL = getChatModel();
export const EMBEDDING_DIMENSIONS = getEmbeddingDimensions();

export const PRISMA_EMBEDDING_DIMENSIONS = 768;

export async function validateEmbeddingDimensions(): Promise<ActionResult<void>> {
  const configured = getEmbeddingDimensions();
  if (configured !== PRISMA_EMBEDDING_DIMENSIONS) {
    return {
      success: false,
      error: createUserError(
        `La dimensión de embeddings configurada (${configured}) no coincide con la configuración de Prisma (${PRISMA_EMBEDDING_DIMENSIONS}).`,
        "EMBEDDING_DIMENSION_MISMATCH"
      ),
    };
  }
  return { success: true, data: undefined };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  getDimensions(): number;
}

export interface ChatProvider {
  health(): Promise<boolean>;
  complete(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<string>;
  chatStream(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): AsyncIterable<string>;
  completeJSON<T>(
    messages: ChatMessage[],
    schema: import("zod").ZodSchema<T>,
    options?: GenerateOptions
  ): Promise<T>;
}

export interface AIProvider {
  embedding: EmbeddingProvider;
  chat: ChatProvider;
}

export async function createAIProvider(settings: AppSettings): Promise<AIProvider> {
  const { getAIProvider } = await import("./registry");
  return getAIProvider(settings);
}

export async function getCurrentAIProvider(): Promise<AIProvider> {
  const { getEffectiveSettings } = await import("@/lib/settings");
  const settings = await getEffectiveSettings();
  return createAIProvider(settings);
}
