import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getRecommendedModels,
  isModelInstalled,
  listInstalledOllamaModels,
  recommendModelByRam,
} from "./ollama-models";

describe("ollama-models", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"models":[]}', { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("getRecommendedModels", () => {
    it("devuelve la lista de modelos recomendados", () => {
      const models = getRecommendedModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.map((m) => m.name)).toContain("llama3.2:3b");
    });

    it("no modifica la lista original al mutar el resultado", () => {
      const models = getRecommendedModels();
      models[0].label = "mutated";
      const modelsAgain = getRecommendedModels();
      expect(modelsAgain[0].label).not.toBe("mutated");
    });
  });

  describe("isModelInstalled", () => {
    it("devuelve true cuando el modelo coincide exactamente", () => {
      expect(isModelInstalled("llama3.2:3b", ["llama3.2:3b"])).toBe(true);
    });

    it("devuelve true cuando el nombre base coincide con un tag instalado", () => {
      expect(isModelInstalled("llama3.2", ["llama3.2:3b"])).toBe(true);
    });

    it("devuelve false cuando el modelo no está instalado", () => {
      expect(isModelInstalled("llama3.2:3b", ["mistral:7b"])).toBe(false);
    });

    it("devuelve false para lista vacía", () => {
      expect(isModelInstalled("llama3.2:3b", [])).toBe(false);
    });
  });

  describe("recommendModelByRam", () => {
    it("recomienda el modelo más potente que cabe en la RAM libre", () => {
      const model = recommendModelByRam(24);
      expect(model.minRamGB).toBeGreaterThanOrEqual(16);
    });

    it("recomienda un modelo ligero cuando hay poca RAM", () => {
      const model = recommendModelByRam(4);
      expect(model.minRamGB ?? 0).toBeLessThanOrEqual(4);
    });

    it("no devuelve undefined cuando la RAM es muy baja", () => {
      const model = recommendModelByRam(1);
      expect(model).toBeDefined();
      expect(model.name).toBeDefined();
    });
  });

  describe("listInstalledOllamaModels", () => {
    it("devuelve los nombres de los modelos instalados", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            models: [{ name: "llama3.2:3b" }, { name: "nomic-embed-text" }],
          })
        )
      );

      const result = await listInstalledOllamaModels();
      expect(result).toEqual(["llama3.2:3b", "nomic-embed-text"]);
    });

    it("devuelve array vacío cuando no hay modelos", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ models: [] })));

      const result = await listInstalledOllamaModels();
      expect(result).toEqual([]);
    });

    it("devuelve array vacío cuando Ollama responde con error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("error", { status: 500 }))
      );

      const result = await listInstalledOllamaModels();
      expect(result).toEqual([]);
    });

    it("devuelve array vacío cuando hay error de red", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Network error"); }));

      const result = await listInstalledOllamaModels();
      expect(result).toEqual([]);
    });

    it("usa la URL base proporcionada", async () => {
      const fetchMock = vi.fn(async () => Response.json({ models: [] }));
      vi.stubGlobal("fetch", fetchMock);

      await listInstalledOllamaModels("http://custom:11434");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://custom:11434/api/tags",
        { method: "GET" }
      );
    });

    it("elimina la barra final de la URL base", async () => {
      const fetchMock = vi.fn(async () => Response.json({ models: [] }));
      vi.stubGlobal("fetch", fetchMock);

      await listInstalledOllamaModels("http://custom:11434/");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://custom:11434/api/tags",
        { method: "GET" }
      );
    });
  });
});
