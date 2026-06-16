import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

async function readNDJson(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const lines: Record<string, unknown>[] = [];

  if (!reader) return lines;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";

    for (const line of parts) {
      if (!line.trim()) continue;
      lines.push(JSON.parse(line));
    }
  }

  return lines;
}

function createPostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/ollama/pull", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/ollama/pull", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ status: "pulling manifest", completed: 0, total: 100 }) + "\n"
              )
            );
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ status: "pulling...", completed: 50, total: 100 }) + "\n"
              )
            );
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ status: "success" }) + "\n"
              )
            );
            controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reenvía el stream NDJSON de Ollama", async () => {
    const response = await POST(createPostRequest({ model: "llama3.2:3b" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/x-ndjson");

    const lines = await readNDJson(response);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ status: "pulling manifest", completed: 0, total: 100 });
    expect(lines[1]).toMatchObject({ status: "pulling...", completed: 50, total: 100 });
    expect(lines[2]).toMatchObject({ status: "success" });
  });

  it("llama a Ollama con el modelo y stream true", async () => {
    const fetchMock = vi.mocked(global.fetch);
    await POST(createPostRequest({ model: "llama3.2:3b" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/pull"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "llama3.2:3b", stream: true }),
      })
    );
  });

  it("devuelve 400 si el modelo no es un string no vacío", async () => {
    const response = await POST(createPostRequest({ model: "" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it("devuelve 400 si falta el campo model", async () => {
    const response = await POST(createPostRequest({}));
    expect(response.status).toBe(400);
  });

  it("devuelve 400 si el nombre del modelo no es válido", async () => {
    const response = await POST(createPostRequest({ model: "../invalid" }));
    expect(response.status).toBe(400);
  });

  it("permite cualquier nombre válido de Ollama", async () => {
    const response = await POST(createPostRequest({ model: "custom-model:tag" }));
    expect(response.status).toBe(200);
  });

  it("emite un evento de error NDJSON si falla la conexión con Ollama", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Connection refused");
      })
    );

    const response = await POST(createPostRequest({ model: "llama3.2:3b" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/x-ndjson");

    const lines = await readNDJson(response);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      status: "error",
      error: "Connection refused",
    });
  });
});
