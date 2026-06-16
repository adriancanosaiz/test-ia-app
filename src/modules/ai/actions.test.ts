import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { checkOllamaStatus } from "./actions";
import { ChatProvider, EmbeddingProvider, Language } from "@/lib/settings/types";

vi.mock("@/lib/settings", () => ({
  getEffectiveSettings: vi.fn(),
}));

import { getEffectiveSettings } from "@/lib/settings";

const mockedGetEffectiveSettings = vi.mocked(getEffectiveSettings);

function mockSettings(overrides: Record<string, unknown> = {}) {
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

describe("ai/actions", () => {
  beforeEach(() => {
    process.env.OLLAMA_EMBEDDING_DIMENSIONS = "768";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"models":[]}', { status: 200 }))
    );
    mockedGetEffectiveSettings.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.OLLAMA_EMBEDDING_DIMENSIONS;
    delete process.env.OLLAMA_CHAT_MODEL;
    delete process.env.OLLAMA_EMBEDDING_MODEL;
  });

  it("devuelve éxito cuando modelos y dimensión son correctos", async () => {
    mockedGetEffectiveSettings.mockResolvedValue(mockSettings());
    process.env.OLLAMA_CHAT_MODEL = "llama3.2:3b";
    process.env.OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          models: [
            { name: "llama3.2:3b" },
            { name: "nomic-embed-text" },
          ],
        })
      )
    );

    const result = await checkOllamaStatus();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.models.chatAvailable).toBe(true);
      expect(result.data.models.embeddingAvailable).toBe(true);
      expect(result.data.dimensions.valid).toBe(true);
    }
  });

  it("devuelve error cuando falta un modelo", async () => {
    mockedGetEffectiveSettings.mockResolvedValue(mockSettings());
    process.env.OLLAMA_CHAT_MODEL = "missing";
    process.env.OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ models: [{ name: "nomic-embed-text" }] })
      )
    );

    const result = await checkOllamaStatus();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("missing");
    }
  });

  it("devuelve error cuando la dimensión no coincide", async () => {
    mockedGetEffectiveSettings.mockResolvedValue(mockSettings());
    process.env.OLLAMA_EMBEDDING_DIMENSIONS = "512";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          models: [
            { name: "llama3.2:3b" },
            { name: "nomic-embed-text" },
          ],
        })
      )
    );

    const result = await checkOllamaStatus();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("512");
    }
  });

  it("devuelve éxito sin validar modelos Ollama cuando se usa un proveedor externo", async () => {
    mockedGetEffectiveSettings.mockResolvedValue(
      mockSettings({
        chatProvider: ChatProvider.OPENAI,
        chatModel: "gpt-4o-mini",
        apiKey: "sk-test",
      })
    );

    const result = await checkOllamaStatus();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.models.chatAvailable).toBe(true);
      expect(result.data.models.embeddingAvailable).toBe(true);
    }
  });
});
