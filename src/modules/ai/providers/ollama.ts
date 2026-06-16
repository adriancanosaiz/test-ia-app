import { z } from "zod";
import {
  AppErrorClass,
  ActionResult,
  createUserError,
  createSystemError,
} from "@/lib/errors";
import {
  AIProvider,
  ChatMessage,
  ChatProvider,
  EmbeddingProvider,
  GenerateOptions,
  OLLAMA_BASE_URL,
  EMBEDDING_MODEL,
  CHAT_MODEL,
  getOllamaTimeoutMs,
  getOllamaGenerationTimeoutMs,
  getEmbeddingDimensions,
  getChatModel,
  getEmbeddingModel,
} from "../provider";
import { sanitizeJSON } from "./shared";

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isRetryableError(error: Error): boolean {
  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return false;
  }
  return true;
}

interface FetchOptions {
  url: string;
  init: RequestInit;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

async function fetchWithRetryAndTimeout({
  url,
  init,
  baseUrl = OLLAMA_BASE_URL,
  timeoutMs = getOllamaTimeoutMs(),
  maxRetries = MAX_RETRIES,
  retryDelayMs = RETRY_BASE_DELAY_MS,
}: FetchOptions): Promise<Response> {
  const resolvedBaseUrl = baseUrl.replace(/\/$/, "");
  const fullUrl = url.startsWith("http") ? url : `${resolvedBaseUrl}${url}`;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(fullUrl, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok && isRetryableStatus(response.status) && attempt < maxRetries) {
        lastError = new Error(
          `Ollama request failed: ${response.status} ${response.statusText}`
        );
        await sleep(retryDelayMs * 2 ** attempt);
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (controller.signal.aborted) {
        throw new AppErrorClass(
          "SYSTEM_ERROR",
          `Timeout al conectar con Ollama después de ${timeoutMs}ms`,
          "OLLAMA_TIMEOUT"
        );
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(lastError) || attempt === maxRetries) {
        throw lastError;
      }

      await sleep(retryDelayMs * 2 ** attempt);
    }
  }

  throw (
    lastError ??
    new AppErrorClass("SYSTEM_ERROR", "Error desconocido al contactar Ollama")
  );
}

export interface ModelValidationResult {
  chatAvailable: boolean;
  embeddingAvailable: boolean;
  availableModels: string[];
}

export async function assertOllamaModels(baseUrl?: string): Promise<void> {
  const result = await validateOllamaModels(baseUrl);
  if (!result.success) {
    throw new AppErrorClass(
      result.error.type,
      result.error.message,
      result.error.code
    );
  }
}

