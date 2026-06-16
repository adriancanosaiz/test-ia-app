import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ollamaProvider, validateOllamaModels } from "./ollama";
import { z } from "zod";

describe("ollamaProvider", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"models":[]}', { status: 200 }))
    );
    process.env.OLLAMA_TIMEOUT_MS = "1000";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.OLLAMA_TIMEOUT_MS;
    delete process.env.OLLAMA_CHAT_MODEL;
    delete process.env.OLLAMA_EMBEDDING_MODEL;
  });

  describe("embedding", () => {
    it("devuelve un vector de la dimensión correcta", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ embedding: Array.from({ length: 768 }, () => 0.1) })
        )
      );

      const vector = await ollamaProvider.embedding.embed("hola");
      expect(vector).toHaveLength(768);
      expect(vector[0]).toBe(0.1);
    });

    it("reintenta hasta 3 veces ante errores 5xx", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response("error", { status: 503 }))
        .mockResolvedValueOnce(new Response("error", { status: 502 }))
        .mockResolvedValueOnce(
          Response.json({ embedding: Array.from({ length: 768 }, () => 0.1) })
        );
      vi.stubGlobal("fetch", fetchMock);

      vi.useFakeTimers({ shouldAdvanceTime: true });
      const promise = ollamaProvider.embedding.embed("hola");
      await vi.advanceTimersByTimeAsync(4000);
      const vector = await promise;
      vi.useRealTimers();

      expect(vector).toHaveLength(768);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("reintenta ante error 429", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
        .mockResolvedValueOnce(
          Response.json({ embedding: Array.from({ length: 768 }, () => 0.2) })
        );
      vi.stubGlobal("fetch", fetchMock);

      vi.useFakeTimers({ shouldAdvanceTime: true });
      const promise = ollamaProvider.embedding.embed("hola");
      await vi.advanceTimersByTimeAsync(1000);
      const vector = await promise;
      vi.useRealTimers();

      expect(vector[0]).toBe(0.2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("no reintenta ante errores 4xx del cliente", async () => {
      const fetchMock = vi.fn(async () =>
        new Response("bad request", { status: 400 })
      );
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        ollamaProvider.embedding.embed("hola")
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[AppError: Ollama embedding failed: 400 ]`
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("lanza error de sistema si hay timeout", async () => {
      process.env.OLLAMA_TIMEOUT_MS = "50";
      const fetchMock = vi.fn((_url, init?: RequestInit) => {
        return new Promise<Response>((_, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          if (signal?.aborted) {
            reject(new Error("AbortError"));
            return;
          }
          signal?.addEventListener("abort", () => {
            reject(new Error("AbortError"));
          });
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        ollamaProvider.embedding.embed("hola")
      ).rejects.toThrow("Timeout al conectar con Ollama después de 50ms");
    });

    it("reporta la dimensión esperada", () => {
      expect(ollamaProvider.embedding.getDimensions()).toBe(768);
    });

    it("respeta OLLAMA_EMBEDDING_DIMENSIONS", () => {
      process.env.OLLAMA_EMBEDDING_DIMENSIONS = "512";
      expect(ollamaProvider.embedding.getDimensions()).toBe(512);
    });
  });

  describe("chat", () => {
    it("health devuelve true cuando Ollama responde", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response('{"models":[]}', { status: 200 }))
      );

      await expect(ollamaProvider.chat.health()).resolves.toBe(true);
    });

    it("health devuelve false si hay error de red", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("Network error");
        })
      );

      await expect(ollamaProvider.chat.health()).resolves.toBe(false);
    });

    it("chatStream produce chunks de texto", async () => {
      const chunks = [
        JSON.stringify({ message: { content: "Hola" } }),
        JSON.stringify({ message: { content: " mundo" } }),
      ];

      const encoder = new TextEncoder();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          const stream = new ReadableStream({
            start(controller) {
              for (const line of chunks) {
                controller.enqueue(encoder.encode(line + "\n"));
              }
              controller.close();
            },
          });
          return new Response(stream, { status: 200 });
        })
      );

      const result: string[] = [];
      for await (const chunk of ollamaProvider.chat.chatStream([
        { role: "user", content: "hola" },
      ])) {
        result.push(chunk);
      }

      expect(result).toEqual(["Hola", " mundo"]);
    });

    it("complete devuelve el contenido completo", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ message: { content: "Respuesta completa" } })
        )
      );

      const result = await ollamaProvider.chat.complete([
        { role: "user", content: "hola" },
      ]);

      expect(result).toBe("Respuesta completa");
    });

    it("complete reintenta ante errores 5xx", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response("error", { status: 503 }))
        .mockResolvedValueOnce(
          Response.json({ message: { content: "Respuesta tras reintento" } })
        );
      vi.stubGlobal("fetch", fetchMock);

      vi.useFakeTimers({ shouldAdvanceTime: true });
      const promise = ollamaProvider.chat.complete([
        { role: "user", content: "hola" },
      ]);
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;
      vi.useRealTimers();

      expect(result).toBe("Respuesta tras reintento");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("completeJSON parsea y valida la respuesta JSON", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ message: { content: '{"valid":true}' } })
        )
      );

      const schema = z.object({ valid: z.boolean() });
      const result = await ollamaProvider.chat.completeJSON(
        [{ role: "user", content: "hola" }],
        schema
      );

      expect(result).toEqual({ valid: true });
    });

    it("completeJSON sanitiza bloques markdown accidentales", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            message: {
              content: "```json\n{\"valid\":true}\n```",
            },
          })
        )
      );

      const schema = z.object({ valid: z.boolean() });
      const result = await ollamaProvider.chat.completeJSON(
        [{ role: "user", content: "hola" }],
        schema
      );

      expect(result).toEqual({ valid: true });
    });

    it("completeJSON sanitiza bloques markdown con espacios", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            message: {
              content: "   ```json\n{\"valid\":true}\n```   ",
            },
          })
        )
      );

      const schema = z.object({ valid: z.boolean() });
      const result = await ollamaProvider.chat.completeJSON(
        [{ role: "user", content: "hola" }],
        schema
      );

      expect(result).toEqual({ valid: true });
    });
  });

  describe("validateOllamaModels", () => {
    it("devuelve éxito cuando ambos modelos están disponibles", async () => {
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

      const result = await validateOllamaModels();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.chatAvailable).toBe(true);
        expect(result.data.embeddingAvailable).toBe(true);
      }
    });

    it("acepta nombres con tag", async () => {
      process.env.OLLAMA_CHAT_MODEL = "llama3.2";
      process.env.OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";

      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            models: [{ name: "llama3.2:3b" }, { name: "nomic-embed-text:latest" }],
          })
        )
      );

      const result = await validateOllamaModels();
      expect(result.success).toBe(true);
    });

    it("devuelve USER_ERROR cuando falta el modelo de chat", async () => {
      process.env.OLLAMA_CHAT_MODEL = "missing-chat";
      process.env.OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";

      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ models: [{ name: "nomic-embed-text" }] })
        )
      );

      const result = await validateOllamaModels();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("USER_ERROR");
        expect(result.error.message).toContain("missing-chat");
      }
    });

    it("devuelve USER_ERROR cuando falta el modelo de embeddings", async () => {
      process.env.OLLAMA_CHAT_MODEL = "llama3.2:3b";
      process.env.OLLAMA_EMBEDDING_MODEL = "missing-embed";

      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ models: [{ name: "llama3.2:3b" }] })
        )
      );

      const result = await validateOllamaModels();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("USER_ERROR");
        expect(result.error.message).toContain("missing-embed");
      }
    });

    it("devuelve SYSTEM_ERROR si Ollama no responde", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("error", { status: 500 }))
      );

      const result = await validateOllamaModels();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("SYSTEM_ERROR");
      }
    });
  });
});
