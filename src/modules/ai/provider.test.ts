import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  validateEmbeddingDimensions,
  getEmbeddingDimensions,
  getOllamaGenerationTimeoutMs,
} from "./provider";

describe("ai/provider", () => {
  beforeEach(() => {
    delete process.env.OLLAMA_EMBEDDING_DIMENSIONS;
    delete process.env.OLLAMA_GENERATION_TIMEOUT_MS;
  });

  afterEach(() => {
    delete process.env.OLLAMA_EMBEDDING_DIMENSIONS;
    delete process.env.OLLAMA_GENERATION_TIMEOUT_MS;
  });

  describe("validateEmbeddingDimensions", () => {
    it("devuelve éxito cuando la dimensión coincide con Prisma", async () => {
      process.env.OLLAMA_EMBEDDING_DIMENSIONS = "768";
      const result = await validateEmbeddingDimensions();
      expect(result.success).toBe(true);
    });

    it("devuelve USER_ERROR cuando la dimensión no coincide", async () => {
      process.env.OLLAMA_EMBEDDING_DIMENSIONS = "512";
      const result = await validateEmbeddingDimensions();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("USER_ERROR");
        expect(result.error.message).toContain("512");
        expect(result.error.message).toContain("768");
      }
    });

    it("usa 768 como dimensión por defecto", () => {
      expect(getEmbeddingDimensions()).toBe(768);
    });

    it("respeta OLLAMA_EMBEDDING_DIMENSIONS", () => {
      process.env.OLLAMA_EMBEDDING_DIMENSIONS = "1024";
      expect(getEmbeddingDimensions()).toBe(1024);
    });

    it("usa 300000ms como timeout de generación por defecto", () => {
      expect(getOllamaGenerationTimeoutMs()).toBe(300000);
    });

    it("respeta OLLAMA_GENERATION_TIMEOUT_MS", () => {
      process.env.OLLAMA_GENERATION_TIMEOUT_MS = "600000";
      expect(getOllamaGenerationTimeoutMs()).toBe(600000);
    });
  });
});
