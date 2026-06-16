import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateExternalProvider } from "./validate-provider";

vi.mock("@/modules/ai/providers/openai", () => ({
  OpenAIChatProvider: vi.fn().mockImplementation(
    () =>
      ({
        health: vi.fn(),
      }) as unknown as import("@/modules/ai/providers/openai").OpenAIChatProvider
  ),
}));

vi.mock("@/modules/ai/providers/anthropic", () => ({
  AnthropicChatProvider: vi.fn().mockImplementation(
    () =>
      ({
        health: vi.fn(),
      }) as unknown as import("@/modules/ai/providers/anthropic").AnthropicChatProvider
  ),
}));

vi.mock("@/modules/ai/providers/groq", () => ({
  GroqChatProvider: vi.fn().mockImplementation(
    () =>
      ({
        health: vi.fn(),
      }) as unknown as import("@/modules/ai/providers/groq").GroqChatProvider
  ),
}));

import { OpenAIChatProvider } from "@/modules/ai/providers/openai";
import { AnthropicChatProvider } from "@/modules/ai/providers/anthropic";
import { GroqChatProvider } from "@/modules/ai/providers/groq";

const mockOpenAI = vi.mocked(OpenAIChatProvider);
const mockAnthropic = vi.mocked(AnthropicChatProvider);
const mockGroq = vi.mocked(GroqChatProvider);

describe("validateExternalProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve éxito cuando health() responde true para OpenAI", async () => {
    mockOpenAI.mockImplementation(
      () =>
        ({
          health: vi.fn().mockResolvedValue(true),
        }) as unknown as OpenAIChatProvider
    );

    const result = await validateExternalProvider({
      provider: "openai",
      apiKey: "sk-test",
      chatModel: "gpt-4o-mini",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ok).toBe(true);
    }
    expect(mockOpenAI).toHaveBeenCalledWith({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      baseUrl: undefined,
    });
  });

  it("devuelve error cuando health() responde false", async () => {
    mockAnthropic.mockImplementation(
      () =>
        ({
          health: vi.fn().mockResolvedValue(false),
        }) as unknown as AnthropicChatProvider
    );

    const result = await validateExternalProvider({
      provider: "anthropic",
      apiKey: "sk-ant-test",
      baseUrl: "https://custom.anthropic.com/v1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.error.message).toMatch(/No se ha podido conectar/);
    }
  });

  it("pasa baseUrl al provider", async () => {
    mockGroq.mockImplementation(
      () =>
        ({
          health: vi.fn().mockResolvedValue(true),
        }) as unknown as GroqChatProvider
    );

    await validateExternalProvider({
      provider: "groq",
      apiKey: "gsk-test",
      baseUrl: "https://custom.groq.com/v1",
    });

    expect(mockGroq).toHaveBeenCalledWith({
      apiKey: "gsk-test",
      model: "default",
      baseUrl: "https://custom.groq.com/v1",
    });
  });

  it("devuelve error de validación si falta la API key", async () => {
    const result = await validateExternalProvider({
      provider: "openai",
      apiKey: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.fieldErrors?.apiKey).toBeDefined();
    }
  });

  it("devuelve SYSTEM_ERROR si health() lanza una excepción", async () => {
    mockOpenAI.mockImplementation(
      () =>
        ({
          health: vi.fn().mockRejectedValue(new Error("Network error")),
        }) as unknown as OpenAIChatProvider
    );

    const result = await validateExternalProvider({
      provider: "openai",
      apiKey: "sk-test",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("SYSTEM_ERROR");
    }
  });

  it("no expone la API key en el mensaje de error", async () => {
    mockOpenAI.mockImplementation(
      () =>
        ({
          health: vi.fn().mockRejectedValue(new Error("sk-test-leaked")),
        }) as unknown as OpenAIChatProvider
    );

    const result = await validateExternalProvider({
      provider: "openai",
      apiKey: "sk-test-leaked",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).not.toContain("sk-test-leaked");
    }
  });
});
