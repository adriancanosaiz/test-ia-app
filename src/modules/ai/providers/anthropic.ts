import { z } from "zod";
import { AppErrorClass } from "@/lib/errors";
import { ChatMessage, ChatProvider, GenerateOptions } from "../provider";
import { buildJSONSystemPrompt, parseJSONResponse } from "./shared";

interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_TIMEOUT_MS = 120_000;
const HEALTH_TIMEOUT_MS = 10_000;
const ANTHROPIC_VERSION = "2023-06-01";

function sanitizeBaseUrl(baseUrl?: string): string {
  return (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

function splitSystemMessage(
  messages: ChatMessage[]
): { system?: string; conversation: ChatMessage[] } {
  const systemMessages = messages.filter((message) => message.role === "system");
  const conversation = messages.filter((message) => message.role !== "system");
  const system = systemMessages.map((message) => message.content).join("\n\n");
  return {
    system: system || undefined,
    conversation,
  };
}

export class AnthropicChatProvider implements ChatProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor({ apiKey, model, baseUrl }: AnthropicProviderOptions) {
    if (!apiKey) {
      throw new AppErrorClass(
        "USER_ERROR",
        "Se requiere una API key de Anthropic",
        "ANTHROPIC_API_KEY_MISSING"
      );
    }
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = sanitizeBaseUrl(baseUrl);
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    };
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
        headers: this.getHeaders(),
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
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
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
    const { system, conversation } = splitSystemMessage(messages);

    const response = await this.request(
      "/messages",
      {
        model: this.model,
        system,
        messages: conversation,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.3,
      },
      options
    );

    if (!response.ok) {
      throw new AppErrorClass(
        "SYSTEM_ERROR",
        `Anthropic request failed: ${response.status} ${response.statusText}`,
        "ANTHROPIC_REQUEST_FAILED"
      );
    }

    const data = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };
    return data.content?.[0]?.text ?? "";
  }

  async *chatStream(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): AsyncIterable<string> {
    const { system, conversation } = splitSystemMessage(messages);

    const response = await this.request(
      "/messages",
      {
        model: this.model,
        system,
        messages: conversation,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.3,
        stream: true,
      },
      options
    );

    if (!response.ok) {
      throw new AppErrorClass(
        "SYSTEM_ERROR",
        `Anthropic stream failed: ${response.status} ${response.statusText}`,
        "ANTHROPIC_STREAM_FAILED"
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new AppErrorClass(
        "SYSTEM_ERROR",
        "Anthropic response body is empty",
        "ANTHROPIC_EMPTY_BODY"
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

        if (trimmed.startsWith("event: ")) {
          const eventName = trimmed.slice(7);
          if (eventName === "message_stop") return;
          continue;
        }

        if (trimmed.startsWith("data: ")) {
          try {
            const json = JSON.parse(trimmed.slice(6)) as {
              type?: string;
              delta?: { type?: string; text?: string };
            };
            if (
              json.type === "content_block_delta" &&
              json.delta?.type === "text_delta" &&
              json.delta.text
            ) {
              yield json.delta.text;
            }
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
    const jsonPrompt = buildJSONSystemPrompt();
    const systemMessage: ChatMessage = {
      role: "system",
      content: jsonPrompt,
    };

    const response = await this.complete(
      [systemMessage, ...messages],
      { temperature: options.temperature ?? 0.2, maxTokens: options.maxTokens ?? 4096 }
    );

    return parseJSONResponse(response, schema);
  }
}
