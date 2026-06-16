import { z } from "zod";
import { AppErrorClass } from "@/lib/errors";
import { ChatMessage, ChatProvider, GenerateOptions } from "../provider";
import { buildJSONSystemPrompt, parseJSONResponse } from "./shared";

interface GroqProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_TIMEOUT_MS = 120_000;
const HEALTH_TIMEOUT_MS = 10_000;

function sanitizeBaseUrl(baseUrl?: string): string {
  return (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

export class GroqChatProvider implements ChatProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor({ apiKey, model, baseUrl }: GroqProviderOptions) {
    if (!apiKey) {
      throw new AppErrorClass(
        "USER_ERROR",
        "Se requiere una API key de Groq",
        "GROQ_API_KEY_MISSING"
      );
    }
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = sanitizeBaseUrl(baseUrl);
  }

  private async request(
    endpoint: string,
    body: unknown,
    options?: GenerateOptions
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    try {
      return await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async health(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async complete(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): Promise<string> {
    const response = await this.request(
      "/chat/completions",
      {
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2048,
      },
      options
    );

    if (!response.ok) {
      throw new AppErrorClass(
        "SYSTEM_ERROR",
        `Groq request failed: ${response.status} ${response.statusText}`,
        "GROQ_REQUEST_FAILED"
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }

  async *chatStream(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): AsyncIterable<string> {
    const response = await this.request(
      "/chat/completions",
      {
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2048,
        stream: true,
      },
      options
    );

    if (!response.ok) {
      throw new AppErrorClass(
        "SYSTEM_ERROR",
        `Groq stream failed: ${response.status} ${response.statusText}`,
        "GROQ_STREAM_FAILED"
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new AppErrorClass(
        "SYSTEM_ERROR",
        "Groq response body is empty",
        "GROQ_EMPTY_BODY"
      );
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
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;
        if (trimmed === "data: [DONE]") return;

        if (trimmed.startsWith("data: ")) {
          try {
            const json = JSON.parse(trimmed.slice(6)) as {
              choices?: { delta?: { content?: string } }[];
            };
            const content = json.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Ignore malformed lines
          }
        }
      }
    }
  }

  async completeJSON<T>(
    messages: ChatMessage[],
    schema: z.ZodSchema<T>,
    options: GenerateOptions = {}
  ): Promise<T> {
    const systemMessage: ChatMessage = {
      role: "system",
      content: buildJSONSystemPrompt(),
    };

    const response = await this.request(
      "/chat/completions",
      {
        model: this.model,
        messages: [systemMessage, ...messages],
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 4096,
        response_format: { type: "json_object" },
      },
      options
    );

    if (!response.ok) {
      throw new AppErrorClass(
        "SYSTEM_ERROR",
        `Groq JSON request failed: ${response.status} ${response.statusText}`,
        "GROQ_JSON_REQUEST_FAILED"
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    return parseJSONResponse(raw, schema);
  }
}
