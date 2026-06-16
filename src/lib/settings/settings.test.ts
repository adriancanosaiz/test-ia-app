import { describe, expect, it, vi, beforeEach } from "vitest";
import { getSettings, saveSettings, getEffectiveSettings } from "../settings";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appSettings: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma as prismaMock } from "@/lib/prisma";

const prisma = prismaMock as unknown as {
  appSettings: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function mockSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: "settings-1",
    chatProvider: "ollama",
    chatModel: "llama3.2:3b",
    embeddingProvider: "ollama",
    embeddingModel: "nomic-embed-text",
    apiKey: null,
    baseUrl: null,
    language: "es",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.OLLAMA_CHAT_MODEL;
  delete process.env.OLLAMA_EMBEDDING_MODEL;
});

describe("getSettings", () => {
  it("devuelve null cuando no hay nada", async () => {
    prisma.appSettings.findFirst.mockResolvedValue(null);

    const result = await getSettings();

    expect(result).toBeNull();
    expect(prisma.appSettings.findFirst).toHaveBeenCalledWith({
      orderBy: { updatedAt: "desc" },
    });
  });

  it("devuelve el registro más reciente mapeado", async () => {
    const dbSettings = mockSettings({ apiKey: "secret" });
    prisma.appSettings.findFirst.mockResolvedValue(dbSettings);

    const result = await getSettings();

    expect(result).not.toBeNull();
    expect(result?.id).toBe("settings-1");
    expect(result?.chatProvider).toBe("ollama");
    expect(result?.apiKey).toBe("secret");
    expect(result?.baseUrl).toBeUndefined();
  });
});

describe("saveSettings", () => {
  it("guarda y devuelve el registro cuando no existe", async () => {
    prisma.appSettings.findFirst.mockResolvedValue(null);
    prisma.appSettings.create.mockResolvedValue(mockSettings());

    const result = await saveSettings({
      chatProvider: "ollama",
      chatModel: "llama3.2:3b",
      embeddingProvider: "ollama",
      embeddingModel: "nomic-embed-text",
      language: "es",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("settings-1");
    }
    expect(prisma.appSettings.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chatProvider: "ollama",
        chatModel: "llama3.2:3b",
        embeddingProvider: "ollama",
        embeddingModel: "nomic-embed-text",
        apiKey: null,
        baseUrl: null,
      }),
    });
  });

  it("actualiza el registro existente", async () => {
    prisma.appSettings.findFirst.mockResolvedValue(mockSettings());
    prisma.appSettings.update.mockResolvedValue(
      mockSettings({ chatModel: "llama3.3", apiKey: "new-key" })
    );

    const result = await saveSettings({
      chatProvider: "ollama",
      chatModel: "llama3.3",
      embeddingProvider: "ollama",
      embeddingModel: "nomic-embed-text",
      apiKey: "new-key",
      language: "es",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.chatModel).toBe("llama3.3");
      expect(result.data.apiKey).toBe("new-key");
    }
    expect(prisma.appSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "settings-1" },
        data: expect.objectContaining({ chatModel: "llama3.3" }),
      })
    );
  });
});

describe("getEffectiveSettings", () => {
  it("devuelve BD si existe", async () => {
    const dbSettings = mockSettings({ chatModel: "custom-model" });
    prisma.appSettings.findFirst.mockResolvedValue(dbSettings);

    const result = await getEffectiveSettings();

    expect(result.chatModel).toBe("custom-model");
    expect(result.id).toBe("settings-1");
  });

  it("devuelve valores por defecto desde env cuando no hay BD", async () => {
    prisma.appSettings.findFirst.mockResolvedValue(null);
    process.env.OLLAMA_CHAT_MODEL = "env-chat-model";
    process.env.OLLAMA_EMBEDDING_MODEL = "env-embedding-model";

    const result = await getEffectiveSettings();

    expect(result.chatProvider).toBe("ollama");
    expect(result.chatModel).toBe("env-chat-model");
    expect(result.embeddingProvider).toBe("ollama");
    expect(result.embeddingModel).toBe("env-embedding-model");
    expect(result.apiKey).toBeUndefined();
    expect(result.baseUrl).toBeUndefined();
    expect(result.id).toBe("default");
  });

  it("usa los defaults cuando no hay env", async () => {
    prisma.appSettings.findFirst.mockResolvedValue(null);

    const result = await getEffectiveSettings();

    expect(result.chatModel).toBe("llama3.2:3b");
    expect(result.embeddingModel).toBe("nomic-embed-text");
  });
});