export async function validateOllamaModels(
  baseUrl?: string
): Promise<ActionResult<ModelValidationResult>> {
  try {
    const response = await fetchWithRetryAndTimeout({
      url: "/api/tags",
      init: { method: "GET" },
      baseUrl,
      maxRetries: 1,
    });

    if (!response.ok) {
      return {
        success: false,
        error: createSystemError(
          `No se pudo consultar los modelos disponibles en Ollama: ${response.status} ${response.statusText}`,
          "OLLAMA_MODELS_QUERY_FAILED"
        ),
      };
    }

    const data = (await response.json()) as { models?: { name: string }[] };
    const chatModel = getChatModel();
    const embeddingModel = getEmbeddingModel();
    const availableModels = data.models?.map((m) => m.name) ?? [];
    const chatAvailable = availableModels.some(
      (name) => name === chatModel || name.startsWith(`${chatModel}:`)
    );
    const embeddingAvailable = availableModels.some(
      (name) =>
        name === embeddingModel || name.startsWith(`${embeddingModel}:`)
    );

    if (!chatAvailable || !embeddingAvailable) {
      const missing = [
        !chatAvailable ? chatModel : null,
        !embeddingAvailable ? embeddingModel : null,
      ].filter(Boolean);

      return {
        success: false,
        error: createUserError(
          `Faltan los siguientes modelos en Ollama: ${missing.join(", ")}. Modelos disponibles: ${availableModels.join(", ") || "ninguno"}.`,
          "OLLAMA_MODELS_MISSING"
        ),
      };
    }

    return {
      success: true,
      data: { chatAvailable, embeddingAvailable, availableModels },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    if (error instanceof AppErrorClass && error.type === "SYSTEM_ERROR") {
      return { success: false, error: { type: "SYSTEM_ERROR", message, code: error.code } };
    }
    return {
      success: false,
      error: createSystemError(
        `Error al validar modelos de Ollama: ${message}`,
        "OLLAMA_MODELS_VALIDATION_FAILED"
      ),
    };
  }
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private model: string;
  private baseUrl: string;

  constructor(model?: string, baseUrl?: string) {
    this.model = model ?? EMBEDDING_MODEL;
    this.baseUrl = (baseUrl ?? OLLAMA_BASE_URL).replace(/\/$/, "");
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetchWithRetryAndTimeout({
      url: "/api/embeddings",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: text }),
      },
      baseUrl: this.baseUrl,
    });

    if (!response.ok) {
      throw new AppErrorClass(
        "SYSTEM_ERROR",
        `Ollama embedding failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }

  getDimensions(): number {
    return getEmbeddingDimensions();
  }
}

export class OllamaChatProvider implements ChatProvider {
  private model: string;
  private baseUrl: string;

  constructor(model?: string, baseUrl?: string) {
    this.model = model ?? CHAT_MODEL;
    this.baseUrl = (baseUrl ?? OLLAMA_BASE_URL).replace(/\/$/, "");
  }

  async health(): Promise<boolean> {
    try {
      const response = await fetchWithRetryAndTimeout({
        url: "/api/tags",
        init: { method: "GET" },
        baseUrl: this.baseUrl,
        maxRetries: 0,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async complete(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): Promise<string> {
    const response = await fetchWithRetryAndTimeout({
      url: "/api/chat",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.3,
            num_predict: options.maxTokens ?? 2048,
          },
        }),
      },
      baseUrl: this.baseUrl,
      timeoutMs: options.timeoutMs ?? getOllamaGenerationTimeoutMs(),
    });

    if (!response.ok) {
      throw new AppErrorClass(
        "SYSTEM_ERROR",
        `Ollama completion failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content ?? "";
  }

  async *chatStream(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): AsyncIterable<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, getOllamaTimeoutMs());

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          options: {
            temperature: options.temperature ?? 0.3,
            num_predict: options.maxTokens ?? 2048,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppErrorClass(
          "SYSTEM_ERROR",
          `Ollama chat failed: ${response.status} ${response.statusText}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new AppErrorClass("SYSTEM_ERROR", "Ollama response body is empty");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as { message?: { content?: string } };
            if (chunk.message?.content) {
              yield chunk.message.content;
            }
          } catch {
            // Ignore malformed lines
          }
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AppErrorClass(
          "SYSTEM_ERROR",
          `Timeout al conectar con Ollama después de ${getOllamaTimeoutMs()}ms`,
          "OLLAMA_TIMEOUT"
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async completeJSON<T>(
    messages: ChatMessage[],
    schema: z.ZodSchema<T>,
    options: GenerateOptions = {}
  ): Promise<T> {
    const systemMessage: ChatMessage = {
      role: "system",
      content:
        "You are a helpful assistant. Respond ONLY with a valid JSON object that matches the requested schema. Do not include markdown code blocks or explanations.",
    };

    const response = await fetchWithRetryAndTimeout({
      url: "/api/chat",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [systemMessage, ...messages],
          stream: false,
          format: "json",
          options: {
            temperature: options.temperature ?? 0.2,
            num_predict: options.maxTokens ?? 4096,
          },
        }),
      },
      baseUrl: this.baseUrl,
      timeoutMs: options.timeoutMs ?? getOllamaGenerationTimeoutMs(),
    });

    if (!response.ok) {
      throw new AppErrorClass(
        "SYSTEM_ERROR",
        `Ollama completion failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as { message?: { content?: string } };
    const raw = sanitizeJSON(data.message?.content ?? "{}");
    const parsed = JSON.parse(raw);
    return schema.parse(parsed);
  }
}

export const ollamaProvider: AIProvider = {
  embedding: new OllamaEmbeddingProvider(),
  chat: new OllamaChatProvider(),
};
