import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

vi.mock("os", () => ({
  default: {
    freemem: vi.fn(),
  },
}));

import os from "os";

const freememMock = vi.mocked(os.freemem);

describe("GET /api/ollama/models", () => {
  beforeEach(() => {
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
    freememMock.mockReturnValue(16 * 1024 * 1024 * 1024); // 16 GB
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("devuelve modelos instalados, recomendados y recomendación por hardware", async () => {
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.installed).toEqual(["llama3.2:3b", "nomic-embed-text"]);
    expect(json.recommended.length).toBeGreaterThan(0);
    expect(json.recommendedByHardware).not.toBeNull();
    expect(json.recommendedByHardware.minRamGB).toBeGreaterThanOrEqual(16);
  });

  it("devuelve recommendedByHardware null si falla la lectura de RAM", async () => {
    freememMock.mockImplementation(() => {
      throw new Error("Cannot read memory");
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.recommendedByHardware).toBeNull();
  });

  it("devuelve un array vacío si Ollama no responde", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("error", { status: 500 }))
    );

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.installed).toEqual([]);
  });
});
