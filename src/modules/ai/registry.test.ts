import { describe, expect, it } from "vitest";
import {
  AppSettings,
  ChatProvider,
  EmbeddingProvider,
  Language,
} from "@/lib/settings/types";
import { getChatProvider, getEmbeddingProvider, getAIProvider } from "./registry";
import { OllamaChatProvider, OllamaEmbeddingProvider } from "./providers/ollama";
import { OpenAIChatProvider } from "./providers/openai";
import { AnthropicChatProvider } from "./providers/anthropic";
import { GroqChatProvider } from "./providers/groq";

function createSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    id: "settings-1",
    chatProvider: ChatProvider.OLLAMA,
    chatModel: "llama3.2:3b",
    embeddingProvider: EmbeddingProvider.OLLAMA,
    embeddingModel: "nomic-embed-text",
    apiKey: undefined,
    baseUrl: undefined,
    language: Language.ES,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("AI provider registry", () => {
  it("devuelve provider Ollama por defecto", () => {
    const provider = getChatProvider(createSettings());
    expect(provider).toBeInstanceOf(OllamaChatProvider);
  });

  it("devuelve provider OpenAI cuando chatProvider es openai", () => {
    const provider = getChatProvider(
      createSettings({ chatProvider: ChatProvider.OPENAI, apiKey: "sk-test" })
    );
    expect(provider).toBeInstanceOf(OpenAIChatProvider);
  });

  it("devuelve provider Anthropic cuando chatProvider es anthropic", () => {
    const provider = getChatProvider(
      createSettings({ chatProvider: ChatProvider.ANTHROPIC, apiKey: "sk-test" })
    );
    expect(provider).toBeInstanceOf(AnthropicChatProvider);
  });

  it("devuelve provider Groq cuando chatProvider es groq", () => {
    const provider = getChatProvider(
      createSettings({ chatProvider: ChatProvider.GROQ, apiKey: "gsk-test" })
    );
    expect(provider).toBeInstanceOf(GroqChatProvider);
  });

  it("lanza error si la API key de OpenAI está vacía", () => {
    expect(() =>
      getChatProvider(createSettings({ chatProvider: ChatProvider.OPENAI, apiKey: "" }))
    ).toThrow(expect.objectContaining({ code: "OPENAI_API_KEY_MISSING" }));
  });

  it("el provider de embeddings siempre es Ollama", () => {
    const provider = getEmbeddingProvider(createSettings());
    expect(provider).toBeInstanceOf(OllamaEmbeddingProvider);
  });

  it("getAIProvider devuelve chat y embedding", () => {
    const provider = getAIProvider(createSettings());
    expect(provider.chat).toBeInstanceOf(OllamaChatProvider);
    expect(provider.embedding).toBeInstanceOf(OllamaEmbeddingProvider);
  });
});
