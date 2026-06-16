import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { GroqChatProvider } from "./groq";

function createProvider(): GroqChatProvider {
  return new GroqChatProvider({
    apiKey: "test-key",
    model: "llama3-8b-8192",
  });
}

describe("GroqChatProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lanza error si falta la API key", () => {
    expect(
      () => new GroqChatProvider({ apiKey: "", model: "llama3-8b-8192" })
    ).toThrow(expect.objectContaining({ code: "GROQ_API_KEY_MISSING" }));
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
          choices: [{ message: { content: "Respuesta Groq" } }],
        })
      )
    );

    const result = await createProvider().complete([
      { role: "user", content: "hola" },
    ]);

    expect(result).toBe("Respuesta Groq");
  });

  it("complete lanza error si la petición falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("error", { status: 500 }))
    );

    await expect(
      createProvider().complete([{ role: "user", content: "hola" }])
    ).rejects.toThrow(expect.objectContaining({ code: "GROQ_REQUEST_FAILED" }));
  });

  it("chatStream produce chunks de texto", async () => {
    const lines = [
      'data: {"choices":[{"delta":{"content":"Hola"}}]}',
      'data: {"choices":[{"delta":{"content":" mundo"}}]}',
      "data: [DONE]",
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
          choices: [{ message: { content: '{"valid":true}' } }],
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

  it("completeJSON usa response_format json_object", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: '{"ok":true}' } }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const schema = z.object({ ok: z.boolean() });
    await createProvider().completeJSON(
      [{ role: "user", content: "devuelve JSON" }],
      schema
    );

    const lastCall = fetchMock.mock.calls.at(-1) as
      | [string, RequestInit | undefined]
      | undefined;
    const body = JSON.parse(String(lastCall?.[1]?.body));
    expect(body.response_format).toEqual({ type: "json_object" });
  });
});
