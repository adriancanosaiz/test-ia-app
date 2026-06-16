import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { AnthropicChatProvider } from "./anthropic";

function createProvider(): AnthropicChatProvider {
  return new AnthropicChatProvider({
    apiKey: "test-key",
    model: "claude-3-haiku-20240307",
  });
}

describe("AnthropicChatProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lanza error si falta la API key", () => {
    expect(
      () =>
        new AnthropicChatProvider({ apiKey: "", model: "claude-3-haiku-20240307" })
    ).toThrow(expect.objectContaining({ code: "ANTHROPIC_API_KEY_MISSING" }));
  });

  it("health devuelve true cuando la API responde", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"data":[]}', { status: 200 }))
    );

    await expect(createProvider().health()).resolves.toBe(true);
  });

  it("health devuelve false si la API key es inválida", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unauthorized", { status: 401 }))
    );

    await expect(createProvider().health()).resolves.toBe(false);
  });

  it("complete devuelve el contenido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          content: [{ type: "text", text: "Respuesta Anthropic" }],
        })
      )
    );

    const result = await createProvider().complete([
      { role: "user", content: "hola" },
    ]);

    expect(result).toBe("Respuesta Anthropic");
  });

  it("complete envía el system prompt por separado", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        content: [{ type: "text", text: "ok" }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await createProvider().complete([
      { role: "system", content: "Eres un asistente" },
      { role: "user", content: "hola" },
    ]);

    const lastCall = fetchMock.mock.calls.at(-1) as
      | [string, RequestInit | undefined]
      | undefined;
    const body = JSON.parse(String(lastCall?.[1]?.body));
    expect(body.system).toBe("Eres un asistente");
    expect(body.messages).toEqual([{ role: "user", content: "hola" }]);
  });

  it("complete lanza error si la petición falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("error", { status: 500 }))
    );

    await expect(
      createProvider().complete([{ role: "user", content: "hola" }])
    ).rejects.toThrow(expect.objectContaining({ code: "ANTHROPIC_REQUEST_FAILED" }));
  });

  it("chatStream produce chunks de texto", async () => {
    const lines = [
      "event: content_block_delta",
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hola"}}',
      "event: content_block_delta",
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" mundo"}}',
      "event: message_stop",
      "data: {}",
    ];
    const encoder = new TextEncoder();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const stream = new ReadableStream({
          start(controller) {
            for (const line of lines) {
              controller.enqueue(encoder.encode(line + "\n"));
            }
            controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      })
    );

    const chunks: string[] = [];
    for await (const chunk of createProvider().chatStream([
      { role: "user", content: "hola" },
    ])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hola", " mundo"]);
  });

  it("completeJSON parsea y valida la respuesta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          content: [{ type: "text", text: '{"valid":true}' }],
        })
      )
    );

    const schema = z.object({ valid: z.boolean() });
    const result = await createProvider().completeJSON(
      [{ role: "user", content: "devuelve JSON" }],
      schema
    );

    expect(result).toEqual({ valid: true });
  });

  it("completeJSON sanitiza bloques markdown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          content: [
            { type: "text", text: "```json\n{\"valid\":true}\n```" },
          ],
        })
      )
    );

    const schema = z.object({ valid: z.boolean() });
    const result = await createProvider().completeJSON(
      [{ role: "user", content: "devuelve JSON" }],
      schema
    );

    expect(result).toEqual({ valid: true });
  });
});
