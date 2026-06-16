// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { useModelPull } from "./use-model-pull";

function createStreamResponse(lines: string[]) {
  const encoder = new TextEncoder();
  const chunks = lines.map((line) => encoder.encode(`${line}\n`));
  let index = 0;

  const reader = {
    read: vi.fn(async () => {
      if (index >= chunks.length) {
        return { done: true as const, value: undefined };
      }
      return { done: false as const, value: chunks[index++] };
    }),
    releaseLock: vi.fn(),
  };

  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body: { getReader: () => reader },
  } as unknown as Response;
}

function createErrorResponse(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
    body: null,
  } as unknown as Response;
}

describe("useModelPull", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("inicia en estado inactivo", () => {
    const { result } = renderHook(() => useModelPull());

    expect(result.current.pullingModel).toBeNull();
    expect(result.current.pullProgress).toBe(0);
    expect(result.current.pullStatus).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("descarga un modelo y actualiza el progreso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createStreamResponse([
          JSON.stringify({ status: "pulling manifest", completed: 0, total: 100 }),
          JSON.stringify({ status: "pulling...", completed: 50, total: 100 }),
          JSON.stringify({ status: "pulling...", completed: 100, total: 100 }),
          JSON.stringify({ status: "success" }),
        ])
      )
    );

    const { result } = renderHook(() => useModelPull());

    let response: { success: boolean; error?: string } | undefined;

    await act(async () => {
      response = await result.current.pullModel("llama3.2:3b");
    });

    expect(response).toEqual({ success: true });
    expect(result.current.pullingModel).toBeNull();

    await waitFor(() => {
      expect(result.current.pullProgress).toBe(100);
    });
    expect(result.current.pullStatus).toBe("success");
    expect(result.current.error).toBeNull();
  });

  it("devuelve error si el stream contiene un evento de error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createStreamResponse([
          JSON.stringify({ status: "error", error: "No hay suficiente memoria" }),
        ])
      )
    );

    const { result } = renderHook(() => useModelPull());

    let response: { success: boolean; error?: string } | undefined;

    await act(async () => {
      response = await result.current.pullModel("llama3.2:3b");
    });

    expect(response).toEqual({
      success: false,
      error: "No hay suficiente memoria",
    });
    expect(result.current.error).toBe("No hay suficiente memoria");
  });

  it("devuelve error si la petición inicial falla", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createErrorResponse(500, "Internal Server Error")));

    const { result } = renderHook(() => useModelPull());

    let response: { success: boolean; error?: string } | undefined;

    await act(async () => {
      response = await result.current.pullModel("llama3.2:3b");
    });

    expect(response?.success).toBe(false);
    expect(result.current.error).toContain("500");
  });

  it("ignora líneas que no sean JSON válido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createStreamResponse([
          "not json",
          JSON.stringify({ status: "pulling...", completed: 25, total: 100 }),
          JSON.stringify({ status: "done" }),
        ])
      )
    );

    const { result } = renderHook(() => useModelPull());

    await act(async () => {
      await result.current.pullModel("llama3.2:3b");
    });

    expect(result.current.pullProgress).toBe(25);
    expect(result.current.pullStatus).toBe("done");
    expect(result.current.error).toBeNull();
  });
});
